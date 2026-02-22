# Data Ingestion Service — fetches real flight data from AviationStack API
# and creates flights in the Flight Service via REST API.
#
# Uses APScheduler for periodic ingestion and exposes a REST API for
# manual triggers, status checks, and runtime configuration updates.

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from .config import settings
from .routers import health, ingest
from .services.ingestion import run_ingestion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("data-ingestion")

scheduler = AsyncIOScheduler()


async def scheduled_ingestion():
    """Wrapper for the scheduled job — catches all exceptions to prevent
    APScheduler from removing the job on failure."""
    try:
        await run_ingestion()
    except Exception as e:
        logger.error("Scheduled ingestion failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start/stop the APScheduler across the application lifecycle."""
    if settings.aviationstack_api_key:
        scheduler.add_job(
            scheduled_ingestion,
            "interval",
            minutes=settings.poll_interval_minutes,
            id="flight_ingestion",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(
            "Scheduler started — ingesting %s flights every %d minutes",
            settings.target_airport,
            settings.poll_interval_minutes,
        )
        # Update status to reflect scheduler is active
        from .services.ingestion import _status
        _status.scheduler_active = True
    else:
        logger.warning(
            "No AVIATIONSTACK_API_KEY configured — scheduler disabled. "
            "Set the env var or use POST /api/ingest/trigger after configuring."
        )

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")


app = FastAPI(
    title="SkyTurn Data Ingestion Service",
    description="Fetches real flight data from aviation APIs into the Flight Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(ingest.router)
