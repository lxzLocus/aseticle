from typing import Literal

from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    """Update user BYO settings. Omitted fields are left unchanged.

    Pass an empty string for *_api_key to clear a stored key.
    """

    search_source: Literal["arxiv", "scholar"] | None = None

    llm_base_url: str | None = Field(default=None, max_length=512)
    llm_model: str | None = Field(default=None, max_length=128)
    llm_api_key: str | None = Field(default=None, max_length=512)

    serpapi_key: str | None = Field(default=None, max_length=512)
