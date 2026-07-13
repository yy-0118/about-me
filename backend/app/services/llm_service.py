"""
DeepSeek LLM API 流式调用服务
"""
from typing import AsyncGenerator, Optional
from app.config import get_settings
import httpx
import json


class LLMService:
    def __init__(self):
        self.settings = get_settings()

    async def chat_stream(self, question: str, context_texts: list[str],
                          model: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        基于检索结果流式回答
        context_texts: 检索到的相关文本块列表
        """
        api_key = self.settings.DEEPSEEK_API_KEY
        if not api_key:
            yield json.dumps({"type": "error", "content": "API Key 未配置"})
            return

        # 构建 prompt
        context = "\n\n---\n\n".join(context_texts)
        system_prompt = (
            "你是一个知识库问答助手。请基于以下检索到的文档内容回答用户问题。\n"
            "如果你不确定答案，请如实说不知道，不要编造。\n"
            "引用相关文档内容来支持你的回答。\n"
            "请用中文回答。\n\n"
            f"检索到的相关内容：\n{context}"
        )

        url = f"{self.settings.DEEPSEEK_BASE_URL}/v1/chat/completions"
        payload = {
            "model": model or self.settings.LLM_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            "stream": True,
            "temperature": 0.3,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    yield json.dumps({"type": "error", "content": f"API 错误: {resp.status_code}"})
                    return

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield json.dumps({"type": "chunk", "content": content})
                    except json.JSONDecodeError:
                        continue
