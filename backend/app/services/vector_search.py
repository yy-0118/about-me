"""
向量检索服务：MySQL 读取向量 + numpy 余弦相似度
"""
import json
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.chunk import Chunk
from app.services.embedding_service import EmbeddingService


class SearchResult:
    def __init__(self, chunk_id: int, document_id: int, document_name: str,
                 chunk_text: str, score: float):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.document_name = document_name
        self.chunk_text = chunk_text
        self.score = score


class VectorSearchService:
    def __init__(self, embedding_service: EmbeddingService):
        self.embedding = embedding_service

    async def search(self, db: AsyncSession, query: str, top_k: int = 5) -> list[SearchResult]:
        """搜索最相关的文本块"""
        # 1. 将问题转为向量
        query_vec = await self.embedding.embed(query)
        if not query_vec:
            return []

        # 2. 读出所有 chunks 的向量
        sql = text("""
            SELECT c.id, c.document_id, c.chunk_text, c.embedding, d.filename
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.embedding IS NOT NULL AND c.embedding != ''
        """)
        rows = (await db.execute(sql)).fetchall()

        # 3. numpy 计算余弦相似度
        results = []
        query_arr = np.array(query_vec, dtype=np.float32)
        q_norm = np.linalg.norm(query_arr)

        for row in rows:
            if not row.embedding:
                continue
            try:
                vec = np.array(json.loads(row.embedding), dtype=np.float32)
            except (json.JSONDecodeError, TypeError):
                continue
            vec_norm = np.linalg.norm(vec)
            if q_norm == 0 or vec_norm == 0:
                continue
            score = float(np.dot(query_arr, vec) / (q_norm * vec_norm))
            results.append(SearchResult(
                chunk_id=row.id,
                document_id=row.document_id,
                document_name=row.filename,
                chunk_text=row.chunk_text,
                score=score,
            ))

        # 4. 按相似度排序，取 top-k
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]
