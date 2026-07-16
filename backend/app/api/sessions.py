"""
会话 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    SessionDetail,
    SessionListResponse,
    MessageResponse,
    DeleteResponse,
)

router = APIRouter(prefix="/api/chat/sessions", tags=["对话会话"])


@router.post("", response_model=SessionResponse)
async def create_session(payload: SessionCreate | None = None, db: AsyncSession = Depends(get_db)):
    """新建会话"""
    title = (payload.title if payload else None) or "新对话"
    session = ChatSession(title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("", response_model=SessionListResponse)
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """列出所有会话，按更新时间倒序"""
    result = await db.execute(select(ChatSession).order_by(ChatSession.updated_at.desc()))
    items = list(result.scalars().all())
    return SessionListResponse(total=len(items), items=items)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """加载会话 + 所有消息"""
    s_result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = s_result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")

    m_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    )
    messages = list(m_result.scalars().all())

    import json as _json
    msg_responses = []
    for m in messages:
        sources = None
        if m.sources:
            try:
                sources = _json.loads(m.sources)
            except _json.JSONDecodeError:
                sources = None
        msg_responses.append(
            MessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=sources,
                created_at=m.created_at,
            )
        )

    return SessionDetail(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=msg_responses,
    )


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """修改会话标题"""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")
    session.title = payload.title
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/{session_id}", response_model=DeleteResponse)
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """删除会话（级联删除消息）"""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")
    await db.delete(session)
    await db.commit()
    return DeleteResponse(message="删除成功")
