from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.limiter import limiter
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.fir import FIR, FIRStatusHistory
from app.models.enums import FIRStatus, UserRole, EnrichmentStatus
from app.repositories import get_fir_repo, get_history_repo
from app.repositories.fir_repository import FIRRepository
from app.repositories.status_history_repository import StatusHistoryRepository
from app.schemas.fir import (
    FIRCreateRequest,
    FIRUpdateRequest,
    FIRStatusUpdateRequest,
    FIRResponse,
    FIRDetailResponse,
    EscalationRequest,
    ReapplyRequest,
    StatusHistoryItem,
)

router = APIRouter(prefix="/fir", tags=["FIR"])

# Valid status transitions an officer can make (enforced server-side)
VALID_TRANSITIONS: dict = {
    FIRStatus.ACKNOWLEDGED: [FIRStatus.UNDER_INVESTIGATION],
    FIRStatus.UNDER_INVESTIGATION: [FIRStatus.RESOLVED, FIRStatus.REJECTED],
    FIRStatus.RESOLVED: [FIRStatus.CLOSED],
}


# ── Citizen routes ────────────────────────────────────────────────────────────

@router.post("/", response_model=FIRResponse, status_code=201)
@limiter.limit("10/minute")
async def file_fir(
    request: Request,
    payload: FIRCreateRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(get_current_user),
):
    # FIR is saved immediately — no Groq call here.
    # enrichment_status defaults to PENDING; citizen starts enrichment separately
    # via POST /fir/{id}/enrichment/start after receiving the FIR number.
    fir = FIR(
        fir_number=await fir_repo.generate_number(),
        citizen_id=current_user.id,
        station_id=payload.station_id,
        incident_type=payload.incident_type,
        description=payload.description,
        incident_location=payload.incident_location,
        incident_date=payload.incident_date,
        incident_time=payload.incident_time,
        complainant_name=payload.complainant_name,
        complainant_father_name=payload.complainant_father_name,
        complainant_address=payload.complainant_address,
        complainant_phone=payload.complainant_phone,
        witness_info=payload.witness_info,
    )
    await fir_repo.create(fir)
    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=None,
        new_status=FIRStatus.SUBMITTED,
        changed_by=current_user.id,
        notes="FIR filed",
    ))
    return fir


@router.get("/my", response_model=List[FIRResponse])
async def get_my_firs(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    return await fir_repo.get_by_citizen(current_user.id, status_filter)


@router.get("/{fir_id}", response_model=FIRDetailResponse)
async def get_fir_detail(
    fir_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(get_current_user),
):
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    # Citizens can only view their own FIRs; officers/admins can view all
    if current_user.role == UserRole.CITIZEN and fir.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    history = [
        StatusHistoryItem.model_validate(h)
        for h in await history_repo.get_by_fir(fir_id)
    ]
    fir_data = FIRDetailResponse.model_validate(fir)
    fir_data.status_history = history
    return fir_data


@router.patch("/{fir_id}", response_model=FIRResponse)
async def update_fir(
    fir_id: str,
    payload: FIRUpdateRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    current_user: User = Depends(get_current_user),
):
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your FIR")
    if fir.status not in [FIRStatus.DRAFT, FIRStatus.SUBMITTED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit FIR in '{fir.status}' status",
        )
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(fir, field, value)
    fir.updated_at = datetime.utcnow()
    return await fir_repo.update(fir)


@router.post("/{fir_id}/cancel", response_model=FIRResponse)
async def cancel_fir(
    fir_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(get_current_user),
):
    fir = await fir_repo.get_by_id(fir_id)
    if not fir or fir.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")

    closeable = [FIRStatus.DRAFT, FIRStatus.SUBMITTED, FIRStatus.ACKNOWLEDGED]
    if fir.status not in closeable:
        raise HTTPException(
            status_code=400,
            detail="FIR can only be closed when it is in draft, submitted, or acknowledged status",
        )

    old_status = fir.status
    new_status = FIRStatus.REJECTED if old_status == FIRStatus.ACKNOWLEDGED else FIRStatus.CLOSED
    note = "Withdrawn by citizen" if new_status == FIRStatus.REJECTED else "Closed by citizen"

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


@router.post("/{fir_id}/reapply", response_model=FIRResponse, status_code=201)
@limiter.limit("10/minute")
async def reapply_fir(
    request: Request,
    fir_id: str,
    payload: ReapplyRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(get_current_user),
):
    original = await fir_repo.get_by_id(fir_id)
    if not original or original.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")
    if original.status != FIRStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Can only reapply for a rejected FIR")

    new_fir = FIR(
        fir_number=await fir_repo.generate_number(),
        citizen_id=current_user.id,
        station_id=original.station_id,
        incident_type=original.incident_type,
        description=payload.updated_description,
        incident_location=original.incident_location,
        incident_date=original.incident_date,
        incident_time=original.incident_time,
        complainant_name=original.complainant_name,
        complainant_father_name=original.complainant_father_name,
        complainant_address=original.complainant_address,
        complainant_phone=original.complainant_phone,
        witness_info=payload.additional_info or original.witness_info,
        reapplied_from_id=original.id,
        reapply_count=original.reapply_count + 1,
    )
    await fir_repo.create(new_fir)
    await history_repo.create(FIRStatusHistory(
        fir_id=new_fir.id,
        previous_status=None,
        new_status=FIRStatus.SUBMITTED,
        changed_by=current_user.id,
        notes="Reapplication",
    ))
    return new_fir


@router.post("/{fir_id}/escalate", response_model=FIRResponse)
async def escalate_fir(
    fir_id: str,
    payload: EscalationRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(get_current_user),
):
    fir = await fir_repo.get_by_id(fir_id)
    if not fir or fir.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")

    eligible = [FIRStatus.ACKNOWLEDGED, FIRStatus.UNDER_INVESTIGATION]
    if fir.status not in eligible:
        raise HTTPException(
            status_code=400,
            detail=f"Can only escalate an acknowledged or under-investigation FIR (current: {fir.status})",
        )

    old_status = fir.status
    fir.status = FIRStatus.ESCALATED
    fir.updated_at = datetime.utcnow()
    await fir_repo.update(fir)
    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=old_status,
        new_status=FIRStatus.ESCALATED,
        changed_by=current_user.id,
        notes=f"Escalated by citizen: {payload.reason}",
    ))
    return fir


