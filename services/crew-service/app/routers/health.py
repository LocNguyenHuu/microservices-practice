# Health check endpoint — verifies database connectivity.

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.health import HealthResponse

logger = logging.getLogger("crew-service")
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return HealthResponse(status="ok", service="crew-service")
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(status="error", service="crew-service")
