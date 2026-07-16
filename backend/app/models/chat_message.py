from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func, Index
from sqlalchemy.orm import relationship
from app.models import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属会话",
    )
    role = Column(String(20), nullable=False, comment="user | assistant")
    content = Column(Text, nullable=False, comment="消息内容")
    sources = Column(Text, nullable=True, comment="引用来源 JSON")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")

    session = relationship("ChatSession", backref="messages")

    __table_args__ = (
        Index("idx_chat_messages_session_created", "session_id", "created_at"),
    )
