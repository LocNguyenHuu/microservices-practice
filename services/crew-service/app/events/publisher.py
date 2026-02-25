# Publishes crew and equipment domain events to topic exchanges.
# Event envelope matches the Go/NestJS pattern:
# { id, type, turnaround_id, flight_id, correlationId, timestamp, data }
#
# Two exchanges:
#   - crew.events: crew.assigned, crew.unavailable
#   - equipment.events: equipment.assigned, equipment.unavailable
#
# Publish failures are logged but not thrown — fire-and-forget pattern.

import json
import logging
import uuid
from datetime import datetime, timezone

import aio_pika

logger = logging.getLogger("crew-service")

CREW_EXCHANGE = "crew.events"
EQUIPMENT_EXCHANGE = "equipment.events"


class EventPublisher:
    def __init__(self):
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._crew_exchange: aio_pika.abc.AbstractExchange | None = None
        self._equipment_exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self, rabbitmq_url: str) -> None:
        self._connection = await aio_pika.connect_robust(rabbitmq_url)
        self._channel = await self._connection.channel()
        self._crew_exchange = await self._channel.declare_exchange(
            CREW_EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        self._equipment_exchange = await self._channel.declare_exchange(
            EQUIPMENT_EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        logger.info(f"Publisher connected — exchanges: {CREW_EXCHANGE}, {EQUIPMENT_EXCHANGE}")

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("Publisher connection closed")

    async def publish_crew_assigned(self, assignment_data: dict, correlation_id: str | None = None) -> None:
        await self._publish(self._crew_exchange, "crew.assigned", assignment_data, correlation_id)

    async def publish_crew_unavailable(self, task_data: dict, correlation_id: str | None = None) -> None:
        await self._publish(self._crew_exchange, "crew.unavailable", task_data, correlation_id)

    async def publish_equipment_assigned(self, assignment_data: dict, correlation_id: str | None = None) -> None:
        await self._publish(self._equipment_exchange, "equipment.assigned", assignment_data, correlation_id)

    async def publish_equipment_unavailable(self, task_data: dict, correlation_id: str | None = None) -> None:
        await self._publish(self._equipment_exchange, "equipment.unavailable", task_data, correlation_id)

    async def _publish(
        self,
        exchange: aio_pika.abc.AbstractExchange | None,
        routing_key: str,
        data: dict,
        correlation_id: str | None = None,
    ) -> None:
        if exchange is None:
            logger.error(f"Cannot publish {routing_key}: exchange not initialized")
            return

        corr_id = correlation_id or str(uuid.uuid4())
        event = {
            "id": str(uuid.uuid4()),
            "type": routing_key,
            "turnaround_id": data.get("turnaround_id", ""),
            "flight_id": data.get("flight_id", ""),
            "correlationId": corr_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        try:
            message = aio_pika.Message(
                body=json.dumps(event).encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=event["id"],
                correlation_id=corr_id,
                timestamp=datetime.now(timezone.utc),
            )
            await exchange.publish(message, routing_key=routing_key)
            logger.info(
                f"Event published: {routing_key} "
                f"(turnaround: {data.get('turnaround_id')}, event: {event['id']}, "
                f"corr: {corr_id})"
            )
        except Exception as e:
            logger.error(f"Failed to publish {routing_key}: {e}")
