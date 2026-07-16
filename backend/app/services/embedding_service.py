"""
DeepSeek Embedding API 调用服务
支持外部注入 api_key / base_url / model。
"""
from typing import Optional
import numpy as np
import httpx


class EmbeddingService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key
        # 兼容两种 base_url 写法：'https://x.com' 或 'https://x.com/v1'
        raw = (base_url or "https://api.deepseek.com").rstrip("/")
        if raw.endswith("/v1"):
            self.base_url = raw
        else:
            self.base_url = raw + "/v1"
        self.model = model or "deepseek-embedding"

    async def embed(self, text: str) -> list[float]:
        """将单条文本转为向量"""
        result = await self._call_api([text])
        return result[0] if result else []

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量将文本转为向量"""
        return await self._call_api(texts)

    async def _call_api(self, texts: list[str]) -> list[list[float]]:
        """调用 Embedding API"""
        if not self.api_key:
            raise ValueError("API Key 未配置")

        url = f"{self.base_url}/embeddings"
        payload = {
            "model": self.model,
            "input": texts,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        results = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in results]

    async def test_connection(self) -> dict:
        if not self.api_key:
            return {"ok": False, "error": "API Key 未配置"}
        url = f"{self.base_url}/embeddings"
        payload = {"model": self.model, "input": ["ping"]}
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return {"ok": True}
            return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:300]}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

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
