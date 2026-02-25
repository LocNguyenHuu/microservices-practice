# Maps AviationStack API responses to Flight Service create request format.
# Handles missing/null fields gracefully — AviationStack free tier may omit
# aircraft data or gate information on some flights.

import logging

from ..models.schemas import FlightCreate

logger = logging.getLogger("data-ingestion")

# AviationStack uses detailed IATA type codes (e.g. "A388" for A380-800).
# Normalize to the short codes our turnaround templates expect.
AIRCRAFT_TYPE_MAP = {
    "A388": "A380",
    "A389": "A380",
    "A359": "A350",
    "A35K": "A350",
    "B78X": "B787",
    "B789": "B787",
    "B788": "B787",
    "B738": "B737",
    "B739": "B737",
    "B37M": "B737",
    "B38M": "B737",
    "A320": "A320",
    "A321": "A321",
    "A319": "A319",
    "B77W": "B777",
    "B773": "B777",
    "B772": "B777",
    "B744": "B747",
    "B748": "B747",
}


def map_flight(raw: dict) -> FlightCreate | None:
    """Map a single AviationStack flight response to a FlightCreate model.

    Returns None if required fields are missing.
    """
    try:
        flight_info = raw.get("flight", {}) or {}
        airline_info = raw.get("airline", {}) or {}
        aircraft_info = raw.get("aircraft", {}) or {}
        departure_info = raw.get("departure", {}) or {}
        arrival_info = raw.get("arrival", {}) or {}

        flight_number = flight_info.get("iata")
        airline_code = airline_info.get("iata")
        origin_iata = departure_info.get("iata")
        destination_iata = arrival_info.get("iata")

        # All four are required
        if not all([flight_number, airline_code, origin_iata, destination_iata]):
            logger.debug("Skipping flight with missing required fields: %s", flight_number)
            return None

        # Aircraft info may be null on free tier
        aircraft_reg = aircraft_info.get("registration") or "UNKNOWN"
        raw_aircraft_type = aircraft_info.get("iata") or ""
        aircraft_type = AIRCRAFT_TYPE_MAP.get(raw_aircraft_type, raw_aircraft_type or "B737")

        return FlightCreate(
            flight_number=flight_number,
            airline_code=airline_code,
            aircraft_reg=aircraft_reg,
            aircraft_type=aircraft_type,
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            scheduled_arrival=arrival_info.get("scheduled"),
            scheduled_departure=departure_info.get("scheduled"),
        )
    except Exception as e:
        logger.warning("Failed to map flight: %s", e)
        return None
