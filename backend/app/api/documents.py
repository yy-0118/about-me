from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import os
import shutil
import json

from app.database import get_db
from app.config import get_settings
from app.models.document import Document
from app.models.chunk import Chunk
from app.services.document_processor import extract_text, chunk_text, is_supported
from app.services.embedding_service import EmbeddingService
from app.schemas.document import DocumentResponse, DocumentListResponse, DeleteResponse

router = APIRouter(prefix="/api/documents", tags=["文档管理"])


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """上传文档并建立索引"""
    if not file.filename or not is_supported(file.filename):
        raise HTTPException(400, f"不支持的文件类型: {file.filename}")

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # 保存文件
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(400, "文件大小超过限制（20MB）")

    with open(file_path, "wb") as f:
        f.write(content)

    # 提取文本 + 分块
    raw_text = extract_text(file_path)
    chunks = chunk_text(raw_text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)

    # 保存文档记录
    doc = Document(
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        file_type=file.filename.rsplit(".", 1)[-1].lower(),
        chunk_count=len(chunks),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 生成向量并保存块
    embed_service = EmbeddingService()
    for i, chunk_text_content in enumerate(chunks):
        try:
            embedding = await embed_service.embed(chunk_text_content)
        except Exception:
            embedding = []
        chunk = Chunk(
            document_id=doc.id,
            chunk_index=i,
            chunk_text=chunk_text_content,
            embedding=json.dumps(embedding) if embedding else None,
            metadata_json=json.dumps({"chunk_index": i}, ensure_ascii=False),
        )
        db.add(chunk)

    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("", response_model=DocumentListResponse)
async def list_documents(db: AsyncSession = Depends(get_db)):
    """获取文档列表"""
    from sqlalchemy import select
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    items = result.scalars().all()
    return DocumentListResponse(total=len(items), items=list(items))


@router.delete("/{doc_id}", response_model=DeleteResponse)
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """删除文档及其索引"""
    from sqlalchemy import select
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "文档不存在")

    # 删除物理文件
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # 删除数据库记录（级联删除 chunks）
    await db.delete(doc)
    await db.commit()
    return DeleteResponse(message="删除成功")
