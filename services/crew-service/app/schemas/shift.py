import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ShiftCreate(BaseModel):
    shift_date: date
    start_time: datetime
    end_time: datetime
    status: str = "scheduled"


class ShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    crew_member_id: uuid.UUID
    shift_date: date
    start_time: datetime
    end_time: datetime
    status: str
