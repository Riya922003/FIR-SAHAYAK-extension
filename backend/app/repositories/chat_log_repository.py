from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import ChatLog


class ChatLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, log: ChatLog) -> ChatLog:
        self.session.add(log)
        await self.session.flush()
        return log


async def get_chat_log_repo(
    session: AsyncSession = Depends(get_session),
) -> ChatLogRepository:
    return ChatLogRepository(session)
