"""Optional Google Scholar retrieval via SerpApi (requires a user/global key).

This covers paywalled venues (IEEE, ACM, ScienceDirect) at the metadata level
without fragile HTML scraping. Deep full-text remains behind publisher paywalls
for general users; arXiv links found here are still freely accessible.
"""
import re

import httpx

SERPAPI_URL = "https://serpapi.com/search"

_ALLOWED = {
    "arxiv.org": "arxiv",
    "dl.acm.org": "acm",
    "ieeexplore.ieee.org": "ieee",
    "sciencedirect.com": "sciencedirect",
}


def _source_for(link: str) -> str:
    for domain, name in _ALLOWED.items():
        if domain in link:
            return name
    return "scholar"


async def search(query: str, api_key: str, max_results: int = 30) -> list[dict]:
    params = {
        "engine": "google_scholar",
        "q": query,
        "api_key": api_key,
        "num": min(max_results, 20),
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(SERPAPI_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

    if "error" in data:
        raise RuntimeError(data["error"])

    papers: list[dict] = []
    for idx, entry in enumerate(data.get("organic_results", [])):
        link = entry.get("link")
        if not link or "/pdf/" in link:
            continue
        pub = entry.get("publication_info", {})
        cited_by = entry.get("inline_links", {}).get("cited_by", {})
        papers.append(
            {
                "url": link,
                "title": entry.get("title", ""),
                "author": pub.get("summary"),
                "conference": None,
                "pages": None,
                "date": _year_from(pub.get("summary", "")),
                "abstract": entry.get("snippet"),
                "cite_num": cited_by.get("total"),
                "submitted": True,
                "relevant_no": idx,
                "source": _source_for(link),
            }
        )
    return papers


def _year_from(summary: str) -> str | None:
    m = re.search(r"(19|20)\d{2}", summary or "")
    if m:
        return m.group(0)[2:] + "0101"  # YY0101 placeholder (only year is known)
    return None
