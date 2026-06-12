import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from app.models.enums import UserRole


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )
    email: str = Field(unique=True, index=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str
    phone: str
    aadhar_number: str = Field(unique=True)

    role: UserRole = Field(default=UserRole.CITIZEN)
    is_active: bool = Field(default=True)

    # For officers — which station they belong to (FK set in fir.py to avoid circular import)
    station_id: Optional[str] = Field(default=None, foreign_key="police_stations.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
