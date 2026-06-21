import uuid
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.security import require_roles
from app.models.user import User
from app.models.fir import PoliceStation
from app.models.enums import UserRole, FIRStatus, EscalationStatus
from app.repositories import (
    get_fir_repo,
    get_user_repo,
    get_station_repo,
    get_escalation_repo,
)
from app.repositories.fir_repository import FIRRepository
from app.repositories.user_repository import UserRepository
from app.repositories.station_repository import StationRepository
from app.repositories.escalation_repository import EscalationRepository
from app.schemas.fir import FIRResponse, EscalationResponse
from app.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

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
    fir_repo: FIRRepository = Depends(get_fir_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    _: User = Depends(require_roles(UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)),
):
    return DashboardStats(
        total_firs=await fir_repo.count_total(),
        pending_firs=await fir_repo.count_by_status(FIRStatus.SUBMITTED),
        resolved_firs=await fir_repo.count_by_status(FIRStatus.RESOLVED),
        escalated_firs=await fir_repo.count_by_status(FIRStatus.ESCALATED),
        total_users=await user_repo.count_all(),
        total_stations=await station_repo.count_all(),
    )


# ── Police Stations ───────────────────────────────────────────────────────────

@router.post("/stations", response_model=StationResponse, status_code=201)
async def create_station(
    payload: StationCreateRequest,
    station_repo: StationRepository = Depends(get_station_repo),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    station = PoliceStation(**payload.model_dump())
    return await station_repo.create(station)


@router.get("/stations", response_model=List[StationResponse])
async def list_stations(
    station_repo: StationRepository = Depends(get_station_repo),
):
    return await station_repo.get_all()


@router.get("/stations/districts", response_model=List[str])
async def list_station_districts(
    station_repo: StationRepository = Depends(get_station_repo),
):
    """Returns distinct district values that actually exist in the stations table."""
    return await station_repo.get_districts()


@router.get("/stations/nearby", response_model=List[StationResponse])
async def stations_nearby(
    address: str = Query(..., min_length=5, description="Incident address"),
    station_repo: StationRepository = Depends(get_station_repo),
):
    """
    Public endpoint. Uses OpenStreetMap (Nominatim + Overpass) to find police
    stations near the given address. Completely free — no API key required.
    Upserts results into the local DB and returns them with real DB IDs.
    """
    try:
        from app.services.places import (
            geocode_nominatim,
            overpass_police_stations,
            nominatim_police_stations,
            _distance_km,
        )

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
        search_state = location["state"].lower()
        places.sort(key=lambda p: (
            0 if p.get("state", "").lower() == search_state else 1,
            _distance_km(location["lat"], location["lng"], p["lat"], p["lng"]),
        ))
        places = places[:8]

        results: list[StationResponse] = []
        for p in places:
            station_state    = p.get("state")    or location["state"]
            station_district = p.get("district") or location["district"] or "Unknown"

            existing = await station_repo.get_by_name(p["name"])
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
                await station_repo.upsert_from_osm(station)
                results.append(StationResponse(
                    id=new_id,
                    name=p["name"],
                    district=station_district,
                    state=station_state,
                    address=p["address"] or address,
                    phone=None,
                ))

        return results

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("stations_nearby failed for address=%r: %s", address, exc)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


@router.get("/stations/{station_id}", response_model=StationResponse)
async def get_station(
    station_id: str,
    station_repo: StationRepository = Depends(get_station_repo),
):
    station = await station_repo.get_by_id(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    user_repo: UserRepository = Depends(get_user_repo),
    _: User = Depends(require_roles(UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)),
    role: Optional[UserRole] = Query(default=None),
):
    return await user_repo.get_all(role)


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    new_role: UserRole,
    user_repo: UserRepository = Depends(get_user_repo),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = new_role
    await user_repo.update(user)
    return {"message": f"Role updated to {new_role}"}


@router.patch("/users/{user_id}/station")
async def assign_user_station(
    user_id: str,
    station_id: Optional[str] = None,
    user_repo: UserRepository = Depends(get_user_repo),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY, UserRole.STATION_ADMIN)),
):
    """Assign or unassign an officer to a police station (pass station_id=None to unassign)."""
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.station_id = station_id
    await user_repo.update(user)
    return {"message": "Station assignment updated"}


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    user_repo: UserRepository = Depends(get_user_repo),
    _: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
):
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await user_repo.update(user)
    return {"message": "User deactivated"}


# ── Escalation Management ─────────────────────────────────────────────────────

@router.get("/escalations", response_model=List[EscalationResponse])
async def get_escalations(
    escalation_repo: EscalationRepository = Depends(get_escalation_repo),
    current_user: User = Depends(require_roles(UserRole.HIGHER_AUTHORITY)),
    status_filter: Optional[EscalationStatus] = Query(default=None),
):
    return await escalation_repo.get_by_authority(current_user.id, status_filter)
