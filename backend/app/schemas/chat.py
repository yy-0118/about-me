from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="用户问题")
    top_k: int = Field(default=5, ge=1, le=20, description="检索数量")


class ChatSource(BaseModel):
    document_name: str
    chunk_text: str
    score: float


class ChatChunk(BaseModel):
    type: str  # "chunk" | "sources" | "done"
    content: Optional[str] = None
    sources: Optional[list[ChatSource]] = None
