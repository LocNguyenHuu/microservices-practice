import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    crew_member_id: uuid.UUID
    turnaround_id: str
    task_id: str
    task_type: str
    assigned_at: datetime
    status: str
