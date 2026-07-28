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


_HEADING_RE = re.compile(
    r"(?m)^\s*(?:"                    # 行首（允许前置空白）
    r"#{1,6}\s+\S.*"                  # markdown 标题: # / ## / ###
    r"|[一二三四五六七八九十百千]+[、.]\s*\S.*"   # 中文编号: 一、 二.
    r"|\d+[.、]\s*\S.*"               # 阿拉伯数字编号: 1. 2、
    r")$"
)


def _split_into_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n") if p.strip()]


def _is_heading_line(line: str) -> bool:
    return bool(_HEADING_RE.match(line.strip()))


def _pack(header: str, items: list[str]) -> str:
    """把 header 注入到 chunk 头部"""
    if header and items:
        return header + "\n" + "\n".join(items)
    return "\n".join(items)


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    header: str = "",
) -> list[str]:
    """
    将文本分块
    header: 文档级上下文（如文件名、章节名），会作为每个 chunk 的首行注入，
            让 embedding 同时看到"该 chunk 属于哪个文档/小节"，避免
            "联系方式 chunk 比教育背景 chunk 短而整齐、相似度反而更高"的问题。
    策略：
      - 若文本含 heading（markdown / 中文编号 / 阿拉伯数字编号）→ 按 heading 切分，
        chunk 头部 = header + 当前 heading（避免跨小节混合）
      - 否则走段落合并切分，每个 chunk 头部 = header
    """
    paragraphs = _split_into_paragraphs(text)
    if not paragraphs:
        return []

    use_heading_split = any(_is_heading_line(p) for p in paragraphs)

    if use_heading_split:
        return _chunk_by_heading(paragraphs, chunk_size, overlap, header)

    return _chunk_by_paragraph(paragraphs, chunk_size, overlap, header)


def _chunk_by_heading(
    paragraphs: list[str], chunk_size: int, overlap: int, header: str
) -> list[str]:
    """按 heading 行切分；同一个 heading 下的内容过长时再按字符切。"""
    sections: list[tuple[str, list[str]]] = []
    current_heading = ""
    current_body: list[str] = []

    for p in paragraphs:
        if _is_heading_line(p):
            if current_body or current_heading:
                sections.append((current_heading, current_body))
            current_heading = p
            current_body = []
        else:
            current_body.append(p)
    if current_body or current_heading:
        sections.append((current_heading, current_body))

    chunks: list[str] = []
    for heading, body in sections:
        section_header = "\n".join([header, heading]).strip() if header else heading
        if not body:
            if section_header:
                chunks.append(section_header)
            continue
        body_text = "\n".join(body)
        if len(section_header) + len(body_text) + 1 <= chunk_size:
            chunks.append(_pack(section_header, [""]))
            chunks[-1] = (chunks[-1] + body_text).strip()
            continue
        for sub in _split_long_body(body, chunk_size - len(section_header) - 1, overlap):
            chunks.append(_pack(section_header, [sub]))

    return [c for c in chunks if c.strip()]


def _split_long_body(body_lines: list[str], budget: int, overlap: int) -> list[str]:
    """超长 body 按段落 + 句子切分到 budget 以内。"""
    out: list[str] = []
    current: list[str] = []
    cur_len = 0
    for line in body_lines:
        if len(line) > budget:
            for sent in re.split(r"(?<=[。！？.!?\n])", line):
                if not sent.strip():
                    continue
                if cur_len + len(sent) > budget and current:
                    out.append("\n".join(current))
                    tail = "\n".join(current)[-overlap:] if overlap > 0 else ""
                    current = [tail] if tail else []
                    cur_len = len(tail)
                current.append(sent.strip())
                cur_len += len(sent)
            continue
        if cur_len + len(line) > budget and current:
            out.append("\n".join(current))
            tail = "\n".join(current)[-overlap:] if overlap > 0 else ""
            current = [tail] if tail else []
            cur_len = len(tail)
        current.append(line)
        cur_len += len(line)
    if current:
        out.append("\n".join(current))
    return out


def _chunk_by_paragraph(
    paragraphs: list[str], chunk_size: int, overlap: int, header: str
) -> list[str]:
    """无 heading 时按段落合并切分，每个 chunk 都带 header 前缀。"""
    header_cost = len(header) + 1 if header else 0
    budget = max(chunk_size - header_cost, 50)

    chunks: list[str] = []
    current: list[str] = []
    cur_len = 0

    for para in paragraphs:
        if len(para) > budget:
            for sent in re.split(r"(?<=[。！？.!?])", para):
                if not sent.strip():
                    continue
                if cur_len + len(sent) > budget and current:
                    chunks.append(_pack(header, current))
                    tail = "\n".join(current)[-overlap:] if overlap > 0 else ""
                    current = [tail] if tail else []
                    cur_len = len(tail)
                current.append(sent.strip())
                cur_len += len(sent)
        else:
            if cur_len + len(para) > budget and current:
                chunks.append(_pack(header, current))
                tail = "\n".join(current)[-overlap:] if overlap > 0 else ""
                current = [tail] if tail else []
                cur_len = len(tail)
            current.append(para)
            cur_len += len(para)

    if current:
        chunks.append(_pack(header, current))

    return [c for c in chunks if c.strip()]


def is_supported(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_TYPES
