"""
文档解析 + 文本分块服务
扩展方式：添加新的解析函数并注册到 SUPPORTED_TYPES
"""
import os
import re
from pathlib import Path
from typing import Optional


SUPPORTED_TYPES = {
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def extract_text(file_path: str) -> str:
    """根据文件类型提取文本"""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext == ".md":
        return _extract_md(file_path)
    elif ext == ".txt":
        return _extract_txt(file_path)
    elif ext == ".docx":
        return _extract_docx(file_path)
    else:
        raise ValueError(f"不支持的文件类型: {ext}")


def _extract_pdf(file_path: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            texts.append(text)
    return "\n".join(texts)


def _extract_md(file_path: str) -> str:
    import markdown
    from html import unescape
    with open(file_path, "r", encoding="utf-8") as f:
        html = markdown.markdown(f.read())
    # 去除 HTML 标签
    text = re.sub(r"<[^>]+>", "", html)
    return unescape(text)


def _extract_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def _extract_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    将文本分块
    策略：按段落分割 → 合并到接近 chunk_size → 带 overlap
    """
    # 按段落分割
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return []

    chunks = []
    current = []
    current_len = 0

    for para in paragraphs:
        # 如果单个段落太长，按句号分割
        if len(para) > chunk_size:
            sentences = re.split(r"(?<=[。！？.!?])", para)
            for sent in sentences:
                if not sent.strip():
                    continue
                if current_len + len(sent) > chunk_size and current:
                    chunks.append("\n".join(current))
                    # overlap: 保留最后一部分
                    overlap_text = "\n".join(current)[-overlap:] if overlap > 0 else ""
                    current = [overlap_text] if overlap_text else []
                    current_len = len(overlap_text)
                current.append(sent.strip())
                current_len += len(sent)
        else:
            if current_len + len(para) > chunk_size and current:
                chunks.append("\n".join(current))
                overlap_text = "\n".join(current)[-overlap:] if overlap > 0 else ""
                current = [overlap_text] if overlap_text else []
                current_len = len(overlap_text)
            current.append(para)
            current_len += len(para)

    if current:
        chunks.append("\n".join(current))

    return chunks


def is_supported(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_TYPES
