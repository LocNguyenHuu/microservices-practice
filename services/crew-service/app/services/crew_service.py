# CrewService handles CRUD operations for crew members, certifications, and shifts.
# All database access uses async SQLAlchemy sessions.

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.crew_member import CrewMember
from ..models.certification import Certification
from ..models.shift import Shift
from ..models.team import Team
from ..models.task_assignment import TaskAssignment

logger = logging.getLogger("crew-service")


# --- Crew Members ---

async def create_crew_member(db: AsyncSession, data: dict) -> CrewMember:
    member = CrewMember(**data)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    logger.info(f"Crew member created: {member.employee_id} ({member.first_name} {member.last_name})")
    return member


async def get_crew_member(db: AsyncSession, member_id: uuid.UUID) -> CrewMember | None:
    stmt = (
        select(CrewMember)
        .options(selectinload(CrewMember.certifications))
        .where(CrewMember.id == member_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_crew_members(
    db: AsyncSession,
    team_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CrewMember]:
    stmt = (
        select(CrewMember)
        .options(selectinload(CrewMember.certifications))
        .order_by(CrewMember.last_name)
    )
    if team_id is not None:
        stmt = stmt.where(CrewMember.team_id == team_id)
    if is_active is not None:
        stmt = stmt.where(CrewMember.is_active == is_active)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_crew_member(
    db: AsyncSession, member_id: uuid.UUID, data: dict
) -> CrewMember | None:
    member = await get_crew_member(db, member_id)
    if member is None:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(member, key, value)
    await db.commit()
    await db.refresh(member)
    return member


# --- Teams ---

async def create_team(db: AsyncSession, data: dict) -> Team:
    team = Team(**data)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    logger.info(f"Team created: {team.name} (terminal {team.terminal})")
    return team


async def list_teams(db: AsyncSession) -> list[Team]:
    result = await db.execute(select(Team).order_by(Team.name))
    return list(result.scalars().all())


# --- Certifications ---

async def add_certification(
    db: AsyncSession, member_id: uuid.UUID, data: dict
) -> Certification:
    cert = Certification(crew_member_id=member_id, **data)
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    logger.info(f"Certification added: {cert.cert_type} for crew {member_id}")
    return cert


async def list_certifications(
    db: AsyncSession, member_id: uuid.UUID
) -> list[Certification]:
    stmt = (
        select(Certification)
        .where(Certification.crew_member_id == member_id)
        .order_by(Certification.cert_type)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- Shifts ---

async def create_shift(db: AsyncSession, member_id: uuid.UUID, data: dict) -> Shift:
    shift = Shift(crew_member_id=member_id, **data)
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    logger.info(f"Shift created: {shift.shift_date} for crew {member_id}")
    return shift


async def list_shifts(
    db: AsyncSession, member_id: uuid.UUID, shift_date: str | None = None
) -> list[Shift]:
    stmt = (
        select(Shift)
        .where(Shift.crew_member_id == member_id)
        .order_by(Shift.shift_date.desc())
    )
    if shift_date is not None:
        stmt = stmt.where(Shift.shift_date == shift_date)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- Assignments ---

async def list_assignments(
    db: AsyncSession,
    turnaround_id: str | None = None,
    crew_member_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[TaskAssignment]:
    stmt = select(TaskAssignment).order_by(TaskAssignment.assigned_at.desc())
    if turnaround_id is not None:
        stmt = stmt.where(TaskAssignment.turnaround_id == turnaround_id)
    if crew_member_id is not None:
        stmt = stmt.where(TaskAssignment.crew_member_id == crew_member_id)
    if status is not None:
        stmt = stmt.where(TaskAssignment.status == status)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())
