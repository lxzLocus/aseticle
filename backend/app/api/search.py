from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core import crypto
from app.core.config import settings as app_settings
from app.db.models import User
from app.schemas.paper import Paper, SearchResponse
from app.services.search import run_search

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="search query"),
    source: str | None = Query(default=None, description="arxiv | scholar"),
    max_results: int = Query(default=30, ge=1, le=50),
    user: User = Depends(get_current_user),
):
    chosen = source or user.search_source or "arxiv"

    serpapi_key: str | None = None
    if chosen == "scholar":
        if user.serpapi_key_enc:
            serpapi_key = crypto.decrypt(user.serpapi_key_enc)
        elif app_settings.SERPAPI_KEY:
            serpapi_key = app_settings.SERPAPI_KEY
        else:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Google Scholar source requires a SerpApi key in your settings.",
            )

    try:
        effective, papers = await run_search(
            q, source=chosen, serpapi_key=serpapi_key, max_results=max_results
        )
    except Exception as e:  # noqa: BLE001 - surface upstream failures cleanly
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Search failed: {e}")

    return SearchResponse(
        query=q,
        source=effective,
        count=len(papers),
        results=[Paper(**p) for p in papers],
    )
