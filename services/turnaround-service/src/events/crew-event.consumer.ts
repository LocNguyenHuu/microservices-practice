import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { TurnaroundService } from '../turnaround/turnaround.service';

// CrewEvent mirrors the Python publisher's JSON output.
// Fields use snake_case to match the crew service's event envelope.
interface CrewEvent {
  id: string;
  type: string;
  turnaround_id: string;
  flight_id: string;
  timestamp: string;
  data: {
    task_id: string;
    task_name: string;
    task_type: string;
    turnaround_id: string;
    flight_id: string;
    assigned: boolean;
    crew_member_id: string;
    employee_id: string;
    crew_member_name: string;
  };
}

// Consumes crew.assigned events from the turnaround-crew-queue.
// Updates the assignedCrewId field on the corresponding turnaround task,
// closing the event loop: flight.arrived → turnaround.started → crew.assigned → task updated.
@Injectable()
export class CrewEventConsumer {
  private readonly logger = new Logger(CrewEventConsumer.name);

  constructor(private readonly turnaroundService: TurnaroundService) {}

  @RabbitSubscribe({
    exchange: 'crew.events',
    routingKey: ['crew.assigned'],
    queue: 'turnaround-crew-queue',
    queueOptions: { durable: true },
  })
  async handleCrewEvent(msg: CrewEvent): Promise<void | Nack> {
    this.logger.log(
      `Received ${msg.type}: turnaround=${msg.turnaround_id} event=${msg.id}`,
    );

    if (msg.type === 'crew.assigned') {
      return this.handleCrewAssigned(msg);
    }

    this.logger.warn(`Unhandled crew event type: ${msg.type}`);
  }

  // crew.assigned → update the task's assignedCrewId in the turnaround document.
  // Nack(true) on failure to requeue — crew-task linkage is critical for operations.
  private async handleCrewAssigned(msg: CrewEvent): Promise<void | Nack> {
    try {
      const { turnaround_id, data } = msg;
      await this.turnaroundService.updateTask(turnaround_id, data.task_id, {
        assignedCrewId: data.crew_member_id,
      });

      this.logger.log(
        `Crew ${data.employee_id} (${data.crew_member_name}) assigned to ` +
          `task ${data.task_name} in turnaround ${turnaround_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle crew.assigned: turnaround=${msg.turnaround_id} task=${msg.data.task_id}`,
        (error as Error).stack,
      );
      return new Nack(true);
    }
  }
}
