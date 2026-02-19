# Team represents a ground handling team assigned to a terminal.
# Teams group crew members and have an optional supervisor (self-referencing FK).

import uuid

from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    terminal: Mapped[str] = mapped_column(String(5), nullable=False)
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crew_members.id", use_alter=True, name="fk_teams_supervisor"),
        nullable=True,
    )

    # Relationships
    members: Mapped[list["CrewMember"]] = relationship(
        "CrewMember", back_populates="team", foreign_keys="CrewMember.team_id"
    )
    supervisor: Mapped["CrewMember | None"] = relationship(
        "CrewMember", foreign_keys=[supervisor_id], lazy="joined"
    )
