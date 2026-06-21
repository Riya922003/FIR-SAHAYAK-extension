from typing import List, Optional

from fastapi import Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import FIRStatusHistory
from app.models.enums import FIRStatus


class StatusHistoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, history: FIRStatusHistory) -> FIRStatusHistory:
        self.session.add(history)
        await self.session.flush()
        return history

    async def get_by_fir(self, fir_id: str) -> List[FIRStatusHistory]:
        result = await self.session.exec(
            select(FIRStatusHistory)
            .where(FIRStatusHistory.fir_id == fir_id)
            .order_by(FIRStatusHistory.changed_at)
        )
        return list(result.all())

    async def get_last_escalation_entry(
        self, fir_id: str
    ) -> Optional[FIRStatusHistory]:
        result = await self.session.exec(
            select(FIRStatusHistory)
            .where(FIRStatusHistory.fir_id == fir_id)
            .where(FIRStatusHistory.new_status == FIRStatus.ESCALATED)
            .order_by(FIRStatusHistory.changed_at.desc())
        )
        return result.first()

    async def get_directives_by_fir_ids(
        self, fir_ids: List[str]
    ) -> List[FIRStatusHistory]:
        result = await self.session.exec(
            select(FIRStatusHistory)
            .where(FIRStatusHistory.fir_id.in_(fir_ids))
            .where(FIRStatusHistory.notes.contains("[Authority Directive]"))
            .order_by(FIRStatusHistory.changed_at.desc())
        )
        return list(result.all())


async def get_history_repo(
    session: AsyncSession = Depends(get_session),
) -> StatusHistoryRepository:
    return StatusHistoryRepository(session)
