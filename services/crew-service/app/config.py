# Configuration loaded from environment variables via pydantic-settings.
# DATABASE_URL uses the asyncpg driver for SQLAlchemy async sessions.
# RABBITMQ_URL is the AMQP connection string for aio-pika.

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/crew_db"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
