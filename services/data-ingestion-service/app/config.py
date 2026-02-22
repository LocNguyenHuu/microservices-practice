# Configuration loaded from environment variables via pydantic-settings.
# FLIGHT_SERVICE_URL points to the Flight Service REST API.
# AVIATIONSTACK_API_KEY is required for real data ingestion.

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    flight_service_url: str = "http://localhost:8080"
    aviationstack_api_key: str = ""
    target_airport: str = "DXB"
    poll_interval_minutes: int = 30
    port: int = 8002

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
