from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
import json

from app.database import get_db
from app.schemas.chat import ChatRequest, ChatSource
from app.services.embedding_service import EmbeddingService
from app.services.vector_search import VectorSearchService
from app.services.llm_service import LLMService

router = APIRouter(prefix="/api/chat", tags=["问答"])


@router.post("")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """流式问答"""
    if not request.question.strip():
        raise HTTPException(400, "问题不能为空")

    embed_service = EmbeddingService()
    search_service = VectorSearchService(embed_service)
    llm_service = LLMService()

    # 1. 检索相关文档块
    results = await search_service.search(db, request.question, request.top_k)
    if not results:
        return EventSourceResponse([
            {"event": "message", "data": json.dumps({"type": "chunk", "content": "未在文档中找到相关信息。"})},
            {"event": "message", "data": json.dumps({"type": "done"})},
        ])

    # 2. 构建上下文并流式回答
    context_texts = [r.chunk_text for r in results]
    sources = [
        ChatSource(document_name=r.document_name, chunk_text=r.chunk_text[:100], score=round(r.score, 4))
        for r in results
    ]

    async def event_generator():
        # 发送来源信息
        yield {"event": "message", "data": json.dumps({"type": "sources", "sources": [s.model_dump() for s in sources]})}

        # 流式回答
        async for chunk_json in llm_service.chat_stream(request.question, context_texts):
            yield {"event": "message", "data": chunk_json}

        yield {"event": "message", "data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_generator())
