import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CrewMemberCreate(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    team_id: uuid.UUID | None = None


class CrewMemberUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    team_id: uuid.UUID | None = None
    is_active: bool | None = None


class CertificationBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cert_type: str
    status: str
    expiry_date: datetime


class CrewMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: str
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    team_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    certifications: list[CertificationBrief] = []
