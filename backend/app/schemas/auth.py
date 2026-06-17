from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models.enums import UserRole


class StationSetRequest(BaseModel):
    station_id: str


class DistrictSetRequest(BaseModel):
    district: str = Field(min_length=2, max_length=100)


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    full_name: str
    phone: str = Field(pattern=r"^\d{10}$")
    aadhar_number: str = Field(pattern=r"^\d{12}$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Response schemas ──────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    phone: str
    role: UserRole
    is_active: bool
    station_id: Optional[str] = None
    district: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
