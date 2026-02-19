# Task assignment endpoints.
# GET /api/assignments — list with filters for turnaround_id, crew_member_id, status.

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.task_assignment import TaskAssignmentResponse
from ..services import crew_service

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("", response_model=list[TaskAssignmentResponse])
async def list_assignments(
    turnaround_id: str | None = None,
    crew_member_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    return await crew_service.list_assignments(
        db,
        turnaround_id=turnaround_id,
        crew_member_id=crew_member_id,
        status=status,
        limit=limit,
        offset=offset,
    )
