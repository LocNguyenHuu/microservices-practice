# Weather service — fetches METAR/TAF data for the target airport.
# Uses the CheckWX API (free tier) or falls back to a simulated data
# generator when no API key is configured.
#
# Weather conditions are stored in-memory and served via REST.
# The turnaround service can query current conditions to decide
# whether to inject de-icing tasks or extend task durations.

import logging
import random
from datetime import datetime, timezone

import httpx

from ..config import settings
from ..models.weather_schemas import WeatherData, WeatherStatus, WeatherResult

logger = logging.getLogger("data-ingestion")

_status = WeatherStatus(is_running=False)
_current_weather: WeatherData | None = None


def get_status() -> WeatherStatus:
    return _status.model_copy()


def get_current_weather() -> WeatherData | None:
    return _current_weather


async def fetch_metar_checkwx(api_key: str, icao: str) -> dict:
    """Fetch decoded METAR from CheckWX API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"https://api.checkwx.com/metar/{icao}/decoded",
            headers={"X-API-Key": api_key},
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("data", [])
    if not results:
        raise RuntimeError(f"No METAR data for {icao}")
    return results[0]


def parse_checkwx_metar(raw: dict) -> WeatherData:
    """Parse CheckWX decoded METAR into our weather model."""
    temp = raw.get("temperature", {})
    wind = raw.get("wind", {})
    vis = raw.get("visibility", {})
    conditions = raw.get("conditions", [])

    condition_codes = [c.get("code", "") for c in conditions] if conditions else []

    return WeatherData(
        icao=raw.get("icao", ""),
        raw_metar=raw.get("raw_text", ""),
        temperature_c=temp.get("celsius"),
        dewpoint_c=raw.get("dewpoint", {}).get("celsius"),
        wind_speed_kt=wind.get("speed_kts"),
        wind_direction=wind.get("degrees"),
        wind_gust_kt=wind.get("gust_kts"),
        visibility_m=vis.get("meters_float"),
        pressure_hpa=raw.get("barometer", {}).get("hpa"),
        conditions=condition_codes,
        is_icing=any(c in condition_codes for c in ["FZRA", "FZFG", "SN", "IC", "PL", "GR"]),
        is_lvp=vis.get("meters_float", 9999) < 550,
        ceiling_ft=raw.get("ceiling", {}).get("feet"),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


def generate_simulated_weather(icao: str) -> WeatherData:
    """Generate realistic simulated weather data for demo mode."""
    temp = random.uniform(-5, 42)
    wind = random.uniform(2, 35)
    vis = random.choice([200, 400, 800, 1500, 5000, 9999, 9999, 9999])

    # Determine conditions based on temperature
    conditions = []
    if temp < 0:
        conditions.append(random.choice(["SN", "FZRA", "IC"]))
    elif temp < 3 and random.random() > 0.5:
        conditions.append("FZFG")
    elif random.random() > 0.7:
        conditions.append(random.choice(["RA", "BR", "HZ"]))

    is_icing = any(c in conditions for c in ["FZRA", "FZFG", "SN", "IC", "PL"])

    metar_str = (
        f"METAR {icao} {datetime.now(timezone.utc).strftime('%d%H%MZ')} "
        f"{random.randint(0,360):03d}{int(wind):02d}KT "
        f"{int(vis):04d} "
        f"{' '.join(conditions) + ' ' if conditions else ''}"
        f"{int(temp):+03d}/{int(temp - random.uniform(2,8)):+03d} "
        f"Q{random.randint(1010,1030)}"
    )

    return WeatherData(
        icao=icao,
        raw_metar=metar_str,
        temperature_c=round(temp, 1),
        dewpoint_c=round(temp - random.uniform(2, 8), 1),
        wind_speed_kt=round(wind),
        wind_direction=random.randint(0, 360),
        wind_gust_kt=round(wind + random.uniform(0, 10)) if random.random() > 0.6 else None,
        visibility_m=vis,
        pressure_hpa=random.randint(1010, 1030),
        conditions=conditions,
        is_icing=is_icing,
        is_lvp=vis < 550,
        ceiling_ft=random.choice([200, 500, 1000, 3000, 5000, None]),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


async def run_weather_update() -> WeatherResult:
    """Execute a single weather update cycle."""
    global _status, _current_weather

    _status.is_running = True
    errors: list[str] = []

    try:
        icao = settings.target_airport

        if settings.checkwx_api_key:
            raw = await fetch_metar_checkwx(settings.checkwx_api_key, icao)
            weather = parse_checkwx_metar(raw)
            logger.info("Fetched live METAR for %s: %.1f°C, %dm vis",
                        icao, weather.temperature_c or 0, weather.visibility_m or 9999)
        else:
            weather = generate_simulated_weather(icao)
            logger.info("Generated simulated weather for %s: %.1f°C, %dm vis, conditions=%s",
                        icao, weather.temperature_c or 0, weather.visibility_m or 9999,
                        weather.conditions)

        _current_weather = weather

        return WeatherResult(
            airport=icao,
            temperature_c=weather.temperature_c,
            is_icing=weather.is_icing,
            is_lvp=weather.is_lvp,
            conditions=weather.conditions,
            errors=errors,
        )

    except Exception as e:
        error_msg = f"Weather update failed: {e}"
        errors.append(error_msg)
        logger.error(error_msg)
        return WeatherResult(
            airport=settings.target_airport,
            temperature_c=None,
            is_icing=False,
            is_lvp=False,
            conditions=[],
            errors=errors,
        )

    finally:
        _status.is_running = False
        _status.last_run_at = datetime.now(timezone.utc)
        _status.last_run_errors = errors
        _status.total_runs += 1
