from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.models.user import User
from app.models.fir import PoliceStation
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    RefreshTokenRequest,
    StationSetRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_session)):
    # Check duplicates
    existing = await session.exec(
        select(User).where(
            (User.email == payload.email) |
            (User.username == payload.username) |
            (User.aadhar_number == payload.aadhar_number)
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email, username, or Aadhar number already registered",
        )

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        aadhar_number=payload.aadhar_number,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.exec(select(User).where(User.email == payload.email))
    user = result.first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token_data = {"sub": user.id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    session: AsyncSession = Depends(get_session),
):
    data = decode_token(payload.refresh_token)

    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await session.exec(select(User).where(User.id == data["sub"]))
    user = result.first()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": user.id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/station", response_model=UserResponse)
async def set_my_station(
    payload: StationSetRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Officer sets their own station on first login. Blocked once station_id is already set."""
    if current_user.station_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Station already assigned. Contact your admin to change it.",
        )
    station = await session.get(PoliceStation, payload.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    current_user.station_id = payload.station_id
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user
