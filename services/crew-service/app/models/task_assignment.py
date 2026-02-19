# TaskAssignment links a crew member to a specific turnaround task.
# Created automatically when turnaround.started events are consumed,
# or manually via the REST API.
#
# task_id is VARCHAR(24) because turnaround task IDs are MongoDB ObjectIds.
# turnaround_id is a UUID string from the Turnaround Service.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

ASSIGNMENT_STATUSES = ("assigned", "active", "completed", "reassigned")


class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    crew_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crew_members.id"), nullable=False, index=True
    )
    turnaround_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    task_id: Mapped[str] = mapped_column(String(50), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="assigned")

    # Relationship
    crew_member: Mapped["CrewMember"] = relationship(
        "CrewMember", back_populates="assignments"
    )
