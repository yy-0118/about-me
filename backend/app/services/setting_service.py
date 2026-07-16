"""
设置读取辅助
数据库为唯一运行时来源；缺失时回落到代码内 DEFAULT_SETTINGS；
API Key 在 DB 也缺失时回落到 .env 中的 DEEPSEEK_API_KEY。
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.setting import Setting
from app.config import get_settings


DEFAULT_SETTINGS = {
    "temperature": "0.3",
    "top_k": "5",
    "llm_model": "deepseek-chat",
    "system_prompt": "你是一个知识库问答助手。请基于以下检索到的文档内容回答用户问题。如果你不确定答案，请如实说不知道，不要编造。引用相关文档内容来支持你的回答。请用中文回答。",
    "deepseek_base_url": "https://api.deepseek.com",
    "embedding_model": "deepseek-embedding",
    "ai_style": "professional",
    "embedding_base_url": "https://api.deepseek.com",
}


async def get_value(db: AsyncSession, key: str) -> str:
    result = await db.execute(select(Setting).where(Setting.key_name == key))
    record = result.scalar_one_or_none()
    if record is not None:
        return record.value
    return DEFAULT_SETTINGS.get(key, "")


async def get_value_or_none(db: AsyncSession, key: str) -> Optional[str]:
    """读 DB value，无值返回 None（用于敏感字段如 api_key）"""
    result = await db.execute(select(Setting).where(Setting.key_name == key))
    record = result.scalar_one_or_none()
    return record.value if record else None


async def set_value(db: AsyncSession, key: str, value: str) -> None:
    """upsert 设置项"""
    result = await db.execute(select(Setting).where(Setting.key_name == key))
    record = result.scalar_one_or_none()
    if record:
        record.value = value
    else:
        db.add(Setting(key_name=key, value=value))
    await db.commit()


async def get_all_runtime_settings(db: AsyncSession) -> dict:
    """
    运行时完整配置：用于 LLM 推理。
    顺序：DB → DEFAULT_SETTINGS → .env(仅 api_key 兜底)
    LLM 与 Embedding 可独立配置；Embedding 的 base_url/api_key 缺省时回落到 LLM 端
    """
    cfg = get_settings()
    base_url = await get_value(db, "deepseek_base_url")
    embedding_base_url = await get_value(db, "embedding_base_url")
    embedding_model = await get_value(db, "embedding_model")
    temperature = float(await get_value(db, "temperature"))
    top_k = int(await get_value(db, "top_k"))
    llm_model = await get_value(db, "llm_model")
    system_prompt = await get_value(db, "system_prompt")
    ai_style = await get_value(db, "ai_style")

    db_api_key = await get_value_or_none(db, "deepseek_api_key")
    api_key = db_api_key if db_api_key else cfg.DEEPSEEK_API_KEY

    db_emb_key = await get_value_or_none(db, "embedding_api_key")
    embedding_api_key_explicit = db_emb_key is not None
    embedding_api_key = db_emb_key if db_emb_key else api_key

    return {
        "api_key": api_key,
        "base_url": base_url or cfg.DEEPSEEK_BASE_URL,
        "llm_model": llm_model,
        "embedding_base_url": embedding_base_url or base_url or cfg.DEEPSEEK_BASE_URL,
        "embedding_api_key": embedding_api_key,
        "embedding_api_key_explicit": embedding_api_key_explicit,
        "embedding_model": embedding_model or cfg.EMBEDDING_MODEL,
        "temperature": temperature,
        "top_k": top_k,
        "system_prompt": system_prompt,
        "ai_style": ai_style,
    }


async def get_all_settings(db: AsyncSession) -> dict:
    """
    向后兼容：返回用户端可读字段（不包含 api_key 等敏感信息）
    """
    runtime = await get_all_runtime_settings(db)
    return {
        "temperature": runtime["temperature"],
        "top_k": runtime["top_k"],
        "llm_model": runtime["llm_model"],
        "system_prompt": runtime["system_prompt"],
    }
