"""
一次性脚本：把 backend/uploads/samples/ 下的 .md 文档灌入系统。
- 复制到 UPLOAD_DIR（保持原文件名）
- 写入 Document 行
- 调用现有 chunker + embedding service 写 Chunk 行 + 向量

用法：
    cd backend
    venv/Scripts/python scripts/ingest_samples.py             # 灌入示例
    venv/Scripts/python scripts/ingest_samples.py --re-embed  # 仅对已存在 chunk 重新生成向量
"""
import os
import sys
import asyncio
import shutil
import json
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings
from app.database import init_db, async_session
from app.services.document_processor import extract_text, chunk_text
from app.services.embedding_service import EmbeddingService
from app.services.setting_service import get_all_runtime_settings
from app.models.document import Document
from app.models.chunk import Chunk
from sqlalchemy import select, func


SAMPLES_DIR = BACKEND_ROOT / "uploads" / "samples"


async def ingest_one(path: Path, db, embed_service: EmbeddingService) -> dict:
    filename = path.name
    file_size = path.stat().st_size
    file_type = path.suffix.lstrip(".").lower() or "md"

    # 1) 抽文本 + 分块
    try:
        raw_text = extract_text(str(path))
    except Exception as e:
        return {"file": filename, "ok": False, "error": f"extract_text: {e}"}
    if not raw_text or not raw_text.strip():
        return {"file": filename, "ok": False, "error": "空文档，跳过"}

    settings = get_settings()
    chunks_text = chunk_text(raw_text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
    if not chunks_text:
        return {"file": filename, "ok": False, "error": "分块结果为空"}

    # 2) Document 行
    doc = Document(
        filename=filename,
        file_path=str(path),
        file_size=file_size,
        file_type=file_type,
        chunk_count=len(chunks_text),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 3) 向量 + Chunk 行
    success_vec = 0
    for i, text in enumerate(chunks_text):
        try:
            embedding = await embed_service.embed(text)
            ok = bool(embedding)
        except Exception:
            embedding = []
            ok = False
        if ok:
            success_vec += 1
        chunk = Chunk(
            document_id=doc.id,
            chunk_index=i,
            chunk_text=text,
            embedding=json.dumps(embedding) if embedding else None,
            metadata_json=json.dumps({"chunk_index": i, "source": "samples"}, ensure_ascii=False),
        )
        db.add(chunk)
    await db.commit()

    return {
        "file": filename,
        "ok": True,
        "doc_id": doc.id,
        "chunks": len(chunks_text),
        "vec_ok": success_vec,
    }


async def re_embed_all():
    """对数据库中所有 chunk 重新生成向量（按当前 embedding 配置）"""
    await init_db()
    async with async_session() as db:
        runtime = await get_all_runtime_settings(db)
        embed_service = EmbeddingService(
            api_key=runtime["embedding_api_key"],
            base_url=runtime["embedding_base_url"],
            model=runtime["embedding_model"],
        )
        print(f"Embedding 配置：base={runtime['embedding_base_url']}  model={runtime['embedding_model']}")
        print(f"API key 已配置：{bool(runtime['embedding_api_key'])}\n")

        if not runtime["embedding_api_key"]:
            print("⚠ 未配置 embedding_api_key，无法重新生成向量")
            print("  请先在「管理后台 → LLM API」里配置 Embedding 凭据后重试。")
            return

        chunks = (await db.execute(select(Chunk).order_by(Chunk.id.asc()))).scalars().all()
        if not chunks:
            print("数据库里还没有 chunk，无需 re-embed")
            return

        print(f"准备为 {len(chunks)} 个 chunk 重新生成向量…\n")
        ok, fail = 0, 0
        for c in chunks:
            try:
                vec = await embed_service.embed(c.chunk_text)
                if vec:
                    c.embedding = json.dumps(vec)
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                fail += 1
                print(f"  ✗ chunk#{c.id} 失败: {e}")
        await db.commit()
        print(f"\n完成：{ok} 成功，{fail} 失败")


async def main():
    if "--re-embed" in sys.argv:
        await re_embed_all()
        return

    if not SAMPLES_DIR.exists():
        print(f"✗ 找不到目录: {SAMPLES_DIR}")
        return

    files = sorted(SAMPLES_DIR.glob("*.md"))
    if not files:
        print(f"✗ 目录里没有 .md 文件: {SAMPLES_DIR}")
        return

    print(f"找到 {len(files)} 个示例文档，准备入库…\n")

    await init_db()

    async with async_session() as db:
        runtime = await get_all_runtime_settings(db)
        embed_service = EmbeddingService(
            api_key=runtime["embedding_api_key"],
            base_url=runtime["embedding_base_url"],
            model=runtime["embedding_model"],
        )
        print(f"Embedding 配置：base={runtime['embedding_base_url']}  model={runtime['embedding_model']}")
        print(f"API key 已配置：{bool(runtime['embedding_api_key'])}\n")

        # 检查同名已存在
        existing = (
            await db.execute(select(Document.filename))
        ).scalars().all()
        existing_set = set(existing)

        for p in files:
            if p.name in existing_set:
                print(f"  ↩ 跳过（已存在）: {p.name}")
                continue
            print(f"  → 正在入库: {p.name}  ({p.stat().st_size} B)")
            r = await ingest_one(p, db, embed_service)
            if r["ok"]:
                print(f"    ✓ doc_id={r['doc_id']}  chunks={r['chunks']}  向量成功={r['vec_ok']}/{r['chunks']}")
            else:
                print(f"    ✗ 失败: {r.get('error', 'unknown')}")

    # 统计最终状态
    async with async_session() as db:
        total_docs = (await db.execute(select(func.count(Document.id)))).scalar_one()
        total_chunks = (await db.execute(select(func.count(Chunk.id)))).scalar_one()
        print()
        print("=" * 50)
        print(f"完成。当前数据库：文档 {total_docs} 个，文本块 {total_chunks} 个。")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
