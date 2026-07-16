"""
公共设置读取接口
普通用户/管理员都可读，但只返回非敏感字段。
修改入口已迁移到 /api/admin/settings。
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.setting import SettingsResponse
from app.services.setting_service import get_all_settings

router = APIRouter(prefix="/api/settings", tags=["设置"])


@router.get("", response_model=SettingsResponse)
async def read_settings(db: AsyncSession = Depends(get_db)):
    """读取当前非敏感设置（任何人都可读）"""
    return SettingsResponse(**await get_all_settings(db))
