from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# -------- 文档 --------
class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_size: int
    file_type: str
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    total: int
    items: list[DocumentResponse]


# -------- 删除结果 --------
class DeleteResponse(BaseModel):
    message: str


class DocumentPreviewResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    content: str


class DocumentContentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=100000, description="文档新内容（纯文本）")
