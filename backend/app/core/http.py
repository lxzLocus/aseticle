"""Factory for outbound HTTP clients.

Paper-fetching requests (arXiv, Semantic Scholar, SerpApi, publisher pages) are
routed through the forward-proxy daemon when ``OUTBOUND_PROXY_URL`` is set, so
they can egress from a network that reaches paywalled venues. When it is unset
the client connects directly.

Note: the LLM translator intentionally does NOT use this — a user's own endpoint
(e.g. a local LM Studio) must not be forced through the paper proxy.
"""
import httpx

from app.core.config import settings


def outbound_client(**kwargs) -> httpx.AsyncClient:
    proxy = settings.OUTBOUND_PROXY_URL or None
    if proxy and "proxy" not in kwargs:
        kwargs["proxy"] = proxy
    return httpx.AsyncClient(**kwargs)
