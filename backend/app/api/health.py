"""Health / status endpoints surfaced to the frontend.

Reports whether the backend, DB and the *egress path* (direct / proxy / relay)
are online, so the UI can show a live indicator.
"""
import time

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.http import outbound_client
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/api/health", tags=["health"])

# Small cache so frequent UI polls don't hammer the egress path.
_CACHE_TTL = 10.0
_egress_cache: dict[str, object] = {"at": 0.0, "value": None}

# A tiny, reliable resource to prove the egress path actually works.
_PROBE_URL = "https://export.arxiv.org/robots.txt"


async def _check_proxy_or_direct(mode: str) -> dict:
    """Do a lightweight fetch through the current egress path."""
    try:
        async with outbound_client(follow_redirects=True) as client:
            resp = await client.get(_PROBE_URL, timeout=6)
        return {
            "mode": mode,
            "online": True,
            "detail": f"reachable (HTTP {resp.status_code})",
        }
    except Exception as e:  # noqa: BLE001
        label = "proxy" if mode == "proxy" else "network"
        return {"mode": mode, "online": False, "detail": f"{label} unreachable: {type(e).__name__}"}


async def _check_relay() -> dict:
    if not settings.RELAY_URL:
        return {"mode": "relay", "online": False, "detail": "RELAY_URL not set"}
    url = settings.RELAY_URL.rstrip("/") + "/status"
    headers = {"Authorization": f"Bearer {settings.RELAY_CLIENT_TOKEN or ''}"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=6)
        if resp.status_code == 401:
            return {"mode": "relay", "online": False, "detail": "relay rejected token (401)"}
        resp.raise_for_status()
        data = resp.json()
        agent_online = bool(data.get("agent_online"))
        return {
            "mode": "relay",
            "online": agent_online,
            "detail": "agent online" if agent_online else "relay up, agent offline",
            "agent_online": agent_online,
            "pending_jobs": data.get("pending_jobs"),
        }
    except Exception as e:  # noqa: BLE001
        return {"mode": "relay", "online": False, "detail": f"relay unreachable: {type(e).__name__}"}


async def _egress_status() -> dict:
    now = time.monotonic()
    cached = _egress_cache["value"]
    if cached is not None and (now - float(_egress_cache["at"])) < _CACHE_TTL:
        return cached  # type: ignore[return-value]

    mode = settings.resolved_fetch_mode()
    if mode == "relay":
        result = await _check_relay()
    elif mode == "direct":
        result = {"mode": "direct", "online": True, "detail": "direct connection"}
    else:  # proxy
        result = await _check_proxy_or_direct(mode)

    _egress_cache["at"] = now
    _egress_cache["value"] = result
    return result


@router.get("/status")
async def status(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False

    egress = await _egress_status()
    overall = db_ok and bool(egress.get("online"))
    return {
        "online": overall,
        "backend": True,
        "db": db_ok,
        "egress": egress,
    }
