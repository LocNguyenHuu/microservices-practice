import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Task, TaskSchema } from './task.schema';

export type TurnaroundDocument = HydratedDocument<Turnaround>;

// Turnaround statuses track the overall lifecycle of a ground operation.
export enum TurnaroundStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled',
}

// A Turnaround represents the full set of ground operations between a flight's
// arrival and departure. Tasks are embedded (not referenced) because they are
// always read/written as part of the turnaround — the primary MongoDB justification.
@Schema({ timestamps: true, collection: 'turnarounds' })
export class Turnaround {
  @Prop({ required: true, index: true })
  flightId!: string;

  @Prop({ required: true })
  flightNumber!: string;

  @Prop({ required: true })
  aircraftType!: string;

  @Prop()
  aircraftReg?: string;

  @Prop()
  gateId?: string;

  @Prop({
    required: true,
    enum: TurnaroundStatus,
    default: TurnaroundStatus.PENDING,
  })
  status!: TurnaroundStatus;

  @Prop({ type: [TaskSchema], default: [] })
  tasks!: Types.DocumentArray<Task>;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ default: 0 })
  progressPercent!: number;
}

export const TurnaroundSchema = SchemaFactory.createForClass(Turnaround);
