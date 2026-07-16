"""
向量检索服务：MySQL 读取向量 + numpy 余弦相似度
"""
import json
import re
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
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
        sql = text("""
            SELECT c.id, c.document_id, c.chunk_text, c.embedding, d.filename
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
        """)
        rows = (await db.execute(sql)).fetchall()

        try:
            query_vec = await self.embedding.embed(query)
        except Exception:
            query_vec = []

        if not query_vec:
            return self._keyword_search(rows, query, top_k)

        query_arr = np.array(query_vec, dtype=np.float32)
        q_norm = np.linalg.norm(query_arr)
        results = []

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
        if results:
            return results[:top_k]
        return self._keyword_search(rows, query, top_k)

    @staticmethod
    def _keyword_search(rows, query: str, top_k: int) -> list[SearchResult]:
        terms = VectorSearchService._query_terms(query)
        results = []
        for row in rows:
            text_value = row.chunk_text or ""
            haystack = f"{row.filename or ''}\n{text_value}".lower()
            score = 0.0
            for term in terms:
                count = haystack.count(term)
                if count:
                    score += count * max(len(term), 1)
            if score > 0:
                results.append(SearchResult(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_name=row.filename,
                    chunk_text=text_value,
                    score=score,
                ))

        if not results:
            for row in rows[:top_k]:
                results.append(SearchResult(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_name=row.filename,
                    chunk_text=row.chunk_text or "",
                    score=0.0,
                ))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]

    @staticmethod
    def _query_terms(query: str) -> list[str]:
        query = query.lower().strip()
        words = re.findall(r"[a-z0-9_]+", query)
        cjk = re.findall(r"[\u4e00-\u9fff]", query)
        bigrams = ["".join(cjk[i:i + 2]) for i in range(len(cjk) - 1)]
        terms = [word for word in words if len(word) > 1] + bigrams + cjk
        seen = set()
        unique = []
        for term in terms:
            if term and term not in seen:
                unique.append(term)
                seen.add(term)
        return unique or [query]
