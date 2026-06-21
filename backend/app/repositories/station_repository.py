from typing import Dict, List, Optional

from fastapi import Depends
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.fir import PoliceStation


class StationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, station_id: str) -> Optional[PoliceStation]:
        return await self.session.get(PoliceStation, station_id)

    async def get_all(self) -> List[PoliceStation]:
        result = await self.session.exec(select(PoliceStation))
        return list(result.all())

    async def get_by_district(self, district: str) -> List[PoliceStation]:
        result = await self.session.exec(
            select(PoliceStation)
            .where(func.lower(PoliceStation.district) == district.lower())
            .order_by(PoliceStation.name)
        )
        return list(result.all())

    async def get_districts(self) -> List[str]:
        rows = (
            await self.session.exec(
                select(PoliceStation.district)
                .distinct()
                .where(PoliceStation.district != "Unknown")
                .order_by(PoliceStation.district)
            )
        ).all()
        return [r for r in rows if r and r.strip()]

    async def get_by_name(self, name: str) -> Optional[PoliceStation]:
        result = await self.session.exec(
            select(PoliceStation).where(PoliceStation.name == name)
        )
        return result.first()

    async def get_ids_by_district(self, district: str) -> List[str]:
        rows = (
            await self.session.exec(
                select(PoliceStation.id).where(
                    func.lower(PoliceStation.district) == district.lower()
                )
            )
        ).all()
        return list(rows)

    async def get_id_name_map_by_district(self, district: str) -> Dict[str, str]:
        rows = (
            await self.session.exec(
                select(PoliceStation.id, PoliceStation.name).where(
                    func.lower(PoliceStation.district) == district.lower()
                )
            )
        ).all()
        return {row[0]: row[1] for row in rows}

    async def count_all(self) -> int:
        return (
            await self.session.exec(select(func.count(PoliceStation.id)))
        ).one()

    async def create(self, station: PoliceStation) -> PoliceStation:
        self.session.add(station)
        await self.session.flush()
        await self.session.refresh(station)
        return station

    async def upsert_from_osm(self, station: PoliceStation) -> PoliceStation:
        """Persist an OSM-sourced station within the current transaction (no commit)."""
        self.session.add(station)
        await self.session.flush()
        return station


async def get_station_repo(
    session: AsyncSession = Depends(get_session),
) -> StationRepository:
    return StationRepository(session)
