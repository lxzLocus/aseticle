from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # General
    APP_NAME: str = "ASEticle"
    ENV: str = "development"  # development | production

    # Database
    DATABASE_URL: str = "mysql+aiomysql://aseticle:aseticle@db:3306/aseticle"

    # Security
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Fernet key (urlsafe base64, 32 bytes). Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="

    # Cookies
    COOKIE_SECURE: bool = False  # True behind HTTPS in production
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None

    # CORS (comma separated origins)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:49513"

    # Optional global SerpApi key (users can also supply their own)
    SERPAPI_KEY: str | None = None

    # Outbound forward proxy for paper-fetching requests (arXiv / Semantic
    # Scholar / SerpApi / publisher pages). Empty = connect directly.
    # e.g. http://proxy:8888  (the bundled tinyproxy daemon)
    OUTBOUND_PROXY_URL: str | None = None

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
