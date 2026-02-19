import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { v4 as uuidv4 } from 'uuid';
import { TurnaroundDocument } from '../turnaround/schemas/turnaround.schema';

// Event envelope matches the Go FlightEvent pattern:
// { id, type, turnaround_id, flight_id, timestamp, data }
interface TurnaroundEvent {
  id: string;
  type: string;
  turnaround_id: string;
  flight_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Publishes turnaround domain events to the turnaround.events topic exchange.
// Publish failures are logged but not thrown — matching the Go service's
// fire-and-forget pattern where event delivery does not block the HTTP response.
@Injectable()
export class TurnaroundEventPublisher {
  private readonly logger = new Logger(TurnaroundEventPublisher.name);
  private readonly exchange = 'turnaround.events';

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publishTurnaroundStarted(
    turnaround: TurnaroundDocument,
  ): Promise<void> {
    await this.publish(
      'turnaround.started',
      turnaround.id as string,
      turnaround.flightId,
      {
        turnaround_id: turnaround.id,
        flight_id: turnaround.flightId,
        flight_number: turnaround.flightNumber,
        aircraft_type: turnaround.aircraftType,
        task_count: turnaround.tasks.length,
        tasks: turnaround.tasks.map((t) => ({
          id: t._id?.toString(),
          name: t.name,
          order: t.order,
          required_certification: t.requiredCertification,
        })),
      },
    );
  }

  async publishTaskCompleted(
    turnaround: TurnaroundDocument,
    taskId: string,
  ): Promise<void> {
    const task = turnaround.tasks.id(taskId);
    await this.publish(
      'turnaround.task.completed',
      turnaround.id as string,
      turnaround.flightId,
      {
        turnaround_id: turnaround.id,
        flight_id: turnaround.flightId,
        task_id: taskId,
        task_name: task?.name,
        progress_percent: turnaround.progressPercent,
      },
    );
  }

  async publishTurnaroundCompleted(
    turnaround: TurnaroundDocument,
  ): Promise<void> {
    await this.publish(
      'turnaround.completed',
      turnaround.id as string,
      turnaround.flightId,
      {
        turnaround_id: turnaround.id,
        flight_id: turnaround.flightId,
        flight_number: turnaround.flightNumber,
        completed_at: turnaround.completedAt?.toISOString(),
      },
    );
  }

  private async publish(
    routingKey: string,
    turnaroundId: string,
    flightId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const event: TurnaroundEvent = {
      id: uuidv4(),
      type: routingKey,
      turnaround_id: turnaroundId,
      flight_id: flightId,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await this.amqpConnection.publish(this.exchange, routingKey, event, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        timestamp: Math.floor(Date.now() / 1000),
      });

      this.logger.log(
        `Event published: ${routingKey} (turnaround: ${turnaroundId}, event: ${event.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ${routingKey}: ${(error as Error).message}`,
      );
    }
  }
}
