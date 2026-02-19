import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { TurnaroundService } from '../turnaround/turnaround.service';

// FlightEvent mirrors the Go FlightEvent JSON struct exactly.
// Fields use snake_case to match Go's json:"..." tags.
interface FlightEvent {
  id: string;
  type: string;
  flight_id: string;
  timestamp: string;
  data: {
    old_status: string;
    new_status: string;
    flight: {
      id: string;
      flight_number: string;
      airline_code: string;
      aircraft_reg: string;
      aircraft_type: string;
      origin_iata: string;
      destination_iata: string;
      gate_id: string | null;
      status: string;
    };
    aircraft_type: string;
    old_gate_id?: string | null;
    new_gate_id?: string | null;
  };
}

// Consumes flight domain events from the turnaround-flight-queue.
// Uses a single handler with wildcard routing key (flight.#) to avoid
// round-robin dispatch issues when multiple handlers share a queue.
// Dispatches internally based on the event type field.
@Injectable()
export class FlightEventConsumer {
  private readonly logger = new Logger(FlightEventConsumer.name);

  constructor(private readonly turnaroundService: TurnaroundService) {}

  @RabbitSubscribe({
    exchange: 'flight.events',
    routingKey: ['flight.arrived', 'flight.gate.changed'],
    queue: 'turnaround-flight-queue',
    queueOptions: { durable: true },
  })
  async handleFlightEvent(msg: FlightEvent): Promise<void | Nack> {
    this.logger.log(
      `Received ${msg.type}: flight=${msg.flight_id} event=${msg.id}`,
    );

    switch (msg.type) {
      case 'flight.arrived':
        return this.handleFlightArrived(msg);
      case 'flight.gate.changed':
        return this.handleGateChanged(msg);
      default:
        this.logger.warn(`Unhandled flight event type: ${msg.type}`);
    }
  }

  // flight.arrived → create a turnaround with tasks from aircraft template.
  // Returns Nack(true) on failure to requeue — turnaround creation is critical.
  private async handleFlightArrived(
    msg: FlightEvent,
  ): Promise<void | Nack> {
    try {
      const flight = msg.data.flight;
      await this.turnaroundService.createTurnaround({
        flightId: flight.id,
        flightNumber: flight.flight_number,
        aircraftType: flight.aircraft_type,
        aircraftReg: flight.aircraft_reg,
        gateId: flight.gate_id ?? undefined,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle flight.arrived: ${msg.flight_id}`,
        (error as Error).stack,
      );
      return new Nack(true);
    }
  }

  // flight.gate.changed → log the gate reassignment.
  // Nack(false) on failure — gate changes are superseded by newer events.
  private async handleGateChanged(msg: FlightEvent): Promise<void | Nack> {
    try {
      this.logger.log(
        `Gate changed for flight ${msg.flight_id}: ` +
          `${msg.data.old_gate_id} → ${msg.data.new_gate_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle flight.gate.changed: ${msg.flight_id}`,
        (error as Error).stack,
      );
      return new Nack(false);
    }
  }
}
