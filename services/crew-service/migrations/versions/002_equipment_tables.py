"""Add equipment and equipment_assignments tables for GSE tracking.

Revision ID: 002
Revises: 001
Create Date: 2026-02-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # equipment — physical ground support equipment units
    op.create_table(
        "equipment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("equipment_type", sa.String(30), nullable=False),
        sa.Column("registration", sa.String(30), unique=True, nullable=False),
        sa.Column("terminal", sa.String(5), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "equipment_type IN ('gpu','pushback_tug','belt_loader','fuel_truck',"
            "'lavatory_truck','water_truck','catering_truck','air_start_unit','de_icing_truck')",
            name="ck_equipment_type",
        ),
        sa.CheckConstraint(
            "status IN ('available','in_use','maintenance','out_of_service')",
            name="ck_equipment_status",
        ),
    )
    op.create_index("idx_equipment_type", "equipment", ["equipment_type"])
    op.create_index("idx_equipment_status", "equipment", ["status"])

    # equipment_assignments — links equipment to turnaround tasks
    op.create_table(
        "equipment_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("equipment_id", UUID(as_uuid=True), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("turnaround_id", sa.String(50), nullable=False),
        sa.Column("task_id", sa.String(50), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_equip_assign_equipment", "equipment_assignments", ["equipment_id"])
    op.create_index("idx_equip_assign_turnaround", "equipment_assignments", ["turnaround_id"])


def downgrade() -> None:
    op.drop_table("equipment_assignments")
    op.drop_table("equipment")
