"""
管理员相关 API
- 用户提问摘要（/questions）
- 完整设置读/写（/settings）
- 测试 LLM/Embedding 连接（/test-llm）
- 重置系统设置（/reset-settings）
- 概览统计（/stats）
- 用户对话管理（/sessions, /sessions/{id}）
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, case

from app.database import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.document import Document
from app.models.chunk import Chunk
from app.auth import require_admin
from app.services.setting_service import (
    DEFAULT_SETTINGS,
    get_all_runtime_settings,
    get_value,
    get_value_or_none,
    set_value,
)
from app.services.llm_service import LLMService
from app.services.embedding_service import EmbeddingService
from app.schemas.setting import (
    AdminSettingsResponse,
    AdminSettingsUpdate,
    ResetResponse,
    TestConnectionRequest,
    TestConnectionResponse,
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["管理员"])


# ============================================================
# 用户提问摘要
# ============================================================
class UserQuestionItem(BaseModel):
    id: int
    session_id: int
    session_title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserQuestionListResponse(BaseModel):
    total: int
    items: list[UserQuestionItem]


@router.get(
    "/questions",
    response_model=UserQuestionListResponse,
    dependencies=[Depends(require_admin)],
)
async def list_user_questions(
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出所有用户提问（按时间倒序，仅管理员）"""
    stmt = (
        select(ChatMessage, ChatSession.title)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .where(ChatMessage.role == "user")
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        UserQuestionItem(
            id=m.id,
            session_id=m.session_id,
            session_title=title or "新对话",
            content=m.content,
            created_at=m.created_at,
        )
        for m, title in rows
    ]
    return UserQuestionListResponse(total=len(items), items=items)


# ============================================================
# 完整设置（管理员）
# ============================================================
def _mask_key(key: Optional[str]) -> tuple[str, bool]:
    if not key:
        return ("", False)
    if len(key) <= 8:
        return ("*" * len(key), True)
    return (f"{key[:3]}***{key[-4:]}", True)


@router.get(
    "/settings",
    response_model=AdminSettingsResponse,
    dependencies=[Depends(require_admin)],
)
async def read_admin_settings(db: AsyncSession = Depends(get_db)):
    """读取完整设置（api_key 掩码返回）"""
    runtime = await get_all_runtime_settings(db)
    masked, is_set = _mask_key(runtime["api_key"])
    emb_masked, emb_set = _mask_key(runtime["embedding_api_key"])
    use_llm = not runtime["embedding_api_key_explicit"]
    return AdminSettingsResponse(
        deepseek_api_key_masked=masked,
        deepseek_api_key_set=is_set,
        deepseek_base_url=runtime["base_url"],
        llm_model=runtime["llm_model"],
        embedding_base_url=runtime["embedding_base_url"],
        embedding_api_key_masked=emb_masked,
        embedding_api_key_set=emb_set,
        embedding_use_llm_credentials=use_llm,
        embedding_model=runtime["embedding_model"],
        temperature=runtime["temperature"],
        top_k=runtime["top_k"],
        system_prompt=runtime["system_prompt"],
        ai_style=runtime["ai_style"],
    )


