from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import csrf_protect, get_current_user
from app.core import crypto
from app.db.models import User
from app.schemas.paper import TranslateRequest, TranslateResponse
from app.services import translator

router = APIRouter(prefix="/api/translate", tags=["translate"])


@router.post("", response_model=TranslateResponse, dependencies=[Depends(csrf_protect)])
async def translate_text(
    body: TranslateRequest,
    user: User = Depends(get_current_user),
):
    if not (user.llm_api_key_enc and user.llm_base_url and user.llm_model):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Configure your LLM endpoint (base URL, model, API key) in settings first.",
        )

    api_key = crypto.decrypt(user.llm_api_key_enc)
    try:
        translated = await translator.translate(
            body.text,
            base_url=user.llm_base_url,
            api_key=api_key,
            model=user.llm_model,
            target_lang=body.target_lang,
        )
    except translator.TranslationError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))

    return TranslateResponse(translated=translated, model=user.llm_model)
