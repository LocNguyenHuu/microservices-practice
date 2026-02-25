# AviationStack API client.
# Fetches scheduled arrivals for a target airport.
# Free tier: ~100-500 requests/month, HTTP only (no HTTPS).

import logging

import httpx

logger = logging.getLogger("data-ingestion")

BASE_URL = "http://api.aviationstack.com/v1"


async def fetch_arrivals(api_key: str, airport_iata: str) -> list[dict]:
    """Fetch scheduled flight arrivals for an airport from AviationStack.

    Returns a list of raw flight dicts from the API response.
    Raises httpx.HTTPError on network/API failures.
    """
    params = {
        "access_key": api_key,
        "arr_iata": airport_iata,
        "flight_status": "scheduled",
        "limit": 100,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{BASE_URL}/flights", params=params)
        response.raise_for_status()
        data = response.json()

    # AviationStack wraps results in a "data" key
    if "error" in data:
        error_info = data["error"]
        raise RuntimeError(
            f"AviationStack API error: {error_info.get('message', 'Unknown error')} "
            f"(code: {error_info.get('code', '?')})"
        )

    flights = data.get("data", [])
    logger.info("Fetched %d flights from AviationStack for %s", len(flights), airport_iata)
    return flights
