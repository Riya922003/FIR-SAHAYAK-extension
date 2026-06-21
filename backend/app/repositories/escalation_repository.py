from typing import List, Optional

from fastapi import Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import Escalation
from app.models.enums import EscalationStatus


class EscalationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, escalation: Escalation) -> Escalation:
        self.session.add(escalation)
        await self.session.flush()
        return escalation

    async def get_by_authority(
        self,
        authority_id: str,
        status_filter: Optional[EscalationStatus] = None,
    ) -> List[Escalation]:
        query = select(Escalation).where(Escalation.escalated_to == authority_id)
        if status_filter:
            query = query.where(Escalation.status == status_filter)
        result = await self.session.exec(query.order_by(Escalation.created_at.desc()))
        return list(result.all())


async def get_escalation_repo(
    session: AsyncSession = Depends(get_session),
) -> EscalationRepository:
    return EscalationRepository(session)
