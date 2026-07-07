"""Citation/venue enrichment via the free Semantic Scholar Graph API."""
import asyncio

import httpx

from app.core.http import outbound_client

S2_BASE = "https://api.semanticscholar.org/graph/v1"
_FIELDS = "citationCount,venue"


async def fetch_by_arxiv_id(client: httpx.AsyncClient, arxiv_id: str) -> tuple[int | None, str | None]:
    """Return (citation_count, venue) for an arXiv paper, or (None, None)."""
    try:
        resp = await client.get(
            f"{S2_BASE}/paper/arXiv:{arxiv_id}",
            params={"fields": _FIELDS},
            timeout=15,
        )
        if resp.status_code != 200:
            return None, None
        data = resp.json()
        return data.get("citationCount"), (data.get("venue") or None)
    except (httpx.HTTPError, ValueError):
        return None, None


async def enrich_arxiv(papers: list[dict]) -> None:
    """Mutate papers in place, filling cite_num / conference where possible.

    Semantic Scholar is unauthenticated here (rate-limited), so requests are
    issued with limited concurrency and failures degrade gracefully.
    """
    sem = asyncio.Semaphore(3)

    async with outbound_client() as client:
        async def _one(p: dict) -> None:
            arxiv_id = p.get("_arxiv_id")
            if not arxiv_id:
                return
            async with sem:
                cites, venue = await fetch_by_arxiv_id(client, arxiv_id)
            if cites is not None:
                p["cite_num"] = cites
            if venue and not p.get("conference"):
                p["conference"] = venue

        await asyncio.gather(*(_one(p) for p in papers))
