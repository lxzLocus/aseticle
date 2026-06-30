from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    # NB: pool_pre_ping is intentionally disabled — aiomysql's ping() signature
    # is incompatible with SQLAlchemy's pre-ping. Recycle connections instead so
    # they never outlive MySQL's wait_timeout.
    pool_recycle=900,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables on startup (simple bootstrap; use Alembic for real migrations)."""
    from app.db import models  # noqa: F401  ensure models are imported

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
