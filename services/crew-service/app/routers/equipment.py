# GSE equipment endpoints.
# POST /api/equipment, GET /api/equipment, GET /api/equipment/available,
# POST /api/equipment/:id/assign, POST /api/equipment/:id/release

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentResponse,
    EquipmentAssignRequest,
    EquipmentAssignmentResponse,
)
from ..services import equipment_service

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.post("", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    body: EquipmentCreate, db: AsyncSession = Depends(get_db)
):
    return await equipment_service.create_equipment(db, body.model_dump())


@router.get("", response_model=list[EquipmentResponse])
async def list_equipment(
    equipment_type: str | None = None,
    status: str | None = None,
    terminal: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    return await equipment_service.list_equipment(
        db, equipment_type=equipment_type, status=status,
        terminal=terminal, limit=limit, offset=offset,
    )


@router.get("/available", response_model=list[EquipmentResponse])
async def list_available_equipment(
    equipment_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await equipment_service.list_available_equipment(db, equipment_type)


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    equipment = await equipment_service.get_equipment(db, equipment_id)
    if equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    equipment = await equipment_service.update_equipment(
        db, equipment_id, body.model_dump(exclude_unset=True)
    )
    if equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.post("/{equipment_id}/assign", response_model=EquipmentAssignmentResponse)
async def assign_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    assignment = await equipment_service.assign_equipment(
        db, equipment_id, body.turnaround_id, body.task_id
    )
    if assignment is None:
        raise HTTPException(
            status_code=409, detail="Equipment not available for assignment"
        )
    return assignment


@router.post("/{equipment_id}/release", response_model=EquipmentAssignmentResponse)
async def release_equipment(
    equipment_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    assignment = await equipment_service.release_equipment(db, equipment_id)
    if assignment is None:
        raise HTTPException(
            status_code=404, detail="No active assignment found for this equipment"
        )
    return assignment
