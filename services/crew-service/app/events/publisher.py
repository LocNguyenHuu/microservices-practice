# Publishes crew domain events to the crew.events topic exchange.
# Event envelope matches the Go/NestJS pattern:
# { id, type, crew_member_id, turnaround_id, flight_id, timestamp, data }
#
# Publish failures are logged but not thrown — matching the fire-and-forget
# pattern used by the other services.

import json
import logging
import uuid
from datetime import datetime, timezone

import aio_pika

logger = logging.getLogger("crew-service")

EXCHANGE_NAME = "crew.events"


class EventPublisher:
    def __init__(self):
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self, rabbitmq_url: str) -> None:
        self._connection = await aio_pika.connect_robust(rabbitmq_url)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
        )
        logger.info(f"Publisher connected — exchange: {EXCHANGE_NAME}")

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("Publisher connection closed")

    async def publish_crew_assigned(self, assignment_data: dict) -> None:
        """Publish crew.assigned event when a crew member is assigned to a task."""
        await self._publish("crew.assigned", assignment_data)

    async def publish_crew_unavailable(self, task_data: dict) -> None:
        """Publish crew.unavailable event when no crew is available for a task."""
        await self._publish("crew.unavailable", task_data)

    async def _publish(self, routing_key: str, data: dict) -> None:
        if self._exchange is None:
            logger.error(f"Cannot publish {routing_key}: exchange not initialized")
            return

        event = {
            "id": str(uuid.uuid4()),
            "type": routing_key,
            "turnaround_id": data.get("turnaround_id", ""),
            "flight_id": data.get("flight_id", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        try:
            message = aio_pika.Message(
                body=json.dumps(event).encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=event["id"],
                timestamp=datetime.now(timezone.utc),
            )
            await self._exchange.publish(message, routing_key=routing_key)
            logger.info(
                f"Event published: {routing_key} "
                f"(turnaround: {data.get('turnaround_id')}, event: {event['id']})"
            )
        except Exception as e:
            logger.error(f"Failed to publish {routing_key}: {e}")