# ── Officer routes ────────────────────────────────────────────────────────────

@router.post("/{fir_id}/acknowledge", response_model=FIRResponse)
async def acknowledge_fir(
    fir_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
):
    """Claim an unassigned FIR — sets officer_id so no other officer can pick it up."""
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.status != FIRStatus.SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail=f"FIR is not in submitted state (current: {fir.status})",
        )
    if fir.officer_id is not None:
        raise HTTPException(status_code=409, detail="FIR already claimed by another officer")

    old_status = fir.status
    fir.status = FIRStatus.ACKNOWLEDGED
    fir.officer_id = current_user.id
    fir.acknowledged_at = datetime.utcnow()
    fir.updated_at = datetime.utcnow()

    # Lock enrichment — citizen can no longer start or continue the AI interview.
    # Only mark expired if enrichment wasn't already complete.
    if fir.enrichment_status in (EnrichmentStatus.PENDING, EnrichmentStatus.IN_PROGRESS):
        fir.enrichment_status = EnrichmentStatus.EXPIRED

    await fir_repo.update(fir)
    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=old_status,
        new_status=FIRStatus.ACKNOWLEDGED,
        changed_by=current_user.id,
        notes="FIR acknowledged and claimed",
    ))
    return fir


@router.get("/station/unassigned", response_model=List[FIRResponse])
async def get_unassigned_firs(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
):
    """Submitted FIRs for this station not yet claimed by any officer — oldest first."""
    if not current_user.station_id:
        raise HTTPException(
            status_code=400,
            detail="Your account has no station assigned. Contact your admin.",
        )
    return await fir_repo.get_by_station_unassigned(current_user.station_id)


@router.get("/station/mine", response_model=List[FIRResponse])
async def get_my_assigned_firs(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    """FIRs assigned to the calling officer, optionally filtered by status."""
    return await fir_repo.get_by_officer(current_user.id, status_filter)


@router.get("/station/all", response_model=List[FIRResponse])
async def get_station_firs(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    return await fir_repo.get_by_station(current_user.station_id, status_filter)


@router.patch("/{fir_id}/status", response_model=FIRResponse)
async def update_fir_status(
    fir_id: str,
    payload: FIRStatusUpdateRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    history_repo: StatusHistoryRepository = Depends(get_history_repo),
    current_user: User = Depends(
        require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)
    ),
):
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    # Officers and station admins must follow the transition map
    if current_user.role in (UserRole.OFFICER, UserRole.STATION_ADMIN):
        allowed = VALID_TRANSITIONS.get(fir.status, [])
        if payload.new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot move FIR from '{fir.status}' to '{payload.new_status}'",
            )

    # Rejection always requires a written reason
    if payload.new_status == FIRStatus.REJECTED and not (payload.notes or "").strip():
        raise HTTPException(
            status_code=400,
            detail="A rejection reason is required and will be shown to the citizen",
        )

    old_status = fir.status
    fir.status = payload.new_status
    if payload.ipc_sections:
        fir.ipc_sections = payload.ipc_sections
    fir.updated_at = datetime.utcnow()
    await fir_repo.update(fir)
    await history_repo.create(FIRStatusHistory(
        fir_id=fir.id,
        previous_status=old_status,
        new_status=payload.new_status,
        changed_by=current_user.id,
        notes=payload.notes,
    ))
    return fir
