from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    question: str = Field(..., max_length=2000, description="用户问题")
    top_k: int = Field(default=5, ge=1, le=20, description="检索数量")
    session_id: Optional[int] = Field(default=None, description="会话 ID（留空则不持久化）")


class ChatSource(BaseModel):
    document_name: str
    chunk_text: str
    score: float


class ChatChunk(BaseModel):
    type: str  # "chunk" | "sources" | "done" | "error"
    content: Optional[str] = None
    sources: Optional[list[ChatSource]] = None
