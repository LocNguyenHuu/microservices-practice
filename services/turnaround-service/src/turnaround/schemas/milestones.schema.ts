import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// A-CDM (Airport Collaborative Decision Making) milestones track the key
// timestamps in a turnaround lifecycle. These are standardized by EUROCONTROL
// and used at every airport in the network for departure sequencing.
@Schema({ _id: false, timestamps: false })
export class Milestones {
  @Prop()
  eibt?: Date; // Estimated In-Block Time — predicted gate arrival

  @Prop()
  aibt?: Date; // Actual In-Block Time — aircraft reached gate (auto-set from flight.arrived)

  @Prop()
  tobt?: Date; // Target Off-Block Time — ground handler's estimate for departure readiness

  @Prop()
  tsat?: Date; // Target Start-up Approval Time — ATC slot for engine start

  @Prop()
  ardt?: Date; // Actual Ready Time — all tasks complete, ready for pushback (auto-set)

  @Prop()
  aobt?: Date; // Actual Off-Block Time — pushback started

  @Prop()
  atot?: Date; // Actual Take-Off Time
}

export const MilestonesSchema = SchemaFactory.createForClass(Milestones);
