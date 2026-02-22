# Ingestion orchestrator: fetches flights from AviationStack,
# maps them to Flight Service format, and POSTs to create flights.
# Tracks run status for the /api/ingest/status endpoint.

import logging
from datetime import datetime, timezone

import httpx

from ..config import settings
from ..models.schemas import IngestResult, IngestStatus
from .aviationstack import fetch_arrivals
from .mapper import map_flight

logger = logging.getLogger("data-ingestion")

# In-memory status tracking
_status = IngestStatus(is_running=False)


def get_status() -> IngestStatus:
    return _status.model_copy()


async def run_ingestion(
    api_key: str | None = None,
    airport: str | None = None,
    flight_service_url: str | None = None,
) -> IngestResult:
    """Execute a single ingestion cycle: fetch → map → POST to Flight Service."""
    global _status

    key = api_key or settings.aviationstack_api_key
    target = airport or settings.target_airport
    base_url = flight_service_url or settings.flight_service_url

    if not key:
        return IngestResult(
            flights_ingested=0,
            flights_skipped=0,
            errors=["No AviationStack API key configured. Set AVIATIONSTACK_API_KEY."],
        )

    _status.is_running = True
    ingested = 0
    skipped = 0
    errors: list[str] = []

    try:
        raw_flights = await fetch_arrivals(key, target)

        async with httpx.AsyncClient(timeout=15.0) as client:
            for raw in raw_flights:
                flight = map_flight(raw)
                if flight is None:
                    skipped += 1
                    continue

                try:
                    resp = await client.post(
                        f"{base_url}/api/flights",
                        json=flight.model_dump(exclude_none=True),
                    )

                    if resp.status_code in (200, 201):
                        ingested += 1
                        logger.info("Ingested flight %s", flight.flight_number)
                    elif resp.status_code == 409 or (
                        resp.status_code == 500
                        and "duplicate" in resp.text.lower()
                    ):
                        # Flight already exists (idempotency)
                        skipped += 1
                        logger.debug("Skipped duplicate flight %s", flight.flight_number)
                    else:
                        error_msg = f"Flight {flight.flight_number}: HTTP {resp.status_code}"
                        errors.append(error_msg)
                        logger.warning("Failed to ingest flight: %s", error_msg)

                except httpx.HTTPError as e:
                    error_msg = f"Flight {flight.flight_number}: {e}"
                    errors.append(error_msg)
                    logger.warning("HTTP error ingesting flight: %s", e)

    except Exception as e:
        errors.append(f"Ingestion failed: {e}")
        logger.error("Ingestion cycle failed: %s", e)

    finally:
        _status.is_running = False
        _status.last_run_at = datetime.now(timezone.utc)
        _status.last_run_flights_ingested = ingested
        _status.last_run_flights_skipped = skipped
        _status.last_run_errors = errors
        _status.total_runs += 1

    result = IngestResult(flights_ingested=ingested, flights_skipped=skipped, errors=errors)
    logger.info(
        "Ingestion complete: %d ingested, %d skipped, %d errors",
        ingested, skipped, len(errors),
    )
    return result
