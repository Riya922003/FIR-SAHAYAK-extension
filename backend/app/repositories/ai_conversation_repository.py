from datetime import datetime
from typing import Optional

from fastapi import Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import AIConversation


class AIConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_fir_id(self, fir_id: str) -> Optional[AIConversation]:
        result = await self.session.exec(
            select(AIConversation).where(AIConversation.fir_id == fir_id)
        )
        return result.first()

    async def create(self, conv: AIConversation) -> AIConversation:
        self.session.add(conv)
        await self.session.flush()
        await self.session.refresh(conv)
        return conv

    async def update(self, conv: AIConversation) -> AIConversation:
        conv.updated_at = datetime.utcnow()
        self.session.add(conv)
        await self.session.flush()
        await self.session.refresh(conv)
        return conv


async def get_conv_repo(
    session: AsyncSession = Depends(get_session),
) -> AIConversationRepository:
    return AIConversationRepository(session)
