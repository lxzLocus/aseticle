"""Search orchestration: pick a source, enrich with citations, attach tiers."""
from app.services import citations, matching
from app.services.sources import arxiv as arxiv_source
from app.services.sources import serpapi as serpapi_source


async def run_search(
    query: str,
    *,
    source: str = "arxiv",
    serpapi_key: str | None = None,
    max_results: int = 30,
) -> tuple[str, list[dict]]:
    """Return (effective_source, papers)."""
    effective = source
    if source == "scholar" and serpapi_key:
        papers = await serpapi_source.search(query, serpapi_key, max_results)
    else:
        # default / fallback: free arXiv API
        effective = "arxiv"
        papers = await arxiv_source.search(query, max_results)
        await citations.enrich_arxiv(papers)

    matching.annotate(papers)

    # strip private fields before returning
    for p in papers:
        p.pop("_arxiv_id", None)
    return effective, papers
