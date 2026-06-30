"""Shared dependencies: current-user resolution and CSRF enforcement."""
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.db.database import get_db
from app.db.models import User

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = security.decode_token(access_token, security.ACCESS_TOKEN)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user_id = int(payload["sub"])
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


async def csrf_protect(
    request: Request,
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE),
    x_csrf_token: str | None = Header(default=None, alias=CSRF_HEADER),
) -> None:
    """Double-submit CSRF check for state-changing requests."""
    if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
        return
    if not security.csrf_tokens_match(csrf_cookie, x_csrf_token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF validation failed")
