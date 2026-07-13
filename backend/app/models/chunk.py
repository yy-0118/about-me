from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.models import Base


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, comment="所属文档")
    chunk_index = Column(Integer, default=0, comment="块序号")
    chunk_text = Column(Text, nullable=False, comment="文本内容")
    embedding = Column(Text, nullable=True, comment="向量数据（JSON）")
    metadata_json = Column(Text, nullable=True, comment="元数据（JSON）")
    created_at = Column(DateTime, server_default=func.now())

    document = relationship("Document", backref="chunks")
