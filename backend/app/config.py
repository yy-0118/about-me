from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # 应用
    APP_NAME: str = "Knowledge RAG"
    DEBUG: bool = False

    # 数据库（sqlite 或 mysql）
    # 本地开发默认用 sqlite，生产环境设为 mysql
    DB_TYPE: str = "sqlite"  # sqlite | mysql

    # MySQL 配置（DB_TYPE=mysql 时生效）
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "knowledge_rag"

    # SQLite 配置（DB_TYPE=sqlite 时生效）
    SQLITE_PATH: str = "data.db"

    # DeepSeek API
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    LLM_MODEL: str = "deepseek-v4-flash"
    EMBEDDING_MODEL: str = "deepseek-embedding"

    # 文档上传
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024  # 20MB

    # 向量检索
    TOP_K: int = 5

    # 文本分块
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
