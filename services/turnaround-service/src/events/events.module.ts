import { Module, forwardRef } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FlightEventConsumer } from './flight-event.consumer';
import { CrewEventConsumer } from './crew-event.consumer';
import { EquipmentEventConsumer } from './equipment-event.consumer';
import { TurnaroundEventPublisher } from './turnaround-event.publisher';
import { TurnaroundModule } from '../turnaround/turnaround.module';

@Module({
  imports: [
    // RabbitMQ connection with topic exchange declarations.
    // All exchanges are declared as durable so they survive broker restarts.
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('rabbitmqUrl')!,
        exchanges: [
          { name: 'flight.events', type: 'topic', options: { durable: true } },
          {
            name: 'turnaround.events',
            type: 'topic',
            options: { durable: true },
          },
          { name: 'crew.events', type: 'topic', options: { durable: true } },
          { name: 'equipment.events', type: 'topic', options: { durable: true } },
        ],
        connectionInitOptions: { wait: true, timeout: 30000 },
        channels: {
          default: { prefetchCount: 10, default: true },
        },
      }),
    }),

    // forwardRef resolves circular: EventsModule needs TurnaroundService (via consumer),
    // TurnaroundModule needs TurnaroundEventPublisher (via service).
    forwardRef(() => TurnaroundModule),
  ],
  providers: [
    FlightEventConsumer,
    CrewEventConsumer,
    EquipmentEventConsumer,
    TurnaroundEventPublisher,
  ],
  exports: [TurnaroundEventPublisher],
})
export class EventsModule {}
