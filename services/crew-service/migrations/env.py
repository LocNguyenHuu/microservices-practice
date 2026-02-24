# Alembic env.py — configures the migration runner.
# Uses synchronous psycopg2 for migrations (Alembic doesn't support async natively).
# The DATABASE_URL is rewritten from asyncpg to psycopg2 at runtime.

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Rewrite async URL to sync for Alembic
db_url = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/crew_db"
)
sync_url = db_url.replace("postgresql+asyncpg", "postgresql+psycopg2").replace(
    "asyncpg", "psycopg2"
)
config.set_main_option("sqlalchemy.url", sync_url)

# Import all models so Alembic can detect them
from app.database import Base
from app.models import Team, CrewMember, Certification, Shift, TaskAssignment, Equipment, EquipmentAssignment  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connect to the database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
