"""
数据库连接管理
支持 SQLite（本地开发）和 MySQL（生产）
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import get_settings


def get_db_url() -> str:
    s = get_settings()
    if s.DB_TYPE == "mysql":
        return f"mysql+aiomysql://{s.DB_USER}:{s.DB_PASSWORD}@{s.DB_HOST}:{s.DB_PORT}/{s.DB_NAME}?charset=utf8mb4"
    else:
        return f"sqlite+aiosqlite:///{s.SQLITE_PATH}"


def _engine_kwargs() -> dict:
    s = get_settings()
    if s.DB_TYPE == "mysql":
        return {"pool_size": 5, "max_overflow": 10}
    return {"connect_args": {"check_same_thread": False}}


engine = create_async_engine(get_db_url(), echo=False, **_engine_kwargs())

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """创建所有表"""
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

