# CrewMember represents a ground handling employee.
# Each member belongs to a team, holds certifications, works shifts,
# and receives task assignments from turnaround events.

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class CrewMember(Base):
    __tablename__ = "crew_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    employee_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    team: Mapped["Team | None"] = relationship(
        "Team", back_populates="members", foreign_keys=[team_id]
    )
    certifications: Mapped[list["Certification"]] = relationship(
        "Certification", back_populates="crew_member", lazy="selectin"
    )
    shifts: Mapped[list["Shift"]] = relationship(
        "Shift", back_populates="crew_member"
    )
    assignments: Mapped[list["TaskAssignment"]] = relationship(
        "TaskAssignment", back_populates="crew_member"
    )
