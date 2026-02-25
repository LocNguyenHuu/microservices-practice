import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Task statuses follow the A-CDM lifecycle for ground operations.
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
}

// Task is an embedded subdocument within a Turnaround.
// Each task represents a single ground operation (fueling, catering, etc.).
// Using _id: true so each task gets its own ObjectId for targeted updates.
@Schema({ _id: true, timestamps: true })
export class Task {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: TaskStatus, default: TaskStatus.PENDING })
  status!: TaskStatus;

  @Prop({ required: true })
  estimatedDurationMinutes!: number;

  @Prop()
  requiredCertification?: string;

  @Prop({ required: true })
  order!: number;

  @Prop()
  requiredEquipment?: string;

  @Prop()
  assignedCrewId?: string;

  @Prop()
  assignedEquipmentId?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  notes?: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
