"""
封面自定义接口

- GET    /api/cover              公共：读取封面配置
- PUT    /api/cover              管理员：保存主标题 / 提示语 / 小字
- POST   /api/cover/background   管理员：上传背景图（上传后立即生效）
- DELETE /api/cover/background   管理员：恢复默认背景图
- GET    /api/cover/background   公共：读取已上传的背景图文件

文字配置存放在 settings 表；背景图存放在 {UPLOAD_DIR}/cover/，
与文档上传目录一起被 docker volume 持久化。
"""
import json
import mimetypes
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.config import get_settings
from app.database import get_db
from app.schemas.cover import CoverConfigResponse, CoverConfigUpdate, CoverLabel
from app.services.setting_service import get_value, set_value

router = APIRouter(prefix="/api/cover", tags=["封面"])

KEY_TITLE = "cover_title"
KEY_HINT = "cover_hint"
KEY_LABELS = "cover_labels"
KEY_BG_VERSION = "cover_bg_version"
KEY_LINE_WIDTH = "cover_line_width"

BG_ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"}
BG_MAX_SIZE = 12 * 1024 * 1024  # 12MB


def _cover_dir() -> str:
    path = os.path.join(get_settings().UPLOAD_DIR, "cover")
    os.makedirs(path, exist_ok=True)
    return path


def _find_bg_file() -> Optional[str]:
    """返回当前背景图文件路径；未上传过则返回 None"""
    directory = _cover_dir()
    for name in sorted(os.listdir(directory)):
        if name.startswith("cover-bg") and os.path.splitext(name)[1].lower() in BG_ALLOWED_EXT:
            return os.path.join(directory, name)
    return None


def _remove_bg_files() -> None:
    directory = _cover_dir()
    for name in os.listdir(directory):
        if name.startswith("cover-bg"):
            try:
                os.remove(os.path.join(directory, name))
            except OSError:
                pass


def _parse_labels(raw: str) -> Optional[list[CoverLabel]]:
    """将 DB 里的 JSON 字符串解析为标签列表；空串/脏数据 → None（前端用内置默认）"""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    labels: list[CoverLabel] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            labels.append(CoverLabel(**item))
        except ValueError:
            continue
    return labels


async def _read_config(db: AsyncSession) -> CoverConfigResponse:
    raw_width = await get_value(db, KEY_LINE_WIDTH)
    try:
        line_width = float(raw_width) if raw_width else None
    except ValueError:
        line_width = None
    return CoverConfigResponse(
        title=await get_value(db, KEY_TITLE),
        hint=await get_value(db, KEY_HINT),
        labels=_parse_labels(await get_value(db, KEY_LABELS)),
        bg_version=await get_value(db, KEY_BG_VERSION),
        custom_bg=_find_bg_file() is not None,
        line_width=line_width,
    )


@router.get("", response_model=CoverConfigResponse)
async def read_cover_config(db: AsyncSession = Depends(get_db)):
    """读取封面配置（任何人都可读）"""
    return await _read_config(db)


@router.put(
    "",
    response_model=CoverConfigResponse,
    dependencies=[Depends(require_admin)],
)
async def update_cover_config(
    payload: CoverConfigUpdate, db: AsyncSession = Depends(get_db)
):
    """保存封面文字（仅管理员）：空字符串 → 前端回落到内置默认文案"""
    await set_value(db, KEY_TITLE, payload.title.strip())
    await set_value(db, KEY_HINT, payload.hint.strip())
    if payload.labels is None:
        await set_value(db, KEY_LABELS, "")
    else:
        await set_value(
            db,
            KEY_LABELS,
            json.dumps(
                [label.model_dump(exclude_none=True) for label in payload.labels],
                ensure_ascii=False,
            ),
        )
    await set_value(
        db, KEY_LINE_WIDTH, "" if payload.line_width is None else f"{payload.line_width:g}"
    )
    return await _read_config(db)


@router.post(
    "/background",
    response_model=CoverConfigResponse,
    dependencies=[Depends(require_admin)],
)
async def upload_cover_background(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    """上传封面背景图（仅管理员），替换已有背景并立即生效"""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in BG_ALLOWED_EXT:
        raise HTTPException(400, "请上传 png / jpg / webp / gif / avif 格式的图片")
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(400, "文件不是图片，请重新选择")

    content = await file.read()
    if not content:
        raise HTTPException(400, "图片内容为空")
    if len(content) > BG_MAX_SIZE:
        raise HTTPException(400, "图片超过 12MB，请先压缩后再上传")

    _remove_bg_files()
    with open(os.path.join(_cover_dir(), f"cover-bg{ext}"), "wb") as f:
        f.write(content)

    await set_value(db, KEY_BG_VERSION, str(int(time.time() * 1000)))
    return await _read_config(db)


@router.get("/background")
async def read_cover_background():
    """返回当前背景图；未上传过则 404，前端继续用内置默认图"""
    path = _find_bg_file()
    if not path:
        raise HTTPException(404, "尚未上传背景图")
    media_type = mimetypes.guess_type(path)[0] or "image/png"
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.delete(
    "/background",
    response_model=CoverConfigResponse,
    dependencies=[Depends(require_admin)],
)
async def delete_cover_background(db: AsyncSession = Depends(get_db)):
    """删除自定义背景图，回到内置默认背景（仅管理员）"""
    _remove_bg_files()
    await set_value(db, KEY_BG_VERSION, "")
    return await _read_config(db)
