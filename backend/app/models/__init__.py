# Import all models here so Alembic and SQLModel can discover them
from app.models.user import User
from app.models.fir import FIR, FIRStatusHistory, Escalation, PoliceStation, ChatLog
from app.models.enums import UserRole, FIRStatus, EscalationStatus, IncidentType
