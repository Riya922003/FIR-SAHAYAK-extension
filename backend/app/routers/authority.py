import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.security import require_roles
from app.models.enums import FIRStatus, UserRole
from app.models.fir import FIR, PoliceStation
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
        (await session.exec(select(PoliceStation.id).where(PoliceStation.district == district))).all()
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
        .where(PoliceStation.district == district)
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
