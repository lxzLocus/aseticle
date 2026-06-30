from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    csrf_protect,
    get_current_user,
)
from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth import LoginRequest, MessageOut, RegisterRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        search_source=user.search_source,
        has_llm_key=bool(user.llm_api_key_enc),
        llm_base_url=user.llm_base_url,
        llm_model=user.llm_model,
        has_serpapi_key=bool(user.serpapi_key_enc),
    )


def _set_auth_cookies(response: Response, user_id: int) -> None:
    access = security.create_access_token(user_id)
    refresh = security.create_refresh_token(user_id)
    csrf = security.generate_csrf_token()

    common = {
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
        "domain": settings.COOKIE_DOMAIN,
    }
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/auth",
        **common,
    )
    # CSRF token is readable by JS (double-submit pattern)
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
        **common,
    )


def _clear_auth_cookies(response: Response) -> None:
    for name, path in (
        (ACCESS_COOKIE, "/"),
        (REFRESH_COOKIE, "/api/auth"),
        (CSRF_COOKIE, "/"),
    ):
        response.delete_cookie(name, path=path, domain=settings.COOKIE_DOMAIN)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = User(
        email=body.email,
        username=body.username,
        hashed_password=security.hash_password(body.password),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already in use")
    await db.refresh(user)
    _set_auth_cookies(response, user.id)
    return _user_out(user)


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(
            or_(User.email == body.identifier, User.username == body.identifier)
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not security.verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    _set_auth_cookies(response, user.id)
    return _user_out(user)


@router.post("/refresh", response_model=MessageOut, dependencies=[Depends(csrf_protect)])
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh token")
    try:
        payload = security.decode_token(refresh_token, security.REFRESH_TOKEN)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    user = await db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    _set_auth_cookies(response, user.id)
    return MessageOut(message="refreshed")


@router.post("/logout", response_model=MessageOut, dependencies=[Depends(csrf_protect)])
async def logout(response: Response):
    _clear_auth_cookies(response)
    return MessageOut(message="logged out")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)
