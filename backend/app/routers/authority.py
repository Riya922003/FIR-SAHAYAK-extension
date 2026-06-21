import logging
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.security import require_roles
from app.models.enums import FIRStatus, UserRole
from app.models.fir import FIRStatusHistory
from app.models.user import User
from app.repositories import (
    get_fir_repo,
    get_station_repo,
    get_history_repo,
    get_user_repo,
)
from app.repositories.fir_repository import FIRRepository
from app.repositories.station_repository import StationRepository
from app.repositories.status_history_repository import StatusHistoryRepository
from app.repositories.user_repository import UserRepository
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
    pending: int
    escalated: int
    investigating: int
    overdue: int
    total_active: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/district/stats", response_model=DistrictStats)
async def get_district_stats(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station_ids = await station_repo.get_ids_by_district(district)

    if not station_ids:
        return DistrictStats(
            total_stations=0, total_active_firs=0,
            pending_escalations=0, resolved_this_month=0,
        )

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    return DistrictStats(
        total_stations=len(station_ids),
        total_active_firs=await fir_repo.count_by_station_ids_and_statuses(
            station_ids, ACTIVE_STATUSES
        ),
        pending_escalations=await fir_repo.count_by_station_ids_and_statuses(
            station_ids, [FIRStatus.ESCALATED]
        ),
        resolved_this_month=await fir_repo.count_by_station_ids_status_since(
            station_ids, FIRStatus.RESOLVED, month_start
        ),
    )


@router.get("/district/stations", response_model=List[StationHealth])
async def get_district_stations(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    stations = await station_repo.get_by_district(district)
    overdue_cutoff = datetime.utcnow() - timedelta(hours=OVERDUE_HOURS)
    result = []

    for st in stations:
        firs = await fir_repo.get_by_station(st.id)
        pending       = sum(1 for f in firs if f.status == FIRStatus.SUBMITTED)
        escalated     = sum(1 for f in firs if f.status == FIRStatus.ESCALATED)
        investigating = sum(1 for f in firs if f.status == FIRStatus.UNDER_INVESTIGATION)
        overdue       = sum(
            1 for f in firs
            if f.status == FIRStatus.SUBMITTED and f.created_at < overdue_cutoff
        )
        total_active  = sum(1 for f in firs if f.status in ACTIVE_STATUSES)

        result.append(StationHealth(
            id=st.id, name=st.name, district=st.district,
            state=st.state, address=st.address, phone=st.phone,
            pending=pending, escalated=escalated,
            investigating=investigating, overdue=overdue,
            total_active=total_active,
        ))

    result.sort(key=lambda s: (-(s.escalated + s.overdue), -s.total_active))
    return result


@router.get("/district/stations/{station_id}/firs", response_model=List[FIRResponse])
async def get_station_firs(
    station_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station = await station_repo.get_by_id(station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "Station not found in your district")
    return await fir_repo.get_by_station(station_id)


@router.get("/district/escalations", response_model=List[EscalationItem])
async def get_district_escalations(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station_map = await station_repo.get_id_name_map_by_district(district)

    if not station_map:
        return []

    escalated_firs = await fir_repo.get_by_station_ids(
        list(station_map.keys()), status=FIRStatus.ESCALATED
    )

    result = []
    now = datetime.utcnow()

    for fir in escalated_firs:
        history = await history_repo.get_last_escalation_entry(fir.id)

        escalated_at = history.changed_at if history else fir.updated_at
        reason = history.notes or "No reason provided" if history else "No reason provided"
        if reason.startswith("Escalated by citizen: "):
            reason = reason[len("Escalated by citizen: "):]

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
            days_pending=(now - escalated_at).days,
        ))

    return result


@router.post("/district/escalations/{fir_id}/action", response_model=FIRResponse)
async def post_escalation_action(
    fir_id: str,
    payload: AuthorityActionRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(404, "FIR not found")

    station = await station_repo.get_by_id(fir.station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "FIR not in your district")

    if fir.status != FIRStatus.ESCALATED:
        raise HTTPException(400, f"FIR is not in escalated state (current: {fir.status})")

    old_status = fir.status
    new_status = FIRStatus.UNDER_INVESTIGATION if payload.hand_back else FIRStatus.ESCALATED
    note = f"[Authority Directive] {payload.directive}"
    if payload.hand_back:
        note += " — Handed back to station for investigation."
        fir.status = new_status
        fir.updated_at = datetime.utcnow()
        await fir_repo.update(fir)

    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=old_status,
        new_status=new_status,
        changed_by=current_user.id,
        notes=note,
    ))
    return fir


@router.get("/district/cases", response_model=List[FIRWithStation])
async def get_district_cases(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
    status: Optional[FIRStatus] = Query(default=None),
    station_id: Optional[str] = Query(default=None),
):
    district = _district(current_user)
    station_map = await station_repo.get_id_name_map_by_district(district)

    if not station_map:
        return []

    if station_id:
        if station_id not in station_map:
            raise HTTPException(404, "Station not found in your district")
        ids = [station_id]
    else:
        ids = list(station_map.keys())

    firs = await fir_repo.get_by_station_ids(ids, status=status)

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
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(404, "FIR not found")
    station = await station_repo.get_by_id(fir.station_id)
    if not station or station.district.lower() != district.lower():
        raise HTTPException(404, "FIR not in your district")

    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=fir.status,
        new_status=fir.status,
        changed_by=current_user.id,
        notes=f"[Authority Note] {payload.note}",
    ))
    return fir


@router.get("/district/directives", response_model=List[DirectiveItem])
async def get_district_directives(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station_map = await station_repo.get_id_name_map_by_district(district)

    if not station_map:
        return []

    fir_rows = await fir_repo.get_partial_by_station_ids(list(station_map.keys()))
    fir_map = {row[0]: (row[1], row[2]) for row in fir_rows}  # fir_id → (fir_number, station_id)

    if not fir_map:
        return []

    history_rows = await history_repo.get_directives_by_fir_ids(list(fir_map.keys()))

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
    station_repo: StationRepository = Depends(get_station_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    district = _district(current_user)
    station_map = await station_repo.get_id_name_map_by_district(district)

    if not station_map:
        return []

    officers = await user_repo.get_by_station_ids(
        list(station_map.keys()),
        roles=[UserRole.OFFICER, UserRole.STATION_ADMIN],
    )

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
