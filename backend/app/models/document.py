from sqlalchemy import Column, Integer, String, DateTime, func
from app.models import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False, comment="原始文件名")
    file_path = Column(String(500), nullable=False, comment="服务器存储路径")
    file_size = Column(Integer, default=0, comment="文件大小（字节）")
    file_type = Column(String(50), default="", comment="文件类型")
    chunk_count = Column(Integer, default=0, comment="分块数量")
    created_at = Column(DateTime, server_default=func.now(), comment="上传时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
