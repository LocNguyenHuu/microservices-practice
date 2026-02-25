# Data Ingestion Service — fetches real flight data from AviationStack API
# and creates flights in the Flight Service via REST API.
# Also fetches METAR weather data for the target airport.
#
# Uses APScheduler for periodic ingestion and exposes a REST API for
# manual triggers, status checks, and runtime configuration updates.

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from .config import settings
from .routers import health, ingest, weather
from .services.ingestion import run_ingestion
from .services.weather import run_weather_update

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


async def scheduled_weather():
    """Wrapper for scheduled weather update."""
    try:
        await run_weather_update()
    except Exception as e:
        logger.error("Scheduled weather update failed: %s", e)


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
        logger.info(
            "Flight ingestion scheduled — %s every %d minutes",
            settings.target_airport,
            settings.poll_interval_minutes,
        )
        from .services.ingestion import _status
        _status.scheduler_active = True
    else:
        logger.warning(
            "No AVIATIONSTACK_API_KEY configured — flight ingestion disabled."
        )

    # Weather scheduler — always active (uses simulated data if no API key)
    scheduler.add_job(
        scheduled_weather,
        "interval",
        minutes=settings.weather_poll_interval_minutes,
        id="weather_update",
        replace_existing=True,
    )
    from .services.weather import _status as weather_status
    weather_status.scheduler_active = True
    logger.info(
        "Weather scheduler active — updating every %d minutes%s",
        settings.weather_poll_interval_minutes,
        " (live METAR)" if settings.checkwx_api_key else " (simulated)",
    )

    scheduler.start()

    # Run initial weather fetch on startup
    await scheduled_weather()

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")


app = FastAPI(
    title="SkyTurn Data Ingestion Service",
    description="Fetches real flight data and weather from aviation APIs",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(weather.router)
