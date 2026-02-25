# Pydantic models for API responses and internal data transfer.

from datetime import datetime
from pydantic import BaseModel


class IngestStatus(BaseModel):
    is_running: bool
    last_run_at: datetime | None = None
    last_run_flights_ingested: int = 0
    last_run_flights_skipped: int = 0
    last_run_errors: list[str] = []
    total_runs: int = 0
    scheduler_active: bool = False


class IngestConfig(BaseModel):
    target_airport: str
    poll_interval_minutes: int
    api_key_configured: bool
    flight_service_url: str


class IngestConfigUpdate(BaseModel):
    target_airport: str | None = None
    poll_interval_minutes: int | None = None


class IngestResult(BaseModel):
    flights_ingested: int
    flights_skipped: int
    errors: list[str]


class FlightCreate(BaseModel):
    """Matches the Flight Service POST /api/flights request body."""
    flight_number: str
    airline_code: str
    aircraft_reg: str
    aircraft_type: str
    origin_iata: str
    destination_iata: str
    scheduled_arrival: str | None = None
    scheduled_departure: str | None = None
