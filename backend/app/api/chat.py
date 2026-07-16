"""
流式问答（支持会话持久化）
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse
import json

from app.database import get_db
from app.client_identity import get_client_identity
from app.schemas.chat import ChatRequest, ChatSource
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.services.embedding_service import EmbeddingService
from app.services.vector_search import VectorSearchService
from app.services.llm_service import LLMService
from app.services.setting_service import get_all_runtime_settings

router = APIRouter(prefix="/api/chat", tags=["问答"])


def _auto_title(question: str, max_len: int = 30) -> str:
    s = question.strip().replace("\n", " ")
    return s[:max_len] + ("..." if len(s) > max_len else "")


@router.post("")
async def chat(payload: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """流式问答（可选 session 持久化）"""
    if not payload.question.strip():
        raise HTTPException(400, "问题不能为空")
    client_id, client_ip = get_client_identity(request)

    runtime = await get_all_runtime_settings(db)
    top_k = payload.top_k or runtime["top_k"]
    temperature = runtime["temperature"]
    llm_model = runtime["llm_model"]
    system_prompt = runtime["system_prompt"]
    ai_style = runtime["ai_style"]
    base_url = runtime["base_url"]
    api_key = runtime["api_key"]
    embedding_model = runtime["embedding_model"]

    session: ChatSession | None = None
    if payload.session_id is not None:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == payload.session_id,
                ChatSession.client_id == client_id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "会话不存在")
        session.client_ip = client_ip

    embed_service = EmbeddingService(
        api_key=runtime["embedding_api_key"],
        base_url=runtime["embedding_base_url"],
        model=embedding_model,
    )
    search_service = VectorSearchService(embed_service)
    llm_service = LLMService(
        api_key=api_key, base_url=base_url, model=llm_model
    )

    # 1. Search the knowledge base when embeddings are available. If the
    # embedding provider is not configured or unavailable, fall back to a
    # normal LLM chat instead of failing the whole request.
    try:
        results = await search_service.search(db, payload.question, top_k)
    except Exception:
        results = []

    sources = [
        ChatSource(
            document_name=r.document_name,
            chunk_text=r.chunk_text[:200],
            score=round(r.score, 4),
        )
        for r in results
    ]
    context_texts = [r.chunk_text for r in results]

    # 2. 加载历史（最近 6 条，3 轮）
    history: list[dict] = []
    if session is not None:
        msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(6)
        )
        recent = list(reversed(msg_result.scalars().all()))
        for m in recent:
            history.append({"role": m.role, "content": m.content})

    # 3. 流式生成
    async def event_generator():
        # 3.1 落库 user 消息
        if session is not None:
            user_msg = ChatMessage(session_id=session.id, role="user", content=payload.question)
            db.add(user_msg)
            await db.commit()
            await db.refresh(user_msg)
            # 首条消息时自动设置标题
            count_result = await db.execute(
                select(ChatMessage).where(ChatMessage.session_id == session.id)
            )
            if len(list(count_result.scalars().all())) == 1:
                session.title = _auto_title(payload.question)
                await db.commit()

        # 3.2 发送 sources
        yield {
            "event": "message",
            "data": json.dumps({"type": "sources", "sources": [s.model_dump() for s in sources]}),
        }

        # 3.3 累积助手回答
        assistant_buf: list[str] = []
        async for chunk_json in llm_service.chat_stream(
            question=payload.question,
            context_texts=context_texts,
            history=history,
            system_prompt_override=system_prompt,
            ai_style=ai_style,
            temperature=temperature,
        ):
            ev = json.loads(chunk_json)
            if ev.get("type") == "chunk" and ev.get("content"):
                assistant_buf.append(ev["content"])
            yield {"event": "message", "data": chunk_json}

        # 3.4 落库 assistant 消息
        if session is not None and assistant_buf:
            full = "".join(assistant_buf)
            asst_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=full,
                sources=json.dumps([s.model_dump() for s in sources], ensure_ascii=False),
            )
            db.add(asst_msg)
            await db.commit()

        yield {"event": "message", "data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_generator())
