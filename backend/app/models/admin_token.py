from sqlalchemy import Column, String, DateTime, func
from app.models import Base


class AdminToken(Base):
    __tablename__ = "admin_tokens"

    token = Column(String(128), primary_key=True, comment="token")
    expires_at = Column(DateTime, nullable=False, comment="过期时间")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
