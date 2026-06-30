from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _user_out
from app.api.deps import csrf_protect, get_current_user
from app.core import crypto
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth import UserOut
from app.schemas.settings import SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.put("", response_model=UserOut, dependencies=[Depends(csrf_protect)])
async def update_settings(
    body: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.search_source is not None:
        user.search_source = body.search_source

    if body.llm_base_url is not None:
        user.llm_base_url = body.llm_base_url or None
    if body.llm_model is not None:
        user.llm_model = body.llm_model or None
    if body.llm_api_key is not None:
        # empty string clears the stored key
        user.llm_api_key_enc = crypto.encrypt(body.llm_api_key) if body.llm_api_key else None

    if body.serpapi_key is not None:
        user.serpapi_key_enc = crypto.encrypt(body.serpapi_key) if body.serpapi_key else None

    await db.commit()
    await db.refresh(user)
    return _user_out(user)
