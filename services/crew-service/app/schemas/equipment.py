import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EquipmentCreate(BaseModel):
    equipment_type: str
    registration: str
    terminal: str | None = None


class EquipmentUpdate(BaseModel):
    terminal: str | None = None
    status: str | None = None


class EquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_type: str
    registration: str
    terminal: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class EquipmentAssignRequest(BaseModel):
    turnaround_id: str
    task_id: str


class EquipmentAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_id: uuid.UUID
    turnaround_id: str
    task_id: str
    assigned_at: datetime
    released_at: datetime | None
