from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.limiter import limiter
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.models.user import User
from app.models.enums import UserRole
from app.repositories import get_user_repo, get_station_repo
from app.repositories.user_repository import UserRepository
from app.repositories.station_repository import StationRepository
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    RefreshTokenRequest,
    StationSetRequest,
    DistrictSetRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute;10/hour")
async def register(
    request: Request,
    payload: RegisterRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    if await user_repo.exists_duplicate(payload.email, payload.username, payload.aadhar_number):
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
    return await user_repo.create(user)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute;20/hour")
async def login(
    request: Request,
    payload: LoginRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    user = await user_repo.get_by_email(payload.email)
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
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    payload: RefreshTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await user_repo.get_by_id(data["sub"])
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


@router.patch("/me/district", response_model=UserResponse)
@limiter.limit("5/minute")
async def set_my_district(
    request: Request,
    payload: DistrictSetRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    current_user: User = Depends(get_current_user),
):
    """Higher authority sets their district scope on first login. Locked once set."""
    if current_user.role != UserRole.HIGHER_AUTHORITY:
        raise HTTPException(status_code=403, detail="Only higher authority users can set a district")
    if current_user.district is not None:
        raise HTTPException(status_code=400, detail="District already set. Contact admin to change it.")
    current_user.district = payload.district.strip()
    return await user_repo.update(current_user)


@router.patch("/me/station", response_model=UserResponse)
@limiter.limit("5/minute")
async def set_my_station(
    request: Request,
    payload: StationSetRequest,
    user_repo: UserRepository = Depends(get_user_repo),
    station_repo: StationRepository = Depends(get_station_repo),
    current_user: User = Depends(get_current_user),
):
    """Officer sets their own station on first login. Blocked once station_id is already set."""
    if current_user.station_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Station already assigned. Contact your admin to change it.",
        )
    station = await station_repo.get_by_id(payload.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    current_user.station_id = payload.station_id
    return await user_repo.update(current_user)
