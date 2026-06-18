import logging
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.security import require_roles, get_current_user
from app.models.enums import FIRStatus, UserRole
from app.models.fir import FIR, FIRStatusHistory, PoliceStation
from app.models.user import User
from app.schemas.fir import FIRResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/authority", tags=["Higher Authority"])

ACTIVE_STATUSES = [
    FIRStatus.SUBMITTED,
    FIRStatus.ACKNOWLEDGED,
    FIRStatus.UNDER_INVESTIGATION,
    FIRStatus.ESCALATED,
]
OVERDUE_HOURS = 48


def _district(user: User) -> str:
    if not user.district:
        raise HTTPException(400, "No district assigned. Set your district first.")
    return user.district


# ── Response schemas ──────────────────────────────────────────────────────────

class DistrictStats(BaseModel):
    total_stations: int
    total_active_firs: int
    pending_escalations: int
    resolved_this_month: int


class EscalationItem(BaseModel):
    fir_id: str
    fir_number: str
    complainant_name: str
    incident_type: str
    incident_location: str
    station_id: str
    station_name: str
    escalated_at: datetime
    reason: str
    days_pending: int


class AuthorityActionRequest(BaseModel):
    directive: str = Field(min_length=10, description="Instruction or note for the officer")
    hand_back: bool = False


class FIRWithStation(BaseModel):
    id: str
    fir_number: str
    status: FIRStatus
    incident_type: str
    complainant_name: str
    incident_location: str
    incident_date: date
    station_id: str
    station_name: str
    citizen_id: str
    officer_id: Optional[str] = None
    ipc_sections: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NoteRequest(BaseModel):
    note: str = Field(min_length=5)


class DirectiveItem(BaseModel):
    fir_id: str
    fir_number: str
    station_name: str
    directive: str
    hand_back: bool
    issued_at: datetime
    issued_by_id: str


class OfficerInfo(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    role: str
    station_id: Optional[str]
    station_name: str


class StationHealth(BaseModel):
    id: str
    name: str
    district: str
    state: str
    address: str
    phone: Optional[str] = None
    pending: int         # SUBMITTED — not yet claimed
    escalated: int       # ESCALATED
    investigating: int   # UNDER_INVESTIGATION
    overdue: int         # SUBMITTED > 48 h without acknowledgement
    total_active: int    # all non-terminal


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/district/stats", response_model=DistrictStats)
async def get_district_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)

    station_ids = list(
        (await session.exec(select(PoliceStation.id).where(func.lower(PoliceStation.district) == district.lower()))).all()
    )
    total_stations = len(station_ids)

    if not station_ids:
        return DistrictStats(
            total_stations=0, total_active_firs=0,
            pending_escalations=0, resolved_this_month=0,
        )

    active_count = (await session.exec(
        select(func.count(FIR.id))
        .where(FIR.station_id.in_(station_ids))
        .where(FIR.status.in_(ACTIVE_STATUSES))
    )).one()

    escalation_count = (await session.exec(
        select(func.count(FIR.id))
        .where(FIR.station_id.in_(station_ids))
        .where(FIR.status == FIRStatus.ESCALATED)
    )).one()

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    resolved_month = (await session.exec(
        select(func.count(FIR.id))
        .where(FIR.station_id.in_(station_ids))
        .where(FIR.status == FIRStatus.RESOLVED)
        .where(FIR.updated_at >= month_start)
    )).one()

    return DistrictStats(
        total_stations=total_stations,
        total_active_firs=active_count,
        pending_escalations=escalation_count,
        resolved_this_month=resolved_month,
    )


@router.get("/district/stations", response_model=List[StationHealth])
async def get_district_stations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)

    stations = (await session.exec(
        select(PoliceStation)
        .where(func.lower(PoliceStation.district) == district.lower())
        .order_by(PoliceStation.name)
    )).all()

    overdue_cutoff = datetime.utcnow() - timedelta(hours=OVERDUE_HOURS)
    result = []

    for st in stations:
        firs = (await session.exec(select(FIR).where(FIR.station_id == st.id))).all()

        pending      = sum(1 for f in firs if f.status == FIRStatus.SUBMITTED)
        escalated    = sum(1 for f in firs if f.status == FIRStatus.ESCALATED)
        investigating = sum(1 for f in firs if f.status == FIRStatus.UNDER_INVESTIGATION)
        overdue      = sum(1 for f in firs if f.status == FIRStatus.SUBMITTED and f.created_at < overdue_cutoff)
        total_active = sum(1 for f in firs if f.status in ACTIVE_STATUSES)

        result.append(StationHealth(
            id=st.id, name=st.name, district=st.district,
            state=st.state, address=st.address, phone=st.phone,
            pending=pending, escalated=escalated,
            investigating=investigating, overdue=overdue,
            total_active=total_active,
        ))

    # Sort: most urgent first (escalated + overdue desc, then total_active desc)
    result.sort(key=lambda s: (-(s.escalated + s.overdue), -s.total_active))
    return result


