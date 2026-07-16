"""
DeepSeek LLM API 流式调用服务
支持外部注入 api_key / base_url / model，方便在管理员修改设置后无需重启进程。
"""
from typing import AsyncGenerator, Optional
import httpx
import json


class LLMService:
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
        self.model = model or "deepseek-v4-flash"

    async def chat_stream(
        self,
        question: str,
        context_texts: list[str],
        history: Optional[list[dict]] = None,
        system_prompt_override: Optional[str] = None,
        ai_style: Optional[str] = None,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        """
        基于检索结果流式回答
        context_texts: 检索到的相关文本块列表
        history: 之前的 user/assistant 消息列表（不含 system）
        ai_style: 回复风格预设，会被拼接到 system prompt 前面
        """
        if not self.api_key:
            yield json.dumps({"type": "error", "content": "API Key 未配置"})
            return

        context = "\n\n---\n\n".join(context_texts)

        style_prefix = self._style_prefix(ai_style)
        # 始终把检索到的内容追加到 system prompt 后面（无论是否自定义）
        if context:
            base_system = system_prompt_override or (
                "你是一个知识库问答助手。请基于以下检索到的文档内容回答用户问题。\n"
                "如果你不确定答案，请如实说不知道，不要编造。\n"
                "引用相关文档内容来支持你的回答。\n"
                "请用中文回答。\n"
            )
        else:
            base_system = (
                "你是一个中文 AI 助手。请直接回答用户问题；如果问题需要知识库资料但当前没有可用检索结果，请说明需要先上传或配置可检索的文档。"
            )
        if context:
            base_system = f"{base_system}\n\n检索到的相关内容：\n{context}"
        system_prompt = f"{style_prefix}{base_system}" if style_prefix else base_system

        url = f"{self.base_url}/chat/completions"
        messages: list[dict] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": question})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    err_text = ""
                    try:
                        err_text = (await resp.aread()).decode("utf-8", errors="ignore")[:500]
                    except Exception:
                        pass
                    yield json.dumps({"type": "error", "content": f"API 错误: {resp.status_code} {err_text}"})
                    return

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    # 跳过心跳/usage 行：choices 为空或不存在
                    choices = data.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {}) or {}
                    content = delta.get("content", "")
                    if content:
                        yield json.dumps({"type": "chunk", "content": content})

    async def test_connection(self) -> dict:
        """用最小请求测试 LLM API 是否可用"""
        if not self.api_key:
            return {"ok": False, "error": "API Key 未配置"}
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "ping"}],
            "stream": False,
            "max_tokens": 4,
        }
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
    def _style_prefix(style: Optional[str]) -> str:
        if not style:
            return ""
        presets = {
            "professional": "请用专业、严谨的语气回答，避免口语化表达。\n",
            "friendly": "请用友善、亲切的语气回答，多用鼓励和共情。\n",
            "concise": "请用简洁的语言回答，避免冗长，直奔主题。\n",
            "detailed": "请尽可能详细地展开回答，给出充分的背景与解释。\n",
            "free": "",
        }
        return presets.get(style, "")
