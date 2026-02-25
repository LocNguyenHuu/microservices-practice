# Ingestion REST API: manual trigger, status, and runtime config updates.

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..models.schemas import IngestConfig, IngestConfigUpdate, IngestResult, IngestStatus
from ..services.ingestion import get_status, run_ingestion

logger = logging.getLogger("data-ingestion")

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


@router.post("/trigger", response_model=IngestResult)
async def trigger_ingestion():
    """Manually trigger a single ingestion cycle."""
    status = get_status()
    if status.is_running:
        raise HTTPException(status_code=409, detail="Ingestion is already running")

    result = await run_ingestion()
    return result


@router.get("/status", response_model=IngestStatus)
async def ingestion_status():
    """Get the current ingestion status and last run info."""
    return get_status()


@router.get("/config", response_model=IngestConfig)
async def get_config():
    """Get the current ingestion configuration."""
    return IngestConfig(
        target_airport=settings.target_airport,
        poll_interval_minutes=settings.poll_interval_minutes,
        api_key_configured=bool(settings.aviationstack_api_key),
        flight_service_url=settings.flight_service_url,
    )


@router.patch("/config", response_model=IngestConfig)
async def update_config(update: IngestConfigUpdate):
    """Update ingestion configuration at runtime."""
    if update.target_airport is not None:
        settings.target_airport = update.target_airport
        logger.info("Target airport updated to %s", update.target_airport)

    if update.poll_interval_minutes is not None:
        if update.poll_interval_minutes < 1:
            raise HTTPException(status_code=400, detail="Poll interval must be >= 1 minute")
        settings.poll_interval_minutes = update.poll_interval_minutes
        logger.info("Poll interval updated to %d minutes", update.poll_interval_minutes)

    return IngestConfig(
        target_airport=settings.target_airport,
        poll_interval_minutes=settings.poll_interval_minutes,
        api_key_configured=bool(settings.aviationstack_api_key),
        flight_service_url=settings.flight_service_url,
    )
