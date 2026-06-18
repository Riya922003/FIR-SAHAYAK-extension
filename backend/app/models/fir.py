import uuid
from datetime import datetime, date, time
from typing import Optional
from sqlmodel import SQLModel, Field
from app.models.enums import FIRStatus, EscalationStatus, IncidentType


class PoliceStation(SQLModel, table=True):
    __tablename__ = "police_stations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    district: str
    state: str = Field(default="Maharashtra")
    address: str
    phone: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class FIR(SQLModel, table=True):
    __tablename__ = "firs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    # Auto-generated FIR number e.g. FIR-2025-00042
    fir_number: str = Field(unique=True, index=True)

    # Relations
    citizen_id: str = Field(foreign_key="users.id", index=True)
    officer_id: Optional[str] = Field(default=None, foreign_key="users.id")
    station_id: str = Field(foreign_key="police_stations.id")

    # FIR Details
    status: FIRStatus = Field(default=FIRStatus.SUBMITTED)
    incident_type: IncidentType
    ipc_sections: Optional[str] = None          # comma-separated e.g. "302, 307"
    description: str
    incident_location: str
    incident_date: date
    incident_time: Optional[str] = None

    # Complainant info (may differ from logged-in user)
    complainant_name: str
    complainant_father_name: Optional[str] = None
    complainant_address: str
    complainant_phone: str

    # Witness
    witness_info: Optional[str] = None

    # AI interview summary (generated during filing, visible to officer)
    ai_interview_summary: Optional[str] = None
    # AI-suggested IPC sections (citizen-accepted during filing)
    suggested_ipc_sections: Optional[str] = None

    # Internal notes (officer only)
    officer_notes: Optional[str] = None

    acknowledged_at: Optional[datetime] = Field(default=None)

    # Reapplication tracking
    reapplied_from_id: Optional[str] = Field(default=None, foreign_key="firs.id")
    reapply_count: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FIRStatusHistory(SQLModel, table=True):
    """Every status change is logged here — gives citizens a full timeline."""
    __tablename__ = "fir_status_history"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    fir_id: str = Field(foreign_key="firs.id", index=True)
    previous_status: Optional[FIRStatus] = None
    new_status: FIRStatus
    changed_by: str = Field(foreign_key="users.id")   # user who triggered the change
    notes: Optional[str] = None                        # officer/admin note on the change
    changed_at: datetime = Field(default_factory=datetime.utcnow)


class Escalation(SQLModel, table=True):
    __tablename__ = "escalations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    fir_id: str = Field(foreign_key="firs.id", index=True)
    escalated_by: str = Field(foreign_key="users.id")   # citizen or officer
    escalated_to: str = Field(foreign_key="users.id")   # higher authority user
    reason: str
    status: EscalationStatus = Field(default=EscalationStatus.PENDING)
    resolution_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None


class ChatLog(SQLModel, table=True):
    """Stores Gemini AI conversation history per user session."""
    __tablename__ = "chat_logs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    user_message: str
    bot_response: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
