# AssignmentService handles the core auto-assignment logic:
# When a turnaround.started event arrives, it assigns available certified crew
# to each task that requires a certification. This is the most relational query
# in the platform — JOINing crew_members + certifications + shifts + task_assignments.

import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.crew_member import CrewMember
from ..models.certification import Certification
from ..models.shift import Shift
from ..models.task_assignment import TaskAssignment

logger = logging.getLogger("crew-service")


@dataclass
class TaskInfo:
    """Parsed from the turnaround.started event payload."""
    id: str
    name: str
    order: int
    required_certification: str | None


async def find_available_crew(
    db: AsyncSession,
    cert_type: str,
    now: datetime | None = None,
) -> CrewMember | None:
    """
    Find one available crew member with the given certification.
    Available means:
    - is_active = true
    - has cert_type that is 'active' and not expired
    - currently on shift (shift_date = today, start_time <= now <= end_time)
    - not already assigned to an active task (status in assigned/active)
    """
    if now is None:
        now = datetime.now(timezone.utc)
    today = now.date()

    # Subquery: crew members currently assigned to active tasks
    busy_crew = (
        select(TaskAssignment.crew_member_id)
        .where(TaskAssignment.status.in_(["assigned", "active"]))
        .scalar_subquery()
    )

    stmt = (
        select(CrewMember)
        .join(Certification, Certification.crew_member_id == CrewMember.id)
        .join(Shift, Shift.crew_member_id == CrewMember.id)
        .where(
            and_(
                CrewMember.is_active == True,  # noqa: E712
                Certification.cert_type == cert_type,
                Certification.status == "active",
                Certification.expiry_date > today,
                Shift.shift_date == today,
                Shift.start_time <= now,
                Shift.end_time >= now,
                Shift.status.in_(["scheduled", "active"]),
                CrewMember.id.not_in(busy_crew),
            )
        )
        .order_by(CrewMember.last_name)
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def auto_assign_crew(
    db: AsyncSession,
    turnaround_id: str,
    flight_id: str,
    tasks: list[TaskInfo],
) -> list[dict]:
    """
    Auto-assign available crew to turnaround tasks.
    Returns a list of assignment results (for event publishing).
    Tasks without required_certification are skipped.
    Idempotent: skips tasks that already have an assignment for this turnaround.
    """
    assignments: list[dict] = []

    for task in tasks:
        if not task.required_certification:
            logger.debug(f"Skipping task {task.name} — no certification required")
            continue

        # Idempotent check — skip if already assigned for this turnaround+task
        existing = await db.execute(
            select(TaskAssignment).where(
                and_(
                    TaskAssignment.turnaround_id == turnaround_id,
                    TaskAssignment.task_id == task.id,
                    TaskAssignment.status.in_(["assigned", "active"]),
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            logger.debug(f"Task {task.name} already assigned for turnaround {turnaround_id}")
            continue

        crew = await find_available_crew(db, task.required_certification)
        if crew is None:
            logger.warning(
                f"No available crew for {task.required_certification} "
                f"(task={task.name}, turnaround={turnaround_id})"
            )
            assignments.append({
                "task_id": task.id,
                "task_name": task.name,
                "task_type": task.required_certification,
                "turnaround_id": turnaround_id,
                "flight_id": flight_id,
                "assigned": False,
            })
            continue

        # Create assignment
        assignment = TaskAssignment(
            crew_member_id=crew.id,
            turnaround_id=turnaround_id,
            task_id=task.id,
            task_type=task.required_certification,
            status="assigned",
        )
        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)

        logger.info(
            f"Crew {crew.employee_id} ({crew.first_name} {crew.last_name}) "
            f"assigned to {task.name} for turnaround {turnaround_id}"
        )

        assignments.append({
            "task_id": task.id,
            "task_name": task.name,
            "task_type": task.required_certification,
            "turnaround_id": turnaround_id,
            "flight_id": flight_id,
            "assigned": True,
            "crew_member_id": str(crew.id),
            "employee_id": crew.employee_id,
            "crew_member_name": f"{crew.first_name} {crew.last_name}",
        })

    return assignments


async def free_crew_member(
    db: AsyncSession, turnaround_id: str, task_id: str
) -> dict | None:
    """
    Mark a task assignment as completed, freeing the crew member for reassignment.
    Called when turnaround.task.completed events are received.
    """
    stmt = select(TaskAssignment).where(
        and_(
            TaskAssignment.turnaround_id == turnaround_id,
            TaskAssignment.task_id == task_id,
            TaskAssignment.status.in_(["assigned", "active"]),
        )
    )
    result = await db.execute(stmt)
    assignment = result.scalar_one_or_none()

    if assignment is None:
        logger.debug(f"No active assignment for task {task_id} in turnaround {turnaround_id}")
        return None

    assignment.status = "completed"
    await db.commit()

    logger.info(
        f"Crew member {assignment.crew_member_id} freed from task {task_id} "
        f"in turnaround {turnaround_id}"
    )

    return {
        "crew_member_id": str(assignment.crew_member_id),
        "turnaround_id": turnaround_id,
        "task_id": task_id,
        "task_type": assignment.task_type,
    }