@router.put(
    "/settings",
    response_model=AdminSettingsResponse,
    dependencies=[Depends(require_admin)],
)
async def update_admin_settings(
    payload: AdminSettingsUpdate, db: AsyncSession = Depends(get_db)
):
    """更新完整设置（仅管理员）"""
    # api_key 字段：None 或空字符串 → 不动；非空 → 写入
    if payload.deepseek_api_key:
        await set_value(db, "deepseek_api_key", payload.deepseek_api_key)

    if payload.embedding_api_key:
        await set_value(db, "embedding_api_key", payload.embedding_api_key)

    await set_value(db, "deepseek_base_url", payload.deepseek_base_url)
    await set_value(db, "embedding_base_url", payload.embedding_base_url)
    await set_value(db, "llm_model", payload.llm_model)
    await set_value(db, "embedding_model", payload.embedding_model)
    await set_value(db, "temperature", str(payload.temperature))
    await set_value(db, "top_k", str(payload.top_k))
    await set_value(db, "system_prompt", payload.system_prompt)
    await set_value(db, "ai_style", payload.ai_style)

    runtime = await get_all_runtime_settings(db)
    masked, is_set = _mask_key(runtime["api_key"])
    emb_masked, emb_set = _mask_key(runtime["embedding_api_key"])
    use_llm = not runtime["embedding_api_key_explicit"]
    return AdminSettingsResponse(
        deepseek_api_key_masked=masked,
        deepseek_api_key_set=is_set,
        deepseek_base_url=runtime["base_url"],
        llm_model=runtime["llm_model"],
        embedding_base_url=runtime["embedding_base_url"],
        embedding_api_key_masked=emb_masked,
        embedding_api_key_set=emb_set,
        embedding_use_llm_credentials=use_llm,
        embedding_model=runtime["embedding_model"],
        temperature=runtime["temperature"],
        top_k=runtime["top_k"],
        system_prompt=runtime["system_prompt"],
        ai_style=runtime["ai_style"],
    )


@router.post(
    "/reset-settings",
    response_model=ResetResponse,
    dependencies=[Depends(require_admin)],
)
async def reset_admin_settings(db: AsyncSession = Depends(get_db)):
    """重置设置为默认值（不动 api_key）"""
    reset_keys = [
        "deepseek_base_url",
        "llm_model",
        "embedding_base_url",
        "embedding_model",
        "temperature",
        "top_k",
        "system_prompt",
        "ai_style",
    ]
    for k in reset_keys:
        await set_value(db, k, DEFAULT_SETTINGS[k])
    return ResetResponse(message="设置已重置为默认值", reset_keys=reset_keys)


# ============================================================
# 测试 LLM/Embedding 连接
# ============================================================
@router.post(
    "/test-llm",
    response_model=TestConnectionResponse,
    dependencies=[Depends(require_admin)],
)
async def test_llm_connection(
    payload: TestConnectionRequest, db: AsyncSession = Depends(get_db)
):
    """用提交的值或当前保存的值测试 LLM/Embedding 是否连通"""
    runtime = await get_all_runtime_settings(db)
    llm_api_key = payload.deepseek_api_key or runtime["api_key"]
    llm_base_url = payload.deepseek_base_url or runtime["base_url"]
    llm_model = payload.llm_model or runtime["llm_model"]

    emb_api_key = (
        payload.embedding_api_key
        if payload.embedding_api_key
        else (runtime["embedding_api_key"] if runtime["embedding_api_key"] else llm_api_key)
    )
    emb_base_url = (
        payload.embedding_base_url
        if payload.embedding_base_url
        else runtime["embedding_base_url"]
    )
    embedding_model = payload.embedding_model or runtime["embedding_model"]

    llm_svc = LLMService(api_key=llm_api_key, base_url=llm_base_url, model=llm_model)
    embed_svc = EmbeddingService(
        api_key=emb_api_key, base_url=emb_base_url, model=embedding_model
    )

    llm_result = await llm_svc.test_connection()
    embed_result = await embed_svc.test_connection()
    return TestConnectionResponse(
        ok=llm_result["ok"] and embed_result["ok"],
        llm=llm_result,
        embedding=embed_result,
    )


# ============================================================
# 概览统计
# ============================================================
class AdminStats(BaseModel):
    documents: int
    chunks: int
    sessions: int
    messages: int
    user_messages: int
    assistant_messages: int
    latest_document_at: Optional[datetime]
    latest_session_at: Optional[datetime]


