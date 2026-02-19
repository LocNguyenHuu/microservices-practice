import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../schemas/task.schema';

// Partial update for a specific task within a turnaround.
// Used by PATCH /api/turnarounds/:id/tasks/:taskId
export class UpdateTaskDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedCrewId?: string;
}
