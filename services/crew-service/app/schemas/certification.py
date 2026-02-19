import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class CertificationCreate(BaseModel):
    cert_type: str
    issued_date: date
    expiry_date: date
    status: str = "active"


class CertificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    crew_member_id: uuid.UUID
    cert_type: str
    issued_date: date
    expiry_date: date
    status: str
