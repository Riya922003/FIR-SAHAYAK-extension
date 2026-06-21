from typing import List, Optional

from fastapi import Depends
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.models.user import User
from app.models.enums import UserRole


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: str) -> Optional[User]:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.exec(select(User).where(User.email == email))
        return result.first()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.session.exec(select(User).where(User.username == username))
        return result.first()

    async def exists_duplicate(self, email: str, username: str, aadhar_number: str) -> bool:
        result = await self.session.exec(
            select(User).where(
                (User.email == email)
                | (User.username == username)
                | (User.aadhar_number == aadhar_number)
            )
        )
        return result.first() is not None

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def update(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def get_all(self, role: Optional[UserRole] = None) -> List[User]:
        query = select(User)
        if role:
            query = query.where(User.role == role)
        result = await self.session.exec(query)
        return list(result.all())

    async def get_by_station_ids(
        self, station_ids: List[str], roles: List[UserRole]
    ) -> List[User]:
        result = await self.session.exec(
            select(User)
            .where(User.station_id.in_(station_ids))
            .where(User.role.in_(roles))
            .order_by(User.full_name)
        )
        return list(result.all())

    async def count_all(self) -> int:
        return (await self.session.exec(select(func.count(User.id)))).one()


async def get_user_repo(
    session: AsyncSession = Depends(get_session),
) -> UserRepository:
    return UserRepository(session)
