from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import Depends
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import FIR
from app.models.enums import FIRStatus


class FIRRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def generate_number(self) -> str:
        year = datetime.utcnow().year
        count = (await self.session.exec(select(func.count(FIR.id)))).one()
        return f"FIR-{year}-{count + 1:05d}"

    async def get_by_id(self, fir_id: str) -> Optional[FIR]:
        return await self.session.get(FIR, fir_id)

    async def get_by_citizen(
        self, citizen_id: str, status_filter: Optional[FIRStatus] = None
    ) -> List[FIR]:
        query = select(FIR).where(FIR.citizen_id == citizen_id)
        if status_filter:
            query = query.where(FIR.status == status_filter)
        result = await self.session.exec(query.order_by(FIR.created_at.desc()))
        return list(result.all())

    async def get_by_station_unassigned(self, station_id: str) -> List[FIR]:
        result = await self.session.exec(
            select(FIR)
            .where(FIR.station_id == station_id)
            .where(FIR.status == FIRStatus.SUBMITTED)
            .where(FIR.officer_id.is_(None))
            .order_by(FIR.created_at.asc())
        )
        return list(result.all())

    async def get_by_officer(
        self, officer_id: str, status_filter: Optional[FIRStatus] = None
    ) -> List[FIR]:
        query = select(FIR).where(FIR.officer_id == officer_id)
        if status_filter:
            query = query.where(FIR.status == status_filter)
        result = await self.session.exec(query.order_by(FIR.updated_at.desc()))
        return list(result.all())

    async def get_by_station(
        self, station_id: str, status_filter: Optional[FIRStatus] = None
    ) -> List[FIR]:
        query = select(FIR).where(FIR.station_id == station_id)
        if status_filter:
            query = query.where(FIR.status == status_filter)
        result = await self.session.exec(query.order_by(FIR.created_at.desc()))
        return list(result.all())

    async def get_by_station_ids(
        self,
        station_ids: List[str],
        status: Optional[FIRStatus] = None,
    ) -> List[FIR]:
        query = select(FIR).where(FIR.station_id.in_(station_ids))
        if status:
            query = query.where(FIR.status == status)
        result = await self.session.exec(query.order_by(FIR.updated_at.desc()))
        return list(result.all())

    async def get_partial_by_station_ids(
        self, station_ids: List[str]
    ) -> List[Tuple[str, str, str]]:
        """Returns (id, fir_number, station_id) — lightweight lookup for directive log."""
        result = await self.session.exec(
            select(FIR.id, FIR.fir_number, FIR.station_id).where(
                FIR.station_id.in_(station_ids)
            )
        )
        return list(result.all())

    async def count_total(self) -> int:
        return (await self.session.exec(select(func.count(FIR.id)))).one()

    async def count_by_status(self, status: FIRStatus) -> int:
        return (
            await self.session.exec(
                select(func.count(FIR.id)).where(FIR.status == status)
            )
        ).one()

    async def count_by_station_ids_and_statuses(
        self, station_ids: List[str], statuses: List[FIRStatus]
    ) -> int:
        return (
            await self.session.exec(
                select(func.count(FIR.id))
                .where(FIR.station_id.in_(station_ids))
                .where(FIR.status.in_(statuses))
            )
        ).one()

    async def count_by_station_ids_status_since(
        self, station_ids: List[str], status: FIRStatus, since: datetime
    ) -> int:
        return (
            await self.session.exec(
                select(func.count(FIR.id))
                .where(FIR.station_id.in_(station_ids))
                .where(FIR.status == status)
                .where(FIR.updated_at >= since)
            )
        ).one()

    async def create(self, fir: FIR) -> FIR:
        self.session.add(fir)
        await self.session.flush()
        await self.session.refresh(fir)
        return fir

    async def update(self, fir: FIR) -> FIR:
        self.session.add(fir)
        await self.session.flush()
        await self.session.refresh(fir)
        return fir


async def get_fir_repo(
    session: AsyncSession = Depends(get_session),
) -> FIRRepository:
    return FIRRepository(session)
