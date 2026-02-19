# Crew member CRUD endpoints.
# POST /api/crew, GET /api/crew, GET /api/crew/:id, PATCH /api/crew/:id

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.crew_member import CrewMemberCreate, CrewMemberUpdate, CrewMemberResponse
from ..services import crew_service

router = APIRouter(prefix="/api/crew", tags=["crew"])


@router.post("", response_model=CrewMemberResponse, status_code=201)
async def create_crew_member(
    body: CrewMemberCreate, db: AsyncSession = Depends(get_db)
):
    member = await crew_service.create_crew_member(db, body.model_dump())
    return member


@router.get("", response_model=list[CrewMemberResponse])
async def list_crew_members(
    team_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    return await crew_service.list_crew_members(
        db, team_id=team_id, is_active=is_active, limit=limit, offset=offset
    )


@router.get("/available", response_model=list[CrewMemberResponse])
async def find_available_crew(
    certification: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Find crew members available for assignment (on shift, not busy, has cert)."""
    from ..services.assignment_service import find_available_crew as find_avail

    if certification is None:
        raise HTTPException(status_code=400, detail="certification query param required")

    crew = await find_avail(db, certification)
    if crew is None:
        return []
    return [crew]


@router.get("/{member_id}", response_model=CrewMemberResponse)
async def get_crew_member(
    member_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    member = await crew_service.get_crew_member(db, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Crew member not found")
    return member


@router.patch("/{member_id}", response_model=CrewMemberResponse)
async def update_crew_member(
    member_id: uuid.UUID,
    body: CrewMemberUpdate,
    db: AsyncSession = Depends(get_db),
):
    member = await crew_service.update_crew_member(
        db, member_id, body.model_dump(exclude_unset=True)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Crew member not found")
    return member
