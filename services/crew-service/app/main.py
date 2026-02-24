# Crew Service — FastAPI application for managing ground handling crew.
# Consumes turnaround.started events to auto-assign certified crew to tasks.
# Publishes crew.assigned / crew.unavailable events.
#
# The lifespan context manager starts the RabbitMQ consumer as a background task
# on startup and gracefully shuts it down on SIGTERM/SIGINT.

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .events.consumer import EventConsumer
from .events.publisher import EventPublisher
from .routers import health, crew_members, certifications, shifts, assignments, equipment

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("crew-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage RabbitMQ connections across the application lifecycle."""
    publisher = EventPublisher()
    consumer = EventConsumer(settings.rabbitmq_url, publisher)
    consumer_task = None

    try:
        await publisher.connect(settings.rabbitmq_url)
        consumer_task = asyncio.create_task(consumer.start())
        logger.info("Crew service started — RabbitMQ consumer active")
        yield
    finally:
        logger.info("Shutting down crew service...")
        await consumer.stop()
        await publisher.close()
        if consumer_task and not consumer_task.done():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        logger.info("Crew service shutdown complete")


app = FastAPI(
    title="SkyTurn Crew Service",
    description="Ground handling crew management and auto-assignment",
    version="1.0.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(health.router)
app.include_router(crew_members.router)
app.include_router(certifications.router)
app.include_router(shifts.router)
app.include_router(assignments.router)
app.include_router(equipment.router)
