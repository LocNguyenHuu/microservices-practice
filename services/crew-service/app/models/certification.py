# Certification tracks a crew member's qualification for specific ground tasks.
# cert_type maps to turnaround task requiredCertification values:
# fueling, cargo, pushback, marshalling, catering, cleaning, boarding.

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

# Valid certification types matching turnaround task templates
CERT_TYPES = ("fueling", "cargo", "pushback", "marshalling", "catering", "cleaning", "boarding")
CERT_STATUSES = ("active", "expired", "suspended")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    crew_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crew_members.id"), nullable=False, index=True
    )
    cert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    issued_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    # Relationship
    crew_member: Mapped["CrewMember"] = relationship(
        "CrewMember", back_populates="certifications"
    )
