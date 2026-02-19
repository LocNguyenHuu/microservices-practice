# Certification endpoints nested under crew members.
# POST /api/crew/:id/certifications, GET /api/crew/:id/certifications

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.certification import CERT_TYPES, CERT_STATUSES
from ..schemas.certification import CertificationCreate, CertificationResponse
from ..services import crew_service

router = APIRouter(prefix="/api/crew/{member_id}/certifications", tags=["certifications"])


@router.post("", response_model=CertificationResponse, status_code=201)
async def add_certification(
    member_id: uuid.UUID,
    body: CertificationCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate cert_type against allowed values
    if body.cert_type not in CERT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cert_type. Must be one of: {', '.join(CERT_TYPES)}",
        )
    if body.status not in CERT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(CERT_STATUSES)}",
        )

    # Verify crew member exists
    member = await crew_service.get_crew_member(db, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Crew member not found")

    return await crew_service.add_certification(db, member_id, body.model_dump())


@router.get("", response_model=list[CertificationResponse])
async def list_certifications(
    member_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    return await crew_service.list_certifications(db, member_id)
