from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # --- BYO settings (API keys stored encrypted at rest) ---
    # Translation: OpenAI-compatible endpoint (OpenAI, LM Studio, Ollama, ...)
    llm_base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    llm_api_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional SerpApi key for Google Scholar source
    serpapi_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Preferred search source: "arxiv" | "scholar"
    search_source: Mapped[str] = mapped_column(String(32), default="arxiv", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
    )