@router.get("/district/stations/{station_id}/firs", response_model=List[FIRResponse])
async def get_station_firs(
    station_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station = await session.get(PoliceStation, station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "Station not found in your district")

    firs = (await session.exec(
        select(FIR)
        .where(FIR.station_id == station_id)
        .order_by(FIR.updated_at.desc())
    )).all()
    return firs


@router.get("/district/escalations", response_model=List[EscalationItem])
async def get_district_escalations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)

    station_ids_rows = (await session.exec(
        select(PoliceStation.id, PoliceStation.name).where(func.lower(PoliceStation.district) == district.lower())
    )).all()
    station_map = {row[0]: row[1] for row in station_ids_rows}

    if not station_map:
        return []

    escalated_firs = (await session.exec(
        select(FIR)
        .where(FIR.station_id.in_(list(station_map.keys())))
        .where(FIR.status == FIRStatus.ESCALATED)
        .order_by(FIR.updated_at.desc())
    )).all()

    result = []
    now = datetime.utcnow()

    for fir in escalated_firs:
        # Get the most recent status history entry for ESCALATED status to extract reason + time
        history = (await session.exec(
            select(FIRStatusHistory)
            .where(FIRStatusHistory.fir_id == fir.id)
            .where(FIRStatusHistory.new_status == FIRStatus.ESCALATED)
            .order_by(FIRStatusHistory.changed_at.desc())
        )).first()

        escalated_at = history.changed_at if history else fir.updated_at
        reason = history.notes or "No reason provided"
        if reason.startswith("Escalated by citizen: "):
            reason = reason[len("Escalated by citizen: "):]

        days = (now - escalated_at).days

        result.append(EscalationItem(
            fir_id=fir.id,
            fir_number=fir.fir_number,
            complainant_name=fir.complainant_name,
            incident_type=fir.incident_type,
            incident_location=fir.incident_location,
            station_id=fir.station_id,
            station_name=station_map.get(fir.station_id, "Unknown"),
            escalated_at=escalated_at,
            reason=reason,
            days_pending=days,
        ))

    return result


