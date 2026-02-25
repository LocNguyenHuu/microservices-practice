# Weather data endpoints.
# GET /api/weather/current — current METAR conditions
# GET /api/weather/status — scheduler/update status
# POST /api/weather/trigger — manually trigger weather update

from fastapi import APIRouter, HTTPException

from ..models.weather_schemas import WeatherData, WeatherStatus, WeatherResult
from ..services.weather import get_current_weather, get_status, run_weather_update

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/current", response_model=WeatherData | None)
async def current_weather():
    """Get the latest weather data for the target airport."""
    weather = get_current_weather()
    if weather is None:
        raise HTTPException(status_code=404, detail="No weather data available yet")
    return weather


@router.get("/status", response_model=WeatherStatus)
async def weather_status():
    return get_status()


@router.post("/trigger", response_model=WeatherResult)
async def trigger_weather_update():
    """Manually trigger a weather data update."""
    return await run_weather_update()
