"""Paper retrieval via the official arXiv API (free, no key, no scraping).

Docs: https://info.arxiv.org/help/api/user-manual.html
Returns an Atom feed parsed with feedparser.
"""
import re
from datetime import datetime

import feedparser

from app.core.http import outbound_client

ARXIV_API = "https://export.arxiv.org/api/query"

_ABS_ID_RE = re.compile(r"arxiv\.org/abs/([^v\s]+)(?:v\d+)?", re.IGNORECASE)


def _extract_arxiv_id(entry_id: str) -> str | None:
    m = _ABS_ID_RE.search(entry_id or "")
    if m:
        return m.group(1)
    return None


def _format_date(published: str | None) -> str | None:
    # arXiv published like "2024-01-15T18:00:00Z" -> YYMMDD
    if not published:
        return None
    try:
        dt = datetime.strptime(published[:10], "%Y-%m-%d")
        return dt.strftime("%y%m%d")
    except ValueError:
        return None


async def search(query: str, max_results: int = 30) -> list[dict]:
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    async with outbound_client(follow_redirects=True) as client:
        resp = await client.get(ARXIV_API, params=params, timeout=30)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)

    papers: list[dict] = []
    for idx, entry in enumerate(feed.entries):
        abs_url = entry.get("id", "")
        arxiv_id = _extract_arxiv_id(abs_url)
        authors = ", ".join(a.get("name", "") for a in entry.get("authors", []))
        # abstract/title come with newlines collapsed
        title = re.sub(r"\s+", " ", entry.get("title", "")).strip()
        abstract = re.sub(r"\s+", " ", entry.get("summary", "")).strip()

        # page count is not provided by the API; comment field sometimes has it
        pages = None
        comment = entry.get("arxiv_comment", "") or ""
        m = re.search(r"(\d+)\s*pages", comment, re.IGNORECASE)
        if m:
            pages = int(m.group(1))

        papers.append(
            {
                "url": abs_url.replace("http://", "https://"),
                "title": title,
                "author": authors or None,
                "conference": entry.get("arxiv_journal_ref") or None,
                "pages": pages,
                "date": _format_date(entry.get("published")),
                "abstract": abstract or None,
                "cite_num": None,
                "submitted": bool(entry.get("arxiv_journal_ref")),
                "relevant_no": idx,
                "source": "arxiv",
                "_arxiv_id": arxiv_id,
            }
        )
    return papers
