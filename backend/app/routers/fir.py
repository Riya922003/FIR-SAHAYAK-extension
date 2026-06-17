from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List, Optional
from datetime import datetime

from app.core.database import get_session
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.fir import FIR, FIRStatusHistory, Escalation
from app.models.enums import FIRStatus, UserRole
from app.schemas.fir import (
    FIRCreateRequest,
    FIRUpdateRequest,
    FIRStatusUpdateRequest,
    FIRResponse,
    FIRDetailResponse,
    EscalationRequest,
    EscalationResponse,
    ReapplyRequest,
    StatusHistoryItem,
)

router = APIRouter(prefix="/fir", tags=["FIR"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def generate_fir_number(session: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await session.exec(select(FIR))
    count = len(result.all()) + 1
    return f"FIR-{year}-{count:05d}"


async def log_status_change(
    session: AsyncSession,
    fir_id: str,
    previous: Optional[FIRStatus],
    new: FIRStatus,
    changed_by: str,
    notes: Optional[str] = None,
):
    history = FIRStatusHistory(
        fir_id=fir_id,
        previous_status=previous,
        new_status=new,
        changed_by=changed_by,
        notes=notes,
    )
    session.add(history)


# ── Citizen routes ────────────────────────────────────────────────────────────

@router.post("/", response_model=FIRResponse, status_code=201)
async def file_fir(
    payload: FIRCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    fir = FIR(
        fir_number=await generate_fir_number(session),
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
    session.add(fir)
    await session.flush()  # get fir.id before logging
    await log_status_change(session, fir.id, None, FIRStatus.SUBMITTED, current_user.id, "FIR filed")
    await session.commit()
    await session.refresh(fir)
    return fir


@router.get("/my", response_model=List[FIRResponse])
async def get_my_firs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    query = select(FIR).where(FIR.citizen_id == current_user.id)
    if status_filter:
        query = query.where(FIR.status == status_filter)
    result = await session.exec(query.order_by(FIR.created_at.desc()))
    return result.all()


@router.get("/{fir_id}", response_model=FIRDetailResponse)
async def get_fir_detail(
    fir_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    fir = await session.get(FIR, fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    # Citizens can only view their own FIRs; officers/admins can view all
    if current_user.role == UserRole.CITIZEN and fir.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    history_result = await session.exec(
        select(FIRStatusHistory)
        .where(FIRStatusHistory.fir_id == fir_id)
        .order_by(FIRStatusHistory.changed_at)
    )
    history = [StatusHistoryItem.model_validate(h) for h in history_result.all()]

    fir_data = FIRDetailResponse.model_validate(fir)
    fir_data.status_history = history
    return fir_data


@router.patch("/{fir_id}", response_model=FIRResponse)
async def update_fir(
    fir_id: str,
    payload: FIRUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    fir = await session.get(FIR, fir_id)
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

    session.add(fir)
    await session.commit()
    await session.refresh(fir)
    return fir


@router.post("/{fir_id}/cancel", response_model=FIRResponse)
async def cancel_fir(
    fir_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    fir = await session.get(FIR, fir_id)
    if not fir or fir.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")

    if fir.status not in [FIRStatus.SUBMITTED, FIRStatus.DRAFT]:
        raise HTTPException(
            status_code=400,
            detail="Can only cancel a submitted or draft FIR",
        )

    old_status = fir.status
    fir.status = FIRStatus.CLOSED
    fir.updated_at = datetime.utcnow()
    session.add(fir)
    await log_status_change(session, fir.id, old_status, FIRStatus.CLOSED, current_user.id, "Cancelled by citizen")
    await session.commit()
    await session.refresh(fir)
    return fir


@router.post("/{fir_id}/reapply", response_model=FIRResponse, status_code=201)
async def reapply_fir(
    fir_id: str,
    payload: ReapplyRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    original = await session.get(FIR, fir_id)
    if not original or original.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")

    if original.status != FIRStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Can only reapply for a rejected FIR")

    new_fir = FIR(
        fir_number=await generate_fir_number(session),
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
    session.add(new_fir)
    await session.flush()
    await log_status_change(session, new_fir.id, None, FIRStatus.SUBMITTED, current_user.id, "Reapplication")
    await session.commit()
    await session.refresh(new_fir)
    return new_fir


@router.post("/{fir_id}/escalate", response_model=EscalationResponse, status_code=201)
async def escalate_fir(
    fir_id: str,
    payload: EscalationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    fir = await session.get(FIR, fir_id)
    if not fir or fir.citizen_id != current_user.id:
        raise HTTPException(status_code=404, detail="FIR not found")

    if fir.status in [FIRStatus.RESOLVED, FIRStatus.CLOSED]:
        raise HTTPException(status_code=400, detail="Cannot escalate a resolved or closed FIR")

    escalation = Escalation(
        fir_id=fir.id,
        escalated_by=current_user.id,
        escalated_to=payload.escalated_to,
        reason=payload.reason,
    )
    session.add(escalation)

    old_status = fir.status
    fir.status = FIRStatus.ESCALATED
    fir.updated_at = datetime.utcnow()
    session.add(fir)
    await log_status_change(session, fir.id, old_status, FIRStatus.ESCALATED, current_user.id, payload.reason)
    await session.commit()
    await session.refresh(escalation)
    return escalation


# ── Officer routes ────────────────────────────────────────────────────────────

# Valid status transitions an officer can make (enforced server-side)
VALID_TRANSITIONS: dict = {
    FIRStatus.ACKNOWLEDGED:       [FIRStatus.UNDER_INVESTIGATION],
    FIRStatus.UNDER_INVESTIGATION:[FIRStatus.RESOLVED, FIRStatus.REJECTED],
}


@router.post("/{fir_id}/acknowledge", response_model=FIRResponse)
async def acknowledge_fir(
    fir_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
):
    """Claim an unassigned FIR — sets officer_id so no other officer can pick it up."""
    fir = await session.get(FIR, fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.status != FIRStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail=f"FIR is not in submitted state (current: {fir.status})")
    if fir.officer_id is not None:
        raise HTTPException(status_code=409, detail="FIR already claimed by another officer")

    old_status = fir.status
    fir.status = FIRStatus.ACKNOWLEDGED
    fir.officer_id = current_user.id
    fir.acknowledged_at = datetime.utcnow()
    fir.updated_at = datetime.utcnow()
    session.add(fir)
    await log_status_change(session, fir.id, old_status, FIRStatus.ACKNOWLEDGED, current_user.id, "FIR acknowledged and claimed")
    await session.commit()
    await session.refresh(fir)
    return fir


@router.get("/station/unassigned", response_model=List[FIRResponse])
async def get_unassigned_firs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
):
    """Submitted FIRs for this station not yet claimed by any officer — oldest first."""
    if not current_user.station_id:
        raise HTTPException(status_code=400, detail="Your account has no station assigned. Contact your admin.")
    query = (
        select(FIR)
        .where(FIR.station_id == current_user.station_id)
        .where(FIR.status == FIRStatus.SUBMITTED)
        .where(FIR.officer_id.is_(None))
        .order_by(FIR.created_at.asc())
    )
    result = await session.exec(query)
    return result.all()


@router.get("/station/mine", response_model=List[FIRResponse])
async def get_my_assigned_firs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    """FIRs assigned to the calling officer, optionally filtered by status."""
    query = select(FIR).where(FIR.officer_id == current_user.id)
    if status_filter:
        query = query.where(FIR.status == status_filter)
    result = await session.exec(query.order_by(FIR.updated_at.desc()))
    return result.all()


@router.get("/station/all", response_model=List[FIRResponse])
async def get_station_firs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN)),
    status_filter: Optional[FIRStatus] = Query(default=None),
):
    query = select(FIR).where(FIR.station_id == current_user.station_id)
    if status_filter:
        query = query.where(FIR.status == status_filter)
    result = await session.exec(query.order_by(FIR.created_at.desc()))
    return result.all()


@router.patch("/{fir_id}/status", response_model=FIRResponse)
async def update_fir_status(
    fir_id: str,
    payload: FIRStatusUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(
        require_roles(UserRole.OFFICER, UserRole.STATION_ADMIN, UserRole.HIGHER_AUTHORITY)
    ),
):
    fir = await session.get(FIR, fir_id)
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
        raise HTTPException(status_code=400, detail="A rejection reason is required and will be shown to the citizen")

    old_status = fir.status
    fir.status = payload.new_status
    if payload.ipc_sections:
        fir.ipc_sections = payload.ipc_sections
    fir.updated_at = datetime.utcnow()
    session.add(fir)
    await log_status_change(session, fir.id, old_status, payload.new_status, current_user.id, payload.notes)
    await session.commit()
    await session.refresh(fir)
    return fir
