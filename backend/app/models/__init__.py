from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.document import Document  # noqa: E402
from app.models.chunk import Chunk  # noqa: E402
from app.models.chat_session import ChatSession  # noqa: E402
from app.models.chat_message import ChatMessage  # noqa: E402
from app.models.setting import Setting  # noqa: E402
from app.models.admin_token import AdminToken  # noqa: E402

__all__ = [
    "Base",
    "Document",
    "Chunk",
    "ChatSession",
    "ChatMessage",
    "Setting",
    "AdminToken",
]
