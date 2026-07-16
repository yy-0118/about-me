from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SessionCreate(BaseModel):
    title: Optional[str] = Field(default="新对话", max_length=255)


class SessionUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[list[Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    total: int
    items: list[SessionResponse]


class DeleteResponse(BaseModel):
    message: str
