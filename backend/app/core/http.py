"""Factory for outbound HTTP clients used for paper-fetching.

Three egress modes, selected by ``settings.resolved_fetch_mode()``:

* ``direct`` — connect straight out.
* ``proxy``  — via ``OUTBOUND_PROXY_URL`` (a forward proxy such as the bundled
  tinyproxy, reachable directly or over a Tailscale mesh).
* ``relay``  — tunnel each request through the phone-home relay to an agent
  daemon running inside a restricted network. Implemented as a custom httpx
  transport so callers keep using a normal ``AsyncClient``/``.get()``.

The LLM translator does NOT use this — a user's own endpoint (e.g. local LM
Studio) must not be forced through the paper egress path.
"""
import base64

import httpx

from app.core.config import settings


class RelayTransport(httpx.AsyncBaseTransport):
    """Sends each request to the relay's /fetch endpoint; the agent performs the
    actual fetch and returns the response. Falls back to a direct request when
    the relay/agent is unavailable and RELAY_FALLBACK_DIRECT is enabled."""

    def __init__(self) -> None:
        self._relay = settings.RELAY_URL.rstrip("/") if settings.RELAY_URL else ""
        self._token = settings.RELAY_CLIENT_TOKEN or ""
        self._fallback = settings.RELAY_FALLBACK_DIRECT

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        body = request.content or b""
        payload = {
            "method": request.method,
            "url": str(request.url),
            "headers": {k: v for k, v in request.headers.items() if k.lower() != "host"},
            "body_b64": base64.b64encode(body).decode() if body else None,
            "timeout": 30.0,
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self._relay}/fetch",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._token}"},
                    timeout=45,
                )
            if resp.status_code >= 400:
                raise httpx.HTTPError(
                    f"relay returned {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
            if data.get("error"):
                raise httpx.HTTPError(f"agent fetch error: {data['error']}")

            content = base64.b64decode(data["body_b64"]) if data.get("body_b64") else b""
            return httpx.Response(
                status_code=data.get("status_code") or 502,
                headers=data.get("headers") or {},
                content=content,
                request=request,
            )
        except Exception as exc:  # noqa: BLE001
            if self._fallback:
                async with httpx.AsyncClient(follow_redirects=True) as direct:
                    return await direct.send(request)
            raise httpx.ConnectError(f"relay unavailable: {exc}", request=request)


def outbound_client(**kwargs) -> httpx.AsyncClient:
    mode = settings.resolved_fetch_mode()

    if mode == "relay" and settings.RELAY_URL:
        kwargs.setdefault("transport", RelayTransport())
    elif mode == "proxy" and settings.OUTBOUND_PROXY_URL:
        kwargs.setdefault("proxy", settings.OUTBOUND_PROXY_URL)
    # mode == "direct": plain client

    return httpx.AsyncClient(**kwargs)
