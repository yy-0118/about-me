from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.schemas.auth import AdminLoginRequest, AdminLoginResponse
from app.auth import issue_token

router = APIRouter(prefix="/api/auth", tags=["鉴权"])


@router.post("/admin", response_model=AdminLoginResponse)
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """校验管理员密码并签发 token"""
    settings = get_settings()
    if not settings.ADMIN_PASSWORD:
        raise HTTPException(500, "管理员密码未配置")

    if req.password != settings.ADMIN_PASSWORD:
        raise HTTPException(401, "密码错误")

    record = await issue_token(db)
    return AdminLoginResponse(
        token=record.token,
        expires_at=record.expires_at.isoformat(),
    )
