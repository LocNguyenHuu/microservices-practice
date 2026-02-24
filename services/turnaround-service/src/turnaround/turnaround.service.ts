import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  TurnaroundRepository,
  ListTurnaroundsParams,
} from './turnaround.repository';
import {
  TurnaroundDocument,
  TurnaroundStatus,
} from './schemas/turnaround.schema';
import { TaskStatus } from './schemas/task.schema';
import { CreateTurnaroundDto } from './dto/create-turnaround.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateMilestonesDto } from './dto/update-milestones.dto';
import { getTasksForAircraft } from '../templates/aircraft-templates';
import { TurnaroundEventPublisher } from '../events/turnaround-event.publisher';
import { WeatherService } from '../weather/weather.service';

// TurnaroundService orchestrates between the repository, aircraft templates,
// weather-based task injection, and event publishing. It enforces domain rules
// like idempotent creation, automatic progress tracking, weather-dependent
// de-icing injection, and event publishing on state changes.
@Injectable()
export class TurnaroundService {
  private readonly logger = new Logger(TurnaroundService.name);

  constructor(
    private readonly repo: TurnaroundRepository,
    private readonly eventPublisher: TurnaroundEventPublisher,
    private readonly weatherService: WeatherService,
  ) {}

  // Creates a turnaround with tasks generated from the aircraft type template.
  // Idempotent: returns existing turnaround if one already exists for the flight.
  async createTurnaround(
    dto: CreateTurnaroundDto,
  ): Promise<TurnaroundDocument> {
    // Deduplication — critical for message redelivery scenarios
    const existing = await this.repo.findByFlightId(dto.flightId);
    if (existing) {
      this.logger.warn(
        `Turnaround already exists for flight ${dto.flightId}, returning existing`,
      );
      return existing;
    }

    // Generate tasks from aircraft template
    const taskTemplates = getTasksForAircraft(dto.aircraftType);

    // Check weather conditions for de-icing and LVP adjustments
    const deIcingRequired = await this.weatherService.isDeIcingRequired();
    const durationFactor = await this.weatherService.getDurationFactor();

    const tasks = taskTemplates.map((t) => ({
      name: t.name,
      status: TaskStatus.PENDING,
      estimatedDurationMinutes: Math.round(
        t.estimatedDurationMinutes * durationFactor,
      ),
      requiredCertification: t.requiredCertification,
      requiredEquipment: t.requiredEquipment,
      order: t.order,
    }));

    // Inject de-icing task before boarding if icing conditions detected
    if (deIcingRequired) {
      const maxOrder = Math.max(...tasks.map((t) => t.order));
      const deIcingTask = this.weatherService.getDeIcingTask(maxOrder);
      // Insert de-icing just before the last task (boarding)
      const boardingTask = tasks.find((t) => t.name === 'boarding');
      if (boardingTask) {
        deIcingTask.order = boardingTask.order;
        boardingTask.order += 1;
      }
      tasks.push({
        name: deIcingTask.name,
        status: TaskStatus.PENDING,
        estimatedDurationMinutes: deIcingTask.estimatedDurationMinutes,
        requiredCertification: deIcingTask.requiredCertification,
        requiredEquipment: deIcingTask.requiredEquipment,
        order: deIcingTask.order,
      });
      tasks.sort((a, b) => a.order - b.order);
      this.logger.log(
        `De-icing task injected for flight ${dto.flightNumber} ` +
          `(${deIcingTask.estimatedDurationMinutes}min holdover)`,
      );
    }

    if (durationFactor > 1) {
      this.logger.log(
        `LVP active — task durations scaled by ${durationFactor}x for ${dto.flightNumber}`,
      );
    }

    const now = new Date();
    const turnaround = await this.repo.create({
      flightId: dto.flightId,
      flightNumber: dto.flightNumber,
      aircraftType: dto.aircraftType,
      aircraftReg: dto.aircraftReg,
      gateId: dto.gateId,
      status: TurnaroundStatus.IN_PROGRESS,
      tasks: tasks as never,
      startedAt: now,
      progressPercent: 0,
      milestones: { aibt: now },
    });

    this.logger.log(
      `Turnaround created: ${turnaround.id} for flight ${dto.flightNumber} ` +
        `(${dto.aircraftType}, ${tasks.length} tasks` +
        `${deIcingRequired ? ', DE-ICING' : ''}` +
        `${durationFactor > 1 ? ', LVP' : ''})`,
    );

    await this.eventPublisher.publishTurnaroundStarted(turnaround);
    return turnaround;
  }

  async getTurnaround(id: string): Promise<TurnaroundDocument> {
    const turnaround = await this.repo.findById(id);
    if (!turnaround) {
      throw new NotFoundException(`Turnaround ${id} not found`);
    }
    return turnaround;
  }

