import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
from typing import List, Optional
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.database import get_session
from app.core.security import require_roles
from app.models.user import User
from app.models.fir import FIR, PoliceStation, Escalation
from app.models.enums import UserRole, FIRStatus, EscalationStatus
from app.schemas.fir import FIRResponse, EscalationResponse
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


class StationCreateRequest(BaseModel):
    name: str
    district: str
    state: str = "Maharashtra"
    address: str
    phone: Optional[str] = None


class StationResponse(BaseModel):
    id: str
    name: str
    district: str
    state: str
    address: str
    phone: Optional[str]

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_firs: int
    pending_firs: int
    resolved_firs: int
    escalated_firs: int
    total_users: int
    total_stations: int


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)),
):
    total_firs = (await session.exec(select(func.count(FIR.id)))).one()
    pending = (await session.exec(
        select(func.count(FIR.id)).where(FIR.status == FIRStatus.SUBMITTED)
    )).one()
    resolved = (await session.exec(
        select(func.count(FIR.id)).where(FIR.status == FIRStatus.RESOLVED)
    )).one()
    escalated = (await session.exec(
        select(func.count(FIR.id)).where(FIR.status == FIRStatus.ESCALATED)
    )).one()
    total_users = (await session.exec(select(func.count(User.id)))).one()
    total_stations = (await session.exec(select(func.count(PoliceStation.id)))).one()

    return DashboardStats(
        total_firs=total_firs,
        pending_firs=pending,
        resolved_firs=resolved,
        escalated_firs=escalated,
        total_users=total_users,
        total_stations=total_stations,
    )


# ── Police Stations ───────────────────────────────────────────────────────────

@router.post("/stations", response_model=StationResponse, status_code=201)
async def create_station(
    payload: StationCreateRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    station = PoliceStation(**payload.model_dump())
    session.add(station)
    await session.commit()
    await session.refresh(station)
    return station


@router.get("/stations", response_model=List[StationResponse])
async def list_stations(
    session: AsyncSession = Depends(get_session),
):
    result = await session.exec(select(PoliceStation))
    return result.all()


@router.get("/stations/nearby", response_model=List[StationResponse])
async def stations_nearby(
    address: str = Query(..., min_length=5, description="Incident address"),
    session: AsyncSession = Depends(get_session),
):
    """
    Public endpoint. Uses OpenStreetMap (Nominatim + Overpass) to find police
    stations near the given address. Completely free — no API key required.
    Upserts results into the local DB and returns them with real DB IDs.
    """
    try:
        from app.services.places import geocode_nominatim, overpass_police_stations, nominatim_police_stations

        location = await geocode_nominatim(address)
        if not location:
            raise HTTPException(
                422,
                detail="Could not find that location. Try adding the city or district name.",
            )

        places = await overpass_police_stations(location["lat"], location["lng"])

        # Overpass data is sparse in India — fall back to Nominatim amenity search
        if not places:
            places = await nominatim_police_stations(location["lat"], location["lng"])

        if not places:
            raise HTTPException(
                404,
                detail="No police stations found near this location. Try a nearby landmark or area name.",
            )

        # Prioritise stations in the same state as the searched address, then by distance
        from app.services.places import _distance_km
        search_state = location["state"].lower()
        places.sort(key=lambda p: (
            0 if p.get("state", "").lower() == search_state else 1,
            _distance_km(location["lat"], location["lng"], p["lat"], p["lng"]),
        ))
        places = places[:8]  # return at most 8 options

        results: list[StationResponse] = []
        for p in places:
            # Use the station's own state/district from OSM/Nominatim; fall back to
            # the geocoded location only when the station has no address tags.
            station_state    = p.get("state")    or location["state"]
            station_district = p.get("district") or location["district"] or "Unknown"

            existing = (
                await session.exec(
                    select(PoliceStation).where(PoliceStation.name == p["name"])
                )
            ).first()

            if existing:
                results.append(StationResponse(
                    id=str(existing.id),
                    name=existing.name,
                    district=existing.district,
                    state=existing.state,
                    address=existing.address,
                    phone=existing.phone,
                ))
            else:
                new_id = str(uuid.uuid4())
                station = PoliceStation(
                    id=new_id,
                    name=p["name"],
                    district=station_district,
                    state=station_state,
                    address=p["address"] or address,
                    phone=None,
                )
                session.add(station)
                await session.flush()
                results.append(StationResponse(
                    id=new_id,
                    name=p["name"],
                    district=station_district,
                    state=station_state,
                    address=p["address"] or address,
                    phone=None,
                ))

        await session.commit()
        return results

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("stations_nearby failed for address=%r: %s", address, exc)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)),
    role: Optional[UserRole] = Query(default=None),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await session.exec(query)
    return result.all()


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    new_role: UserRole,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = new_role
    session.add(user)
    await session.commit()
    return {"message": f"Role updated to {new_role}"}


@router.patch("/users/{user_id}/station")
async def assign_user_station(
    user_id: str,
    station_id: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY, UserRole.STATION_ADMIN)),
):
    """Assign or unassign an officer to a police station (pass station_id=None to unassign)."""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.station_id = station_id
    session.add(user)
    await session.commit()
    return {"message": "Station assignment updated"}


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    session.add(user)
    await session.commit()
    return {"message": "User deactivated"}


# ── Escalation Management ─────────────────────────────────────────────────────

@router.get("/escalations", response_model=List[EscalationResponse])
async def get_escalations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
    status_filter: Optional[EscalationStatus] = Query(default=None),
):
    query = select(Escalation).where(Escalation.escalated_to == current_user.id)
    if status_filter:
        query = query.where(Escalation.status == status_filter)
    result = await session.exec(query.order_by(Escalation.created_at.desc()))
    return result.all()
