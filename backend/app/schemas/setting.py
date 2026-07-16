from pydantic import BaseModel, Field
from typing import Optional


# ============================================================
# 公共读（不返回 api_key 等敏感字段）
# ============================================================
class SettingsResponse(BaseModel):
    temperature: float = 0.3
    top_k: int = 5
    llm_model: str = "deepseek-v4-flash"
    system_prompt: str = (
        "你是一个知识库问答助手。请基于以下检索到的文档内容回答用户问题。"
        "如果你不确定答案，请如实说不知道，不要编造。引用相关文档内容来支持你的回答。请用中文回答。"
    )


# ============================================================
# 管理员：完整设置读 / 写
# ============================================================
class AdminSettingsResponse(BaseModel):
    deepseek_api_key_masked: str = Field(..., description="LLM API Key 掩码")
    deepseek_api_key_set: bool = Field(..., description="LLM API Key 是否已配置")
    deepseek_base_url: str
    llm_model: str
    embedding_base_url: str
    embedding_api_key_masked: str = Field(..., description="Embedding API Key 掩码")
    embedding_api_key_set: bool = Field(..., description="Embedding API Key 是否已配置")
    embedding_use_llm_credentials: bool = Field(..., description="Embedding 是否复用 LLM 凭据")
    embedding_model: str
    temperature: float
    top_k: int
    system_prompt: str
    ai_style: str


class AdminSettingsUpdate(BaseModel):
    """全量更新；*_api_key 为 None 或空表示不动"""
    deepseek_api_key: Optional[str] = Field(default=None, max_length=512)
    deepseek_base_url: str = Field(..., max_length=512)
    llm_model: str = Field(..., max_length=128)
    embedding_base_url: str = Field(..., max_length=512)
    embedding_api_key: Optional[str] = Field(default=None, max_length=512)
    embedding_model: str = Field(..., max_length=128)
    temperature: float = Field(..., ge=0.0, le=2.0)
    top_k: int = Field(..., ge=1, le=50)
    system_prompt: str = Field(..., max_length=8000)
    ai_style: str = Field(..., max_length=32)


class ResetResponse(BaseModel):
    message: str
    reset_keys: list[str]


class TestConnectionRequest(BaseModel):
    deepseek_api_key: Optional[str] = None
    deepseek_base_url: Optional[str] = None
    llm_model: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_model: Optional[str] = None


class TestConnectionResponse(BaseModel):
    ok: bool
    llm: Optional[dict] = None
    embedding: Optional[dict] = None