  async listTurnarounds(
    params: ListTurnaroundsParams,
  ): Promise<TurnaroundDocument[]> {
    return this.repo.list(params);
  }

  // Updates a specific task within a turnaround. Handles:
  // - Auto-setting startedAt/completedAt timestamps
  // - Recalculating progress percentage
  // - Publishing turnaround.task.completed events
  // - Auto-completing the turnaround when all tasks are done
  async updateTask(
    turnaroundId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TurnaroundDocument> {
    const turnaround = await this.repo.findById(turnaroundId);
    if (!turnaround) {
      throw new NotFoundException(`Turnaround ${turnaroundId} not found`);
    }

    const task = turnaround.tasks.id(taskId);
    if (!task) {
      throw new NotFoundException(
        `Task ${taskId} not found in turnaround ${turnaroundId}`,
      );
    }

    // Build atomic update fields
    const updates: Record<string, unknown> = {};
    if (dto.status) {
      updates.status = dto.status;
      if (dto.status === TaskStatus.IN_PROGRESS && !task.startedAt) {
        updates.startedAt = new Date();
      }
      if (dto.status === TaskStatus.COMPLETED) {
        updates.completedAt = new Date();
      }
    }
    if (dto.notes !== undefined) updates.notes = dto.notes;
    if (dto.assignedCrewId !== undefined)
      updates.assignedCrewId = dto.assignedCrewId;
    if (dto.assignedEquipmentId !== undefined)
      updates.assignedEquipmentId = dto.assignedEquipmentId;

    const updated = await this.repo.updateTask(turnaroundId, taskId, updates);
    if (!updated) {
      throw new NotFoundException('Failed to update task');
    }

    // Recalculate progress: (completed + skipped) / total
    const completedCount = updated.tasks.filter(
      (t) =>
        t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED,
    ).length;
    const progressPercent = Math.round(
      (completedCount / updated.tasks.length) * 100,
    );
    await this.repo.updateStatus(turnaroundId, updated.status, {
      progressPercent,
    });

    // Publish task completion event
    if (dto.status === TaskStatus.COMPLETED) {
      this.logger.log(
        `Task completed: ${task.name} in turnaround ${turnaroundId} ` +
          `(${completedCount}/${updated.tasks.length}, ${progressPercent}%)`,
      );
      await this.eventPublisher.publishTaskCompleted(updated, taskId);
    }

    // Auto-complete turnaround when all tasks are done
    if (completedCount === updated.tasks.length) {
      const ardt = new Date();
      await this.repo.updateMilestones(turnaroundId, { ardt });
      const completed = await this.repo.updateStatus(
        turnaroundId,
        TurnaroundStatus.COMPLETED,
        { completedAt: ardt, progressPercent: 100 },
      );
      if (completed) {
        this.logger.log(
          `Turnaround ${turnaroundId} completed — all ${updated.tasks.length} tasks done`,
        );
        await this.eventPublisher.publishTurnaroundCompleted(completed);
      }
    }

    return this.getTurnaround(turnaroundId);
  }

  // Updates A-CDM milestones with validation (TSAT >= TOBT, AOBT >= TSAT).
  async updateMilestones(
    turnaroundId: string,
    dto: UpdateMilestonesDto,
  ): Promise<TurnaroundDocument> {
    const turnaround = await this.repo.findById(turnaroundId);
    if (!turnaround) {
      throw new NotFoundException(`Turnaround ${turnaroundId} not found`);
    }

    const milestones: Record<string, Date> = {};
    const existing = turnaround.milestones || {};

    for (const [key, value] of Object.entries(dto)) {
      if (value) milestones[key] = new Date(value);
    }

    // Validation: TSAT must be >= TOBT
    const tobt = milestones.tobt || existing.tobt;
    const tsat = milestones.tsat || existing.tsat;
    if (tobt && tsat && tsat < tobt) {
      throw new NotFoundException('TSAT must be >= TOBT');
    }

    // Validation: AOBT must be >= TSAT
    const aobt = milestones.aobt || existing.aobt;
    if (aobt && tsat && aobt < tsat) {
      throw new NotFoundException('AOBT must be >= TSAT');
    }

    const updated = await this.repo.updateMilestones(turnaroundId, milestones);
    if (!updated) {
      throw new NotFoundException('Failed to update milestones');
    }

    this.logger.log(
      `Milestones updated for turnaround ${turnaroundId}: ${Object.keys(milestones).join(', ')}`,
    );

    await this.eventPublisher.publishMilestoneUpdated(updated, Object.keys(milestones));
    return updated;
  }
}
