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
from app.services.setting_service import get_all_runtime_settings
from app.schemas.document import DocumentResponse, DocumentListResponse, DeleteResponse, DocumentPreviewResponse, DocumentContentUpdate
from app.auth import require_admin

router = APIRouter(prefix="/api/documents", tags=["文档管理"])


@router.post("/upload", response_model=DocumentResponse, dependencies=[Depends(require_admin)])
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

    # 生成向量并保存块（使用运行时配置：管理员可在后台切换 embedding 模型、API Key、base_url）
    runtime = await get_all_runtime_settings(db)
    embed_service = EmbeddingService(
        api_key=runtime["embedding_api_key"],
        base_url=runtime["embedding_base_url"],
        model=runtime["embedding_model"],
    )
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


@router.get("/{doc_id}/preview", response_model=DocumentPreviewResponse, dependencies=[Depends(require_admin)])
async def preview_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Preview an uploaded document as extracted text."""
    from sqlalchemy import select

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "文档不存在")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "原始文件不存在")

    try:
        content = extract_text(doc.file_path)
    except Exception as exc:
        raise HTTPException(500, f"文档预览失败: {exc}") from exc

    return DocumentPreviewResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        content=content,
    )


@router.put("/{doc_id}/content", response_model=DocumentPreviewResponse, dependencies=[Depends(require_admin)])
async def update_document_content(
    doc_id: int, payload: DocumentContentUpdate, db: AsyncSession = Depends(get_db)
):
    """在线修改文档内容：重写文件 → 重新分块 → 重新生成向量"""
    from sqlalchemy import select, delete

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "文档不存在")

    # 1. 重写文件
    new_text = payload.content
    os.makedirs(os.path.dirname(doc.file_path) or ".", exist_ok=True)
    with open(doc.file_path, "w", encoding="utf-8") as f:
        f.write(new_text)

    # 2. 删除旧 chunks（ondelete CASCADE 不自动触发 delete，手动删）
    await db.execute(delete(Chunk).where(Chunk.document_id == doc.id))

    # 3. 重新分块
    settings = get_settings()
    chunks = chunk_text(new_text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)

    # 4. 重新生成向量
    runtime = await get_all_runtime_settings(db)
    embed_service = EmbeddingService(
        api_key=runtime["embedding_api_key"],
        base_url=runtime["embedding_base_url"],
        model=runtime["embedding_model"],
    )
    import json
    for i, text in enumerate(chunks):
        try:
            embedding = await embed_service.embed(text)
        except Exception:
            embedding = []
        chunk = Chunk(
            document_id=doc.id,
            chunk_index=i,
            chunk_text=text,
            embedding=json.dumps(embedding) if embedding else None,
            metadata_json=json.dumps({"chunk_index": i, "source": "inline-edit"}, ensure_ascii=False),
        )
        db.add(chunk)

    # 5. 更新文档记录
    doc.chunk_count = len(chunks)
    doc.file_size = len(new_text.encode("utf-8"))
    await db.commit()
    await db.refresh(doc)

    return DocumentPreviewResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        content=new_text,
    )


@router.delete("/{doc_id}", response_model=DeleteResponse, dependencies=[Depends(require_admin)])
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a document and its indexed chunks."""
    from sqlalchemy import delete, select

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "文档不存在")

    file_path = doc.file_path
    await db.execute(delete(Chunk).where(Chunk.document_id == doc.id))
    await db.delete(doc)
    await db.commit()

    if os.path.exists(file_path):
        os.remove(file_path)
    return DeleteResponse(message="删除成功")
