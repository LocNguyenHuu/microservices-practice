"""Initial crew_db schema: teams, crew_members, certifications, shifts, task_assignments.

Revision ID: 001
Revises: None
Create Date: 2026-02-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # teams — ground handling teams assigned to terminals
    op.create_table(
        "teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("terminal", sa.String(5), nullable=False),
        sa.Column("supervisor_id", UUID(as_uuid=True), nullable=True),
    )

    # crew_members — individual ground handling employees
    op.create_table(
        "crew_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", sa.String(20), unique=True, nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_crew_team", "crew_members", ["team_id"])

    # Add supervisor FK after crew_members exists (circular reference)
    op.create_foreign_key(
        "fk_teams_supervisor", "teams", "crew_members",
        ["supervisor_id"], ["id"],
    )

    # certifications — qualifications for specific ground tasks
    op.create_table(
        "certifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crew_member_id", UUID(as_uuid=True), sa.ForeignKey("crew_members.id"), nullable=False),
        sa.Column(
            "cert_type", sa.String(50), nullable=False,
        ),
        sa.Column("issued_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="active",
        ),
        sa.CheckConstraint(
            "cert_type IN ('fueling','cargo','pushback','marshalling','catering','cleaning','boarding')",
            name="ck_certifications_cert_type",
        ),
        sa.CheckConstraint(
            "status IN ('active','expired','suspended')",
            name="ck_certifications_status",
        ),
    )
    op.create_index("idx_certs_crew", "certifications", ["crew_member_id"])
    op.create_index("idx_certs_expiry", "certifications", ["expiry_date"])

    # shifts — daily work schedules for crew members
    op.create_table(
        "shifts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crew_member_id", UUID(as_uuid=True), sa.ForeignKey("crew_members.id"), nullable=False),
        sa.Column("shift_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="scheduled",
        ),
        sa.CheckConstraint(
            "status IN ('scheduled','active','completed','absent')",
            name="ck_shifts_status",
        ),
    )
    op.create_index("idx_shifts_crew_date", "shifts", ["crew_member_id", "shift_date"])

    # task_assignments — links crew members to turnaround tasks
    op.create_table(
        "task_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crew_member_id", UUID(as_uuid=True), sa.ForeignKey("crew_members.id"), nullable=False),
        sa.Column("turnaround_id", sa.String(50), nullable=False),
        sa.Column("task_id", sa.String(50), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="assigned",
        ),
        sa.CheckConstraint(
            "status IN ('assigned','active','completed','reassigned')",
            name="ck_task_assignments_status",
        ),
    )
    op.create_index("idx_assignments_crew", "task_assignments", ["crew_member_id"])
    op.create_index("idx_assignments_turnaround", "task_assignments", ["turnaround_id"])


def downgrade() -> None:
    op.drop_table("task_assignments")
    op.drop_table("shifts")
    op.drop_table("certifications")
    op.drop_constraint("fk_teams_supervisor", "teams", type_="foreignkey")
    op.drop_table("crew_members")
    op.drop_table("teams")
