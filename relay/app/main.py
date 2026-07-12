"""ASEticle relay — a rendezvous hub for the phone-home fetch daemon.

Both sides connect *outbound* to this relay, so the daemon can live inside a
restricted network (no inbound, no port-forwarding):

    backend  ──POST /fetch────────▶  relay  ◀──GET /agent/next (long-poll)──  agent (daemon)
             ◀──result──────────────       ──────────POST /agent/result──────▶

Auth is by bearer token — a *client* token (backend↔relay) and a separate
*agent* token (daemon↔relay). Nothing is open to the public.

State is in-memory, so run a single relay instance. For a serverless/multi-
instance deployment (e.g. Vercel), back the queues with a shared store
(Vercel KV / Redis) instead — the HTTP contract stays the same.
"""
import asyncio
import base64
import os
import secrets
import time
import uuid
from contextlib import suppress

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel

# --- config ---------------------------------------------------------------
CLIENT_TOKEN = os.environ.get("RELAY_CLIENT_TOKEN", "")
AGENT_TOKEN = os.environ.get("RELAY_AGENT_TOKEN", "")
# how long a client waits for the agent to return a result
CLIENT_WAIT_SECONDS = float(os.environ.get("RELAY_CLIENT_WAIT_SECONDS", "35"))
# how long an agent long-poll blocks before returning "no job"
AGENT_POLL_SECONDS = float(os.environ.get("RELAY_AGENT_POLL_SECONDS", "25"))
# consider the agent offline if it hasn't polled within this window
AGENT_STALE_SECONDS = float(os.environ.get("RELAY_AGENT_STALE_SECONDS", "40"))
MAX_BODY_BYTES = int(os.environ.get("RELAY_MAX_BODY_BYTES", str(20 * 1024 * 1024)))


# --- models ---------------------------------------------------------------
class FetchRequest(BaseModel):
    method: str = "GET"
    url: str
    headers: dict[str, str] = {}
    body_b64: str | None = None
    timeout: float = 30.0


class FetchResult(BaseModel):
    job_id: str
    status_code: int | None = None
    headers: dict[str, str] = {}
    body_b64: str | None = None
    error: str | None = None


# --- in-memory state ------------------------------------------------------
class Job:
    __slots__ = ("id", "request", "future")

    def __init__(self, req: FetchRequest):
        self.id = uuid.uuid4().hex
        self.request = req
        self.future: asyncio.Future[FetchResult] = asyncio.get_event_loop().create_future()


pending: asyncio.Queue[Job] = asyncio.Queue()
results: dict[str, asyncio.Future] = {}
_agent_last_seen: float = 0.0


def _monotonic() -> float:
    return time.monotonic()


app = FastAPI(title="ASEticle Relay")


# --- auth -----------------------------------------------------------------
def _check(token_env: str, authorization: str | None) -> None:
    if not token_env:
        # misconfiguration: refuse rather than run open
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Relay token not configured")
    presented = ""
    if authorization and authorization.lower().startswith("bearer "):
        presented = authorization[7:]
    if not secrets.compare_digest(presented, token_env):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


async def require_client(authorization: str | None = Header(default=None)) -> None:
    _check(CLIENT_TOKEN, authorization)


async def require_agent(authorization: str | None = Header(default=None)) -> None:
    _check(AGENT_TOKEN, authorization)


def _agent_online() -> bool:
    return (_monotonic() - _agent_last_seen) < AGENT_STALE_SECONDS


# --- health / status ------------------------------------------------------
@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/status", dependencies=[Depends(require_client)])
def relay_status():
    return {
        "agent_online": _agent_online(),
        "pending_jobs": pending.qsize(),
    }


# --- client side ----------------------------------------------------------
@app.post("/fetch", response_model=FetchResult, dependencies=[Depends(require_client)])
async def fetch(req: FetchRequest):
    if not _agent_online():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No agent connected")

    job = Job(req)
    results[job.id] = job.future
    await pending.put(job)

    try:
        result = await asyncio.wait_for(job.future, timeout=CLIENT_WAIT_SECONDS)
    except asyncio.TimeoutError:
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, "Agent did not respond in time")
    finally:
        results.pop(job.id, None)
    return result


# --- agent side -----------------------------------------------------------
@app.get("/agent/next", dependencies=[Depends(require_agent)])
async def agent_next():
    """Long-poll: return the next job, or 204 if none within the window."""
    global _agent_last_seen
    _agent_last_seen = _monotonic()
    try:
        job = await asyncio.wait_for(pending.get(), timeout=AGENT_POLL_SECONDS)
    except asyncio.TimeoutError:
        _agent_last_seen = _monotonic()
        return {"job": None}

    return {
        "job": {
            "id": job.id,
            "method": job.request.method,
            "url": job.request.url,
            "headers": job.request.headers,
            "body_b64": job.request.body_b64,
            "timeout": job.request.timeout,
        }
    }


@app.post("/agent/result", dependencies=[Depends(require_agent)])
async def agent_result(result: FetchResult):
    global _agent_last_seen
    _agent_last_seen = _monotonic()

    if result.body_b64:
        # guard against oversized payloads
        approx = len(result.body_b64) * 3 // 4
        if approx > MAX_BODY_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Body too large")

    fut = results.get(result.job_id)
    if fut is None:
        # client already gave up / unknown job
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown or expired job")
    if not fut.done():
        fut.set_result(result)
    return {"ok": True}


@app.on_event("shutdown")
async def _drain():
    # fail any in-flight clients cleanly
    for fut in list(results.values()):
        if not fut.done():
            with suppress(Exception):
                fut.cancel()