@router.post("/district/escalations/{fir_id}/action", response_model=FIRResponse)
async def post_escalation_action(
    fir_id: str,
    payload: AuthorityActionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    fir = await session.get(FIR, fir_id)
    if not fir:
        raise HTTPException(404, "FIR not found")

    station = await session.get(PoliceStation, fir.station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "FIR not in your district")

    if fir.status != FIRStatus.ESCALATED:
        raise HTTPException(400, f"FIR is not in escalated state (current: {fir.status})")

    old_status = fir.status
    new_status = FIRStatus.UNDER_INVESTIGATION if payload.hand_back else FIRStatus.ESCALATED
    note = f"[Authority Directive] {payload.directive}"
    if payload.hand_back:
        note += " — Handed back to station for investigation."

    if payload.hand_back:
        fir.status = new_status
        fir.updated_at = datetime.utcnow()
        session.add(fir)

    history = FIRStatusHistory(
        fir_id=fir.id,
        previous_status=old_status,
        new_status=new_status,
        changed_by=current_user.id,
        notes=note,
    )
    session.add(history)
    await session.commit()
    await session.refresh(fir)
    return fir


@router.get("/district/cases", response_model=List[FIRWithStation])
async def get_district_cases(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
    status: Optional[FIRStatus] = Query(default=None),
    station_id: Optional[str] = Query(default=None),
):
    district = _district(current_user)

    station_rows = (await session.exec(
        select(PoliceStation.id, PoliceStation.name).where(func.lower(PoliceStation.district) == district.lower())
    )).all()
    station_map = {row[0]: row[1] for row in station_rows}

    if not station_map:
        return []

    # Scope to requested station or all district stations
    if station_id:
        if station_id not in station_map:
            raise HTTPException(404, "Station not found in your district")
        ids = [station_id]
    else:
        ids = list(station_map.keys())

    query = select(FIR).where(FIR.station_id.in_(ids))
    if status:
        query = query.where(FIR.status == status)
    query = query.order_by(FIR.updated_at.desc())

    firs = (await session.exec(query)).all()

    return [
        FIRWithStation(
            id=f.id,
            fir_number=f.fir_number,
            status=f.status,
            incident_type=f.incident_type,
            complainant_name=f.complainant_name,
            incident_location=f.incident_location,
            incident_date=f.incident_date,
            station_id=f.station_id,
            station_name=station_map.get(f.station_id, "Unknown"),
            citizen_id=f.citizen_id,
            officer_id=f.officer_id,
            ipc_sections=f.ipc_sections,
            created_at=f.created_at,
            updated_at=f.updated_at,
        )
        for f in firs
    ]


@router.post("/district/cases/{fir_id}/note", response_model=FIRResponse)
async def add_fir_note(
    fir_id: str,
    payload: NoteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    fir = await session.get(FIR, fir_id)
    if not fir:
        raise HTTPException(404, "FIR not found")
    station = await session.get(PoliceStation, fir.station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "FIR not in your district")

    history = FIRStatusHistory(
        fir_id=fir.id,
        previous_status=fir.status,
        new_status=fir.status,
        changed_by=current_user.id,
        notes=f"[Authority Note] {payload.note}",
    )
    session.add(history)
    await session.commit()
    await session.refresh(fir)
    return fir


@router.get("/district/directives", response_model=List[DirectiveItem])
async def get_district_directives(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)

    station_rows = (await session.exec(
        select(PoliceStation.id, PoliceStation.name).where(func.lower(PoliceStation.district) == district.lower())
    )).all()
    station_map = {row[0]: row[1] for row in station_rows}
    if not station_map:
        return []

    fir_rows = (await session.exec(
        select(FIR.id, FIR.fir_number, FIR.station_id)
        .where(FIR.station_id.in_(list(station_map.keys())))
    )).all()
    fir_map = {row[0]: (row[1], row[2]) for row in fir_rows}  # fir_id → (fir_number, station_id)
    if not fir_map:
        return []

    history_rows = (await session.exec(
        select(FIRStatusHistory)
        .where(FIRStatusHistory.fir_id.in_(list(fir_map.keys())))
        .where(FIRStatusHistory.notes.contains("[Authority Directive]"))
        .order_by(FIRStatusHistory.changed_at.desc())
    )).all()

    result = []
    for h in history_rows:
        fir_number, station_id = fir_map.get(h.fir_id, ("Unknown", ""))
        raw = h.notes or ""
        directive = raw[len("[Authority Directive] "):] if raw.startswith("[Authority Directive] ") else raw
        if " — Handed back" in directive:
            directive = directive[:directive.index(" — Handed back")]
        result.append(DirectiveItem(
            fir_id=h.fir_id,
            fir_number=fir_number,
            station_name=station_map.get(station_id, "Unknown"),
            directive=directive,
            hand_back=" — Handed back" in (h.notes or ""),
            issued_at=h.changed_at,
            issued_by_id=h.changed_by,
        ))
    return result


@router.get("/district/officers", response_model=List[OfficerInfo])
async def get_district_officers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)

    station_rows = (await session.exec(
        select(PoliceStation.id, PoliceStation.name).where(func.lower(PoliceStation.district) == district.lower())
    )).all()
    station_map = {row[0]: row[1] for row in station_rows}
    if not station_map:
        return []

    officers = (await session.exec(
        select(User)
        .where(User.station_id.in_(list(station_map.keys())))
        .where(User.role.in_([UserRole.OFFICER, UserRole.STATION_ADMIN]))
        .order_by(User.full_name)
    )).all()

    return [
        OfficerInfo(
            id=o.id,
            full_name=o.full_name,
            email=o.email,
            phone=o.phone,
            role=o.role,
            station_id=o.station_id,
            station_name=station_map.get(o.station_id or "", "Unknown"),
        )
        for o in officers
    ]
