from sqlalchemy import Column, Integer, String, DateTime, func
from app.models import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(String(128), nullable=True, index=True, comment="设备或 IP 隔离 ID")
    client_ip = Column(String(64), nullable=True, comment="最近访问 IP")
    title = Column(String(255), default="新对话", comment="会话标题")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )
