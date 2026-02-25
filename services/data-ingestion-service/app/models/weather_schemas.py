from datetime import datetime
from pydantic import BaseModel


class WeatherData(BaseModel):
    """Full decoded METAR weather data for an airport."""
    icao: str
    raw_metar: str
    temperature_c: float | None = None
    dewpoint_c: float | None = None
    wind_speed_kt: int | None = None
    wind_direction: int | None = None
    wind_gust_kt: int | None = None
    visibility_m: float | None = None
    pressure_hpa: int | None = None
    conditions: list[str] = []
    is_icing: bool = False
    is_lvp: bool = False
    ceiling_ft: int | None = None
    updated_at: str | None = None


class WeatherStatus(BaseModel):
    is_running: bool
    last_run_at: datetime | None = None
    last_run_errors: list[str] = []
    total_runs: int = 0
    scheduler_active: bool = False


class WeatherResult(BaseModel):
    airport: str
    temperature_c: float | None = None
    is_icing: bool = False
    is_lvp: bool = False
    conditions: list[str] = []
    errors: list[str] = []
