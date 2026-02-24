# Equipment represents a physical ground support equipment (GSE) unit.
# EquipmentAssignment links equipment to turnaround tasks — parallel to
# task_assignments for crew, creating a dual-allocation pattern.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

EQUIPMENT_TYPES = (
    "gpu",            # Ground Power Unit
    "pushback_tug",
    "belt_loader",
    "fuel_truck",
    "lavatory_truck",
    "water_truck",
    "catering_truck",
    "air_start_unit",
    "de_icing_truck",
)

EQUIPMENT_STATUSES = ("available", "in_use", "maintenance", "out_of_service")


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    equipment_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    registration: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    terminal: Mapped[str | None] = mapped_column(String(5), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="available"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    assignments: Mapped[list["EquipmentAssignment"]] = relationship(
        "EquipmentAssignment", back_populates="equipment"
    )


class EquipmentAssignment(Base):
    __tablename__ = "equipment_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id"), nullable=False, index=True
    )
    turnaround_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    task_id: Mapped[str] = mapped_column(String(50), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    equipment: Mapped["Equipment"] = relationship(
        "Equipment", back_populates="assignments"
    )
