# Consumes turnaround events from the crew-turnaround-queue.
# Binds to turnaround.events exchange with routing keys:
#   - turnaround.started → auto-assign crew AND equipment to tasks
#   - turnaround.task.completed → free crew member AND release equipment
#
# Uses aio_pika.connect_robust() for auto-reconnection.
# Single callback dispatches by event type (same pattern as NestJS consumer).

import json
import logging

import aio_pika

from ..events.publisher import EventPublisher
from ..services.assignment_service import TaskInfo, auto_assign_crew, free_crew_member
from ..services.equipment_service import auto_assign_equipment, release_equipment
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
                    f"event={body.get('id')} corr={body.get('correlationId', '')}"
                )

                # Extract correlation ID from incoming event for propagation
                correlation_id = body.get("correlationId", "")

                if event_type == "turnaround.started":
                    await self._handle_turnaround_started(body, message, correlation_id)
                elif event_type == "turnaround.task.completed":
                    await self._handle_task_completed(body)
                else:
                    logger.warning(f"Unhandled event type: {event_type}")

            except Exception as e:
                logger.error(f"Error processing message: {e}", exc_info=True)

    async def _handle_turnaround_started(
        self, body: dict, message: aio_pika.abc.AbstractIncomingMessage,
        correlation_id: str = "",
    ) -> None:
        """Auto-assign crew AND equipment to turnaround tasks."""
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
            f"flight={flight_id}, tasks={len(tasks)}, corr={correlation_id}"
        )

        # 1) Auto-assign crew members
        async with async_session() as db:
            crew_assignments = await auto_assign_crew(db, turnaround_id, flight_id, tasks)

        for result in crew_assignments:
            if result.get("assigned"):
                await self._publisher.publish_crew_assigned(result, correlation_id or None)
            else:
                await self._publisher.publish_crew_unavailable(result, correlation_id or None)

        crew_assigned = sum(1 for a in crew_assignments if a.get("assigned"))
        logger.info(
            f"Crew auto-assignment: {crew_assigned}/{len(crew_assignments)} "
            f"for turnaround {turnaround_id}"
        )

        # 2) Auto-assign equipment (parallel to crew)
        async with async_session() as db:
            equip_assignments = await auto_assign_equipment(
                db, turnaround_id, flight_id, raw_tasks
            )

        for result in equip_assignments:
            if result.get("assigned"):
                await self._publisher.publish_equipment_assigned(result, correlation_id or None)
            else:
                await self._publisher.publish_equipment_unavailable(result, correlation_id or None)

        equip_assigned = sum(1 for a in equip_assignments if a.get("assigned"))
        logger.info(
            f"Equipment auto-assignment: {equip_assigned}/{len(equip_assignments)} "
            f"for turnaround {turnaround_id}"
        )

    async def _handle_task_completed(self, body: dict) -> None:
        """Free crew member AND release equipment when a task is completed."""
        data = body.get("data", {})
        turnaround_id = data.get("turnaround_id", body.get("turnaround_id", ""))
        task_id = data.get("task_id", "")
        task_name = data.get("task_name", "")

        logger.info(
            f"Processing turnaround.task.completed: task={task_name} ({task_id}) "
            f"in turnaround={turnaround_id}"
        )

        # Free crew member
        async with async_session() as db:
            crew_result = await free_crew_member(db, turnaround_id, task_id)

        if crew_result:
            logger.info(
                f"Crew member {crew_result['crew_member_id']} freed from "
                f"task {task_name} in turnaround {turnaround_id}"
            )

        # Release equipment assigned to this task
        from ..models.equipment import EquipmentAssignment
        from sqlalchemy import select, and_

        async with async_session() as db:
            stmt = select(EquipmentAssignment).where(
                and_(
                    EquipmentAssignment.turnaround_id == turnaround_id,
                    EquipmentAssignment.task_id == task_id,
                    EquipmentAssignment.released_at.is_(None),
                )
            )
            result = await db.execute(stmt)
            assignment = result.scalar_one_or_none()
            if assignment:
                released = await release_equipment(db, assignment.equipment_id)
                if released:
                    logger.info(
                        f"Equipment {assignment.equipment_id} released from "
                        f"task {task_name} in turnaround {turnaround_id}"
                    )