@router.get(
    "/stats",
    response_model=AdminStats,
    dependencies=[Depends(require_admin)],
)
async def admin_stats(db: AsyncSession = Depends(get_db)):
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar_one()
    chunk_count = (await db.execute(select(func.count(Chunk.id)))).scalar_one()
    session_count = (await db.execute(select(func.count(ChatSession.id)))).scalar_one()
    msg_count = (await db.execute(select(func.count(ChatMessage.id)))).scalar_one()
    user_msg_count = (
        await db.execute(
            select(func.count(ChatMessage.id)).where(ChatMessage.role == "user")
        )
    ).scalar_one()
    asst_msg_count = (
        await db.execute(
            select(func.count(ChatMessage.id)).where(ChatMessage.role == "assistant")
        )
    ).scalar_one()

    latest_doc = (
        await db.execute(select(Document.created_at).order_by(Document.created_at.desc()).limit(1))
    ).scalar_one_or_none()
    latest_session = (
        await db.execute(
            select(ChatSession.updated_at).order_by(ChatSession.updated_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    return AdminStats(
        documents=doc_count,
        chunks=chunk_count,
        sessions=session_count,
        messages=msg_count,
        user_messages=user_msg_count,
        assistant_messages=asst_msg_count,
        latest_document_at=latest_doc,
        latest_session_at=latest_session,
    )


# ============================================================
# 用户对话管理
# ============================================================
class AdminSessionItem(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    user_message_count: int

    class Config:
        from_attributes = True


class AdminSessionListResponse(BaseModel):
    total: int
    items: list[AdminSessionItem]


class AdminMessageItem(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminSessionDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[AdminMessageItem]


class ClearResponse(BaseModel):
    message: str
    deleted_sessions: int


@router.get(
    "/sessions",
    response_model=AdminSessionListResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_list_sessions(
    limit: int = 200, offset: int = 0, db: AsyncSession = Depends(get_db)
):
    """列出所有用户 session（含每会话消息统计）"""
    sessions_q = (
        select(ChatSession)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = list((await db.execute(sessions_q)).scalars().all())

    if not sessions:
        return AdminSessionListResponse(total=0, items=[])

    ids = [s.id for s in sessions]
    msg_stats_rows = (
        await db.execute(
            select(
                ChatMessage.session_id,
                func.count(ChatMessage.id).label("total"),
                func.sum(
                    case((ChatMessage.role == "user", 1), else_=0)
                ).label("user_cnt"),
            )
            .where(ChatMessage.session_id.in_(ids))
            .group_by(ChatMessage.session_id)
        )
    ).all()
    stats_map = {row.session_id: (row.total, row.user_cnt) for row in msg_stats_rows}

    items = [
        AdminSessionItem(
            id=s.id,
            title=s.title or "新对话",
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=stats_map.get(s.id, (0, 0))[0],
            user_message_count=stats_map.get(s.id, (0, 0))[1],
        )
        for s in sessions
    ]
    return AdminSessionListResponse(total=len(items), items=items)


@router.get(
    "/sessions/{session_id}",
    response_model=AdminSessionDetail,
    dependencies=[Depends(require_admin)],
)
async def admin_get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """查看某 session 完整 Q&A（按时间升序）"""
    s_row = (
        await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    ).scalar_one_or_none()
    if not s_row:
        raise HTTPException(404, "会话不存在")

    m_rows = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        )
    ).scalars().all()

    import json as _json
    msgs: list[AdminMessageItem] = []
    for m in m_rows:
        sources = None
        if m.sources:
            try:
                sources = _json.loads(m.sources)
            except _json.JSONDecodeError:
                sources = None
        msgs.append(
            AdminMessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=sources,
                created_at=m.created_at,
            )
        )
    return AdminSessionDetail(
        id=s_row.id,
        title=s_row.title or "新对话",
        created_at=s_row.created_at,
        updated_at=s_row.updated_at,
        messages=msgs,
    )


@router.delete(
    "/sessions/{session_id}",
    response_model=ClearResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """删除单个 session（级联删 messages）"""
    s_row = (
        await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    ).scalar_one_or_none()
    if not s_row:
        raise HTTPException(404, "会话不存在")
    await db.delete(s_row)
    await db.commit()
    return ClearResponse(message="删除成功", deleted_sessions=1)


@router.delete(
    "/sessions",
    response_model=ClearResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_clear_sessions(db: AsyncSession = Depends(get_db)):
    """清空所有 session（级联删 messages）"""
    # 先计数
    cnt = (await db.execute(select(func.count(ChatSession.id)))).scalar_one()
    await db.execute(delete(ChatSession))
    await db.commit()
    return ClearResponse(message="已清空所有会话", deleted_sessions=cnt)
