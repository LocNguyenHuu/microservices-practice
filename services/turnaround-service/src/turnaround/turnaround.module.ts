import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TurnaroundController } from './turnaround.controller';
import { TurnaroundService } from './turnaround.service';
import { TurnaroundRepository } from './turnaround.repository';
import {
  Turnaround,
  TurnaroundSchema,
} from './schemas/turnaround.schema';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Turnaround.name, schema: TurnaroundSchema },
    ]),
    // forwardRef resolves circular dependency: EventsModule exports
    // TurnaroundEventPublisher which this module needs, while EventsModule's
    // FlightEventConsumer needs TurnaroundService from this module.
    forwardRef(() => EventsModule),
  ],
  controllers: [TurnaroundController],
  providers: [TurnaroundService, TurnaroundRepository],
  exports: [TurnaroundService],
})
export class TurnaroundModule {}
