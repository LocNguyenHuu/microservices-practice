import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { TurnaroundService } from '../turnaround/turnaround.service';

// EquipmentEvent mirrors the Python publisher's JSON output.
interface EquipmentEvent {
  id: string;
  type: string;
  turnaround_id: string;
  flight_id: string;
  timestamp: string;
  data: {
    task_id: string;
    task_name: string;
    equipment_type: string;
    turnaround_id: string;
    flight_id: string;
    assigned: boolean;
    equipment_id: string;
    equipment_registration: string;
  };
}

// Consumes equipment.assigned events from the turnaround-equipment-queue.
// Updates the assignedEquipmentId field on the corresponding turnaround task.
@Injectable()
export class EquipmentEventConsumer {
  private readonly logger = new Logger(EquipmentEventConsumer.name);

  constructor(private readonly turnaroundService: TurnaroundService) {}

  @RabbitSubscribe({
    exchange: 'equipment.events',
    routingKey: ['equipment.assigned'],
    queue: 'turnaround-equipment-queue',
    queueOptions: { durable: true },
  })
  async handleEquipmentEvent(msg: EquipmentEvent): Promise<void | Nack> {
    this.logger.log(
      `Received ${msg.type}: turnaround=${msg.turnaround_id} event=${msg.id}`,
    );

    if (msg.type === 'equipment.assigned') {
      return this.handleEquipmentAssigned(msg);
    }

    this.logger.warn(`Unhandled equipment event type: ${msg.type}`);
  }

  private async handleEquipmentAssigned(
    msg: EquipmentEvent,
  ): Promise<void | Nack> {
    try {
      const { turnaround_id, data } = msg;
      await this.turnaroundService.updateTask(turnaround_id, data.task_id, {
        assignedEquipmentId: data.equipment_id,
      });

      this.logger.log(
        `Equipment ${data.equipment_registration} (${data.equipment_type}) assigned to ` +
          `task ${data.task_name} in turnaround ${turnaround_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle equipment.assigned: turnaround=${msg.turnaround_id} task=${msg.data.task_id}`,
        (error as Error).stack,
      );
      return new Nack(true);
    }
  }
}
