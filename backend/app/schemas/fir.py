from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.enums import FIRStatus, IncidentType, EscalationStatus


# ── FIR Request schemas ───────────────────────────────────────────────────────

class FIRCreateRequest(BaseModel):
    station_id: str
    incident_type: IncidentType
    description: str = Field(min_length=50, description="Minimum 50 chars for a valid complaint")
    incident_location: str
    incident_date: date
    incident_time: Optional[str] = None
    complainant_name: str
    complainant_father_name: Optional[str] = None
    complainant_address: str
    complainant_phone: str = Field(pattern=r"^\d{10}$")
    witness_info: Optional[str] = None
    ai_interview_summary: Optional[str] = None
    suggested_ipc_sections: Optional[str] = None


class FIRUpdateRequest(BaseModel):
    """Citizens can update only while status is DRAFT or SUBMITTED."""
    description: Optional[str] = Field(default=None, min_length=50)
    incident_location: Optional[str] = None
    incident_date: Optional[date] = None
    incident_time: Optional[str] = None
    witness_info: Optional[str] = None


class FIRStatusUpdateRequest(BaseModel):
    """Officers/admins use this to move the FIR through its lifecycle."""
    new_status: FIRStatus
    notes: Optional[str] = None
    ipc_sections: Optional[str] = None


class EscalationRequest(BaseModel):
    reason: str = Field(min_length=30, description="Reason must be at least 30 characters")


class ReapplyRequest(BaseModel):
    """Citizen submits a revised description when reapplying after rejection."""
    updated_description: str = Field(min_length=50)
    additional_info: Optional[str] = None


# ── FIR Response schemas ──────────────────────────────────────────────────────

class StatusHistoryItem(BaseModel):
    previous_status: Optional[FIRStatus]
    new_status: FIRStatus
    notes: Optional[str]
    changed_at: datetime
    changed_by: str  # user id — frontend resolves to name

    class Config:
        from_attributes = True


class FIRResponse(BaseModel):
    id: str
    fir_number: str
    citizen_id: str
    officer_id: Optional[str]
    station_id: str
    status: FIRStatus
    incident_type: IncidentType
    ipc_sections: Optional[str]
    description: str
    incident_location: str
    incident_date: date
    incident_time: Optional[str]
    complainant_name: str
    complainant_address: str
    complainant_phone: str
    witness_info: Optional[str]
    ai_interview_summary: Optional[str] = None
    suggested_ipc_sections: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    reapply_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FIRDetailResponse(FIRResponse):
    """Full response including status history — used on detail page."""
    status_history: List[StatusHistoryItem] = []


class EscalationResponse(BaseModel):
    id: str
    fir_id: str
    escalated_by: str
    escalated_to: Optional[str] = None
    reason: str
    status: EscalationStatus
    resolution_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
