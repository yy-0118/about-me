"""
DeepSeek Embedding API 调用服务
"""
from typing import Optional
import numpy as np
from app.config import get_settings
import httpx


class EmbeddingService:
    def __init__(self):
        self.settings = get_settings()

    async def embed(self, text: str, model: Optional[str] = None) -> list[float]:
        """将单条文本转为向量"""
        result = await self._call_api([text], model)
        return result[0] if result else []

    async def embed_batch(self, texts: list[str], model: Optional[str] = None) -> list[list[float]]:
        """批量将文本转为向量"""
        return await self._call_api(texts, model)

    async def _call_api(self, texts: list[str], model: Optional[str] = None) -> list[list[float]]:
        """调用 DeepSeek Embedding API"""
        api_key = self.settings.DEEPSEEK_API_KEY
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY 未配置")

        url = f"{self.settings.DEEPSEEK_BASE_URL}/v1/embeddings"
        payload = {
            "model": model or self.settings.EMBEDDING_MODEL,
            "input": texts,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # 解析响应
        results = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in results]

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        """计算余弦相似度"""
        arr_a = np.array(a, dtype=np.float32)
        arr_b = np.array(b, dtype=np.float32)
        norm_a = np.linalg.norm(arr_a)
        norm_b = np.linalg.norm(arr_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))
