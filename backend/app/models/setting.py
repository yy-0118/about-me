from sqlalchemy import Column, String, Text, DateTime, func
from app.models import Base


class Setting(Base):
    __tablename__ = "settings"

    key_name = Column(String(64), primary_key=True, comment="设置项 key")
    value = Column(Text, nullable=False, comment="值(JSON 或字符串)")
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )
