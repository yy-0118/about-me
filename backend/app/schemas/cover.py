"""封面（Cover）自定义配置：主标题 / 提示语 / 小字标签 / 背景图"""
from typing import Optional

from pydantic import BaseModel, Field


class CoverLabel(BaseModel):
    """封面上的一个小字标签（带一条指向中心的连线）"""

    text: str = Field(..., max_length=64)
    x: float = Field(..., ge=-20, le=120, description="水平位置（视口宽度百分比）")
    y: float = Field(..., ge=-20, le=120, description="垂直位置（视口高度百分比）")
    hideStart: Optional[float] = Field(
        default=None, ge=0, le=4000, description="连线靠中心一端的隐藏距离(px)"
    )
    hideEnd: Optional[float] = Field(
        default=None, ge=0, le=4000, description="连线靠文字一端的隐藏距离(px)"
    )


class CoverConfigResponse(BaseModel):
    """封面配置（公共可读）"""

    title: str = ""
    hint: str = ""
    labels: Optional[list[CoverLabel]] = None
    bg_version: str = ""
    custom_bg: bool = False
    line_width: Optional[float] = None


class CoverConfigUpdate(BaseModel):
    """封面文字更新（仅管理员）；labels 为 None 表示回到前端内置默认"""

    title: str = Field(default="", max_length=120)
    hint: str = Field(default="", max_length=200)
    labels: Optional[list[CoverLabel]] = Field(default=None, max_length=60)
    line_width: Optional[float] = Field(
        default=None, ge=0.0, le=8.0, description="连线粗细(px)；0 表示不显示，None 表示用内置默认"
    )
