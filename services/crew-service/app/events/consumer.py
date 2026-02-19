# Consumes turnaround events from the crew-turnaround-queue.
# Binds to turnaround.events exchange with routing keys:
#   - turnaround.started → auto-assign crew to tasks
#   - turnaround.task.completed → free crew member
#
# Uses aio_pika.connect_robust() for auto-reconnection.
# Single callback dispatches by event type (same pattern as NestJS consumer).

import json
import logging

import aio_pika

from ..events.publisher import EventPublisher
from ..services.assignment_service import TaskInfo, auto_assign_crew, free_crew_member
from ..database import async_session

logger = logging.getLogger("crew-service")

EXCHANGE_NAME = "turnaround.events"
QUEUE_NAME = "crew-turnaround-queue"
ROUTING_KEYS = ["turnaround.started", "turnaround.task.completed"]


class EventConsumer:
    def __init__(self, rabbitmq_url: str, publisher: EventPublisher):
        self._rabbitmq_url = rabbitmq_url
        self._publisher = publisher
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None

    async def start(self) -> None:
        """Connect to RabbitMQ, declare exchange/queue/bindings, start consuming."""
        self._connection = await aio_pika.connect_robust(self._rabbitmq_url)
        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=10)

        # Declare exchange (idempotent — matches Turnaround Service declaration)
        exchange = await channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
        )

        # Declare durable queue
        queue = await channel.declare_queue(QUEUE_NAME, durable=True)

        # Bind routing keys
        for key in ROUTING_KEYS:
            await queue.bind(exchange, routing_key=key)
            logger.info(f"Bound {QUEUE_NAME} ← {EXCHANGE_NAME}/{key}")

        # Start consuming
        await queue.consume(self._handle_message)
        logger.info(f"Consumer started on {QUEUE_NAME}")

    async def stop(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("Consumer connection closed")

    async def _handle_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        """Dispatch incoming messages by event type."""
        async with message.process(requeue=False):
            try:
                body = json.loads(message.body.decode())
                event_type = body.get("type", "")
                logger.info(
                    f"Received {event_type}: turnaround={body.get('turnaround_id')} "
                    f"event={body.get('id')}"
                )

                if event_type == "turnaround.started":
                    await self._handle_turnaround_started(body, message)
                elif event_type == "turnaround.task.completed":
                    await self._handle_task_completed(body)
                else:
                    logger.warning(f"Unhandled event type: {event_type}")

            except Exception as e:
                logger.error(f"Error processing message: {e}", exc_info=True)
                # For turnaround.started, requeue is critical.
                # message.process(requeue=False) already acked, so we rely on
                # idempotent processing on next delivery.

    async def _handle_turnaround_started(
        self, body: dict, message: aio_pika.abc.AbstractIncomingMessage
    ) -> None:
        """Auto-assign crew to turnaround tasks based on certifications."""
        data = body.get("data", {})
        turnaround_id = data.get("turnaround_id", body.get("turnaround_id", ""))
        flight_id = data.get("flight_id", body.get("flight_id", ""))
        raw_tasks = data.get("tasks", [])

        tasks = [
            TaskInfo(
                id=t.get("id", ""),
                name=t.get("name", ""),
                order=t.get("order", 0),
                required_certification=t.get("required_certification"),
            )
            for t in raw_tasks
        ]

        logger.info(
            f"Processing turnaround.started: turnaround={turnaround_id}, "
            f"flight={flight_id}, tasks={len(tasks)}"
        )

        async with async_session() as db:
            assignments = await auto_assign_crew(db, turnaround_id, flight_id, tasks)

        # Publish events for each assignment result
        for result in assignments:
            if result.get("assigned"):
                await self._publisher.publish_crew_assigned(result)
            else:
                await self._publisher.publish_crew_unavailable(result)

        assigned_count = sum(1 for a in assignments if a.get("assigned"))
        total = len(assignments)
        logger.info(
            f"Auto-assignment complete: {assigned_count}/{total} tasks assigned "
            f"for turnaround {turnaround_id}"
        )

    async def _handle_task_completed(self, body: dict) -> None:
        """Free crew member when a turnaround task is completed."""
        data = body.get("data", {})
        turnaround_id = data.get("turnaround_id", body.get("turnaround_id", ""))
        task_id = data.get("task_id", "")
        task_name = data.get("task_name", "")

        logger.info(
            f"Processing turnaround.task.completed: task={task_name} ({task_id}) "
            f"in turnaround={turnaround_id}"
        )

        async with async_session() as db:
            result = await free_crew_member(db, turnaround_id, task_id)

        if result:
            logger.info(
                f"Crew member {result['crew_member_id']} freed from "
                f"task {task_name} in turnaround {turnaround_id}"
            )
