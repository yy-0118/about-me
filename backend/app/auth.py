"""
管理员鉴权
简化方案：密码 → 随机 token → 写入 admin_tokens 表 → 24h 过期
"""
import secrets
from datetime import datetime, timedelta
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.config import get_settings
from app.database import get_db
from app.models.admin_token import AdminToken


TOKEN_TTL_HOURS = 24


async def issue_token(db: AsyncSession) -> AdminToken:
    """签发新的管理员 token"""
    settings = get_settings()
    if not settings.ADMIN_PASSWORD:
        raise HTTPException(500, "管理员密码未配置")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS)
    record = AdminToken(token=token, expires_at=expires_at)
    db.add(record)
    await db.commit()
    return record


async def verify_admin_token(token: str, db: AsyncSession) -> bool:
    """校验 token 有效性"""
    if not token:
        return False
    result = await db.execute(select(AdminToken).where(AdminToken.token == token))
    record = result.scalar_one_or_none()
    if not record:
        return False
    if record.expires_at < datetime.utcnow():
        await db.execute(delete(AdminToken).where(AdminToken.token == token))
        await db.commit()
        return False
    return True


async def require_admin(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """FastAPI 依赖：校验请求头 Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "需要管理员登录")
    token = authorization[7:].strip()
    if not await verify_admin_token(token, db):
        raise HTTPException(401, "登录已失效，请重新登录")
    return True


async def cleanup_expired_tokens(db: AsyncSession):
    """清理过期 token"""
    await db.execute(delete(AdminToken).where(AdminToken.expires_at < datetime.utcnow()))
    await db.commit()
