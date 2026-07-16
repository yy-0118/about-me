"""
数据库连接管理
支持 SQLite（本地开发）和 MySQL（生产）
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import inspect, text
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
        await conn.run_sync(_ensure_chat_session_owner_columns)


def _ensure_chat_session_owner_columns(sync_conn):
    inspector = inspect(sync_conn)
    if "chat_sessions" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("chat_sessions")}
    dialect = sync_conn.dialect.name

    if "client_id" not in columns:
        if dialect == "mysql":
            sync_conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN client_id VARCHAR(128) NULL"))
        else:
            sync_conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN client_id VARCHAR(128)"))

    if "client_ip" not in columns:
        if dialect == "mysql":
            sync_conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN client_ip VARCHAR(64) NULL"))
        else:
            sync_conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN client_ip VARCHAR(64)"))

    indexes = {idx["name"] for idx in inspector.get_indexes("chat_sessions")}
    if "idx_chat_sessions_client_updated" not in indexes:
        sync_conn.execute(text(
            "CREATE INDEX idx_chat_sessions_client_updated "
            "ON chat_sessions (client_id, updated_at)"
        ))
