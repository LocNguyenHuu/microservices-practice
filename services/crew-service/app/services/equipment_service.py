# EquipmentService handles CRUD and assignment logic for ground support equipment.
# Mirrors the crew assignment pattern: find available → assign → release.

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.equipment import Equipment, EquipmentAssignment

logger = logging.getLogger("crew-service")


# --- Equipment CRUD ---

async def create_equipment(db: AsyncSession, data: dict) -> Equipment:
    equipment = Equipment(**data)
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    logger.info(f"Equipment created: {equipment.registration} ({equipment.equipment_type})")
    return equipment


async def get_equipment(db: AsyncSession, equipment_id: uuid.UUID) -> Equipment | None:
    result = await db.execute(
        select(Equipment).where(Equipment.id == equipment_id)
    )
    return result.scalar_one_or_none()


async def list_equipment(
    db: AsyncSession,
    equipment_type: str | None = None,
    status: str | None = None,
    terminal: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Equipment]:
    stmt = select(Equipment).order_by(Equipment.equipment_type, Equipment.registration)
    if equipment_type is not None:
        stmt = stmt.where(Equipment.equipment_type == equipment_type)
    if status is not None:
        stmt = stmt.where(Equipment.status == status)
    if terminal is not None:
        stmt = stmt.where(Equipment.terminal == terminal)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_equipment(
    db: AsyncSession, equipment_id: uuid.UUID, data: dict
) -> Equipment | None:
    equipment = await get_equipment(db, equipment_id)
    if equipment is None:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(equipment, key, value)
    await db.commit()
    await db.refresh(equipment)
    return equipment


# --- Availability ---

async def find_available_equipment(
    db: AsyncSession, equipment_type: str
) -> Equipment | None:
    """Find one available equipment unit of the given type."""
    stmt = (
        select(Equipment)
        .where(
            and_(
                Equipment.equipment_type == equipment_type,
                Equipment.status == "available",
            )
        )
        .order_by(Equipment.registration)
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_available_equipment(
    db: AsyncSession, equipment_type: str | None = None
) -> list[Equipment]:
    """List all available equipment, optionally filtered by type."""
    stmt = (
        select(Equipment)
        .where(Equipment.status == "available")
        .order_by(Equipment.equipment_type, Equipment.registration)
    )
    if equipment_type is not None:
        stmt = stmt.where(Equipment.equipment_type == equipment_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- Assignment / Release ---

async def assign_equipment(
    db: AsyncSession,
    equipment_id: uuid.UUID,
    turnaround_id: str,
    task_id: str,
) -> EquipmentAssignment | None:
    """Assign equipment to a turnaround task. Sets status to in_use."""
    equipment = await get_equipment(db, equipment_id)
    if equipment is None or equipment.status != "available":
        return None

    assignment = EquipmentAssignment(
        equipment_id=equipment_id,
        turnaround_id=turnaround_id,
        task_id=task_id,
    )
    equipment.status = "in_use"
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    logger.info(
        f"Equipment {equipment.registration} assigned to turnaround {turnaround_id} "
        f"task {task_id}"
    )
    return assignment


async def release_equipment(
    db: AsyncSession, equipment_id: uuid.UUID
) -> EquipmentAssignment | None:
    """Release equipment from its current assignment. Sets status back to available."""
    equipment = await get_equipment(db, equipment_id)
    if equipment is None:
        return None

    # Find the active (unreleased) assignment
    stmt = select(EquipmentAssignment).where(
        and_(
            EquipmentAssignment.equipment_id == equipment_id,
            EquipmentAssignment.released_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    assignment = result.scalar_one_or_none()

    if assignment is None:
        return None

    assignment.released_at = datetime.now(timezone.utc)
    equipment.status = "available"
    await db.commit()
    await db.refresh(assignment)

    logger.info(f"Equipment {equipment.registration} released from turnaround {assignment.turnaround_id}")
    return assignment


# --- Auto-assignment (called from event consumer) ---

# Maps turnaround task names to required GSE type
TASK_EQUIPMENT_MAP = {
    "fueling": "fuel_truck",
    "catering": "catering_truck",
    "cargo_unload": "belt_loader",
    "cargo_load": "belt_loader",
    "deboarding": "gpu",
    "boarding": "gpu",
}


async def auto_assign_equipment(
    db: AsyncSession,
    turnaround_id: str,
    flight_id: str,
    tasks: list[dict],
) -> list[dict]:
    """
    Auto-assign available equipment to turnaround tasks.
    Returns assignment results for event publishing.
    Idempotent: skips tasks already assigned equipment.
    """
    results: list[dict] = []

    for task in tasks:
        task_name = task.get("name", "")
        task_id = task.get("id", "")
        required_type = TASK_EQUIPMENT_MAP.get(task_name)

        if not required_type:
            continue

        # Idempotent: check if already assigned
        existing = await db.execute(
            select(EquipmentAssignment).where(
                and_(
                    EquipmentAssignment.turnaround_id == turnaround_id,
                    EquipmentAssignment.task_id == task_id,
                    EquipmentAssignment.released_at.is_(None),
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        equipment = await find_available_equipment(db, required_type)
        if equipment is None:
            logger.warning(
                f"No available {required_type} for task {task_name} "
                f"in turnaround {turnaround_id}"
            )
            results.append({
                "task_id": task_id,
                "task_name": task_name,
                "equipment_type": required_type,
                "turnaround_id": turnaround_id,
                "flight_id": flight_id,
                "assigned": False,
            })
            continue

        assignment = await assign_equipment(db, equipment.id, turnaround_id, task_id)
        if assignment:
            results.append({
                "task_id": task_id,
                "task_name": task_name,
                "equipment_type": required_type,
                "turnaround_id": turnaround_id,
                "flight_id": flight_id,
                "assigned": True,
                "equipment_id": str(equipment.id),
                "equipment_registration": equipment.registration,
            })

    assigned_count = sum(1 for r in results if r.get("assigned"))
    logger.info(
        f"Equipment auto-assignment: {assigned_count}/{len(results)} for turnaround {turnaround_id}"
    )
    return results
