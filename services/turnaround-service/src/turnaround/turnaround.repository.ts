import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Turnaround,
  TurnaroundDocument,
  TurnaroundStatus,
} from './schemas/turnaround.schema';
import { TaskStatus } from './schemas/task.schema';

export interface ListTurnaroundsParams {
  status?: TurnaroundStatus;
  limit: number;
  offset: number;
}

// Repository encapsulates all MongoDB operations for turnaround documents.
// Follows the same pattern as Go's FlightRepository — thin data access layer.
@Injectable()
export class TurnaroundRepository {
  constructor(
    @InjectModel(Turnaround.name)
    private turnaroundModel: Model<TurnaroundDocument>,
  ) {}

  async create(data: Partial<Turnaround>): Promise<TurnaroundDocument> {
    return this.turnaroundModel.create(data);
  }

  async findById(id: string): Promise<TurnaroundDocument | null> {
    return this.turnaroundModel.findById(id).exec();
  }

  async findByFlightId(
    flightId: string,
  ): Promise<TurnaroundDocument | null> {
    return this.turnaroundModel.findOne({ flightId }).exec();
  }

  async list(params: ListTurnaroundsParams): Promise<TurnaroundDocument[]> {
    const filter: Record<string, unknown> = {};
    if (params.status) {
      filter.status = params.status;
    }
    return this.turnaroundModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(params.offset)
      .limit(params.limit)
      .exec();
  }

  // Atomic update of a single embedded task using MongoDB's positional $ operator.
  // Avoids read-modify-write race conditions.
  async updateTask(
    turnaroundId: string,
    taskId: string,
    updates: Partial<{
      status: TaskStatus;
      notes: string;
      assignedCrewId: string;
      startedAt: Date;
      completedAt: Date;
    }>,
  ): Promise<TurnaroundDocument | null> {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`tasks.$.${key}`] = value;
    }
    return this.turnaroundModel
      .findOneAndUpdate(
        { _id: turnaroundId, 'tasks._id': taskId },
        { $set: setFields },
        { new: true },
      )
      .exec();
  }

  async updateStatus(
    id: string,
    status: TurnaroundStatus,
    extra?: Partial<Turnaround>,
  ): Promise<TurnaroundDocument | null> {
    return this.turnaroundModel
      .findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true })
      .exec();
  }

  async updateMilestones(
    id: string,
    milestones: Record<string, Date>,
  ): Promise<TurnaroundDocument | null> {
    const setFields: Record<string, Date> = {};
    for (const [key, value] of Object.entries(milestones)) {
      setFields[`milestones.${key}`] = value;
    }
    return this.turnaroundModel
      .findByIdAndUpdate(id, { $set: setFields }, { new: true })
      .exec();
  }
}
