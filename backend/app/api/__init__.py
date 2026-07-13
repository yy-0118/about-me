from app.api import documents, chat
from app.database import init_db


def register_routers(app):
    """注册所有 API 路由"""
    app.include_router(documents.router)
    app.include_router(chat.router)

    @app.on_event("startup")
    async def startup():
        await init_db()
