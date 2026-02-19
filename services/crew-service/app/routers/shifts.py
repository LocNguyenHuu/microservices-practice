# Shift endpoints nested under crew members.
# POST /api/crew/:id/shifts, GET /api/crew/:id/shifts

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.shift import ShiftCreate, ShiftResponse
from ..services import crew_service

router = APIRouter(prefix="/api/crew/{member_id}/shifts", tags=["shifts"])


@router.post("", response_model=ShiftResponse, status_code=201)
async def create_shift(
    member_id: uuid.UUID,
    body: ShiftCreate,
    db: AsyncSession = Depends(get_db),
):
    member = await crew_service.get_crew_member(db, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Crew member not found")

    return await crew_service.create_shift(db, member_id, body.model_dump())


@router.get("", response_model=list[ShiftResponse])
async def list_shifts(
    member_id: uuid.UUID,
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await crew_service.list_shifts(db, member_id, shift_date=date)
