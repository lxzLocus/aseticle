"""ASEticle phone-home fetch agent (the "proxy daemon").

Runs inside a restricted network (e.g. a university network). It makes only
*outbound* connections to the relay — no inbound ports, no port-forwarding —
long-polls for fetch jobs, performs each fetch from within the local network
(optionally via a local upstream proxy such as tinyproxy), and posts the result
back.

Everything is configured via environment variables so it can run on a separate
machine or be reached over a Tailscale mesh by pointing RELAY_URL at it.
"""
import asyncio
import base64
import os
import sys

import httpx

RELAY_URL = os.environ.get("RELAY_URL", "http://localhost:8080").rstrip("/")
AGENT_TOKEN = os.environ.get("RELAY_AGENT_TOKEN", "")
# Optional local upstream proxy the agent uses for its own fetches.
AGENT_UPSTREAM_PROXY = os.environ.get("AGENT_UPSTREAM_PROXY") or None
# Backoff when the relay is unreachable.
RECONNECT_MIN = float(os.environ.get("AGENT_RECONNECT_MIN", "2"))
RECONNECT_MAX = float(os.environ.get("AGENT_RECONNECT_MAX", "30"))
FETCH_MAX_BYTES = int(os.environ.get("AGENT_FETCH_MAX_BYTES", str(20 * 1024 * 1024)))

_auth = {"Authorization": f"Bearer {AGENT_TOKEN}"}


def log(msg: str) -> None:
    print(f"[agent] {msg}", flush=True)


async def do_fetch(job: dict) -> dict:
    """Execute one fetch job and return a result payload for the relay."""
    result: dict = {"job_id": job["id"], "headers": {}}
    body_b64 = job.get("body_b64")
    content = base64.b64decode(body_b64) if body_b64 else None
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, proxy=AGENT_UPSTREAM_PROXY
        ) as client:
            resp = await client.request(
                job.get("method", "GET"),
                job["url"],
                headers=job.get("headers") or {},
                content=content,
                timeout=job.get("timeout", 30.0),
            )
            data = resp.content
            if len(data) > FETCH_MAX_BYTES:
                result["error"] = f"Response too large ({len(data)} bytes)"
                return result
            result["status_code"] = resp.status_code
            # Only forward content-type; the body is httpx's decoded content, so
            # a forwarded content-length could mismatch and confuse the client.
            ct = resp.headers.get("content-type")
            result["headers"] = {"content-type": ct} if ct else {}
            result["body_b64"] = base64.b64encode(data).decode()
    except Exception as e:  # noqa: BLE001 - report any failure back to the client
        result["error"] = f"{type(e).__name__}: {e}"
    return result


async def run() -> None:
    if not AGENT_TOKEN:
        log("RELAY_AGENT_TOKEN is not set; refusing to start.")
        sys.exit(1)

    log(f"connecting to relay {RELAY_URL} (upstream proxy: {AGENT_UPSTREAM_PROXY or 'none'})")
    backoff = RECONNECT_MIN

    while True:
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                # long-poll loop
                while True:
                    resp = await client.get(
                        f"{RELAY_URL}/agent/next", headers=_auth, timeout=60
                    )
                    if resp.status_code == 401:
                        log("relay rejected agent token (401). Check RELAY_AGENT_TOKEN.")
                        await asyncio.sleep(RECONNECT_MAX)
                        continue
                    resp.raise_for_status()
                    backoff = RECONNECT_MIN  # healthy connection

                    job = resp.json().get("job")
                    if not job:
                        continue  # poll timed out with no work; poll again

                    log(f"job {job['id'][:8]} -> {job.get('method','GET')} {job['url'][:80]}")
                    result = await do_fetch(job)
                    r = await client.post(
                        f"{RELAY_URL}/agent/result", headers=_auth, json=result, timeout=60
                    )
                    if r.status_code >= 400:
                        log(f"result post failed ({r.status_code}): {r.text[:200]}")
        except (httpx.HTTPError, OSError) as e:
            log(f"relay connection error: {type(e).__name__}: {e}; retrying in {backoff:.0f}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, RECONNECT_MAX)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
