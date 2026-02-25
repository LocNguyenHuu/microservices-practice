import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { TurnaroundService } from './turnaround.service';
import { CreateTurnaroundDto } from './dto/create-turnaround.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateMilestonesDto } from './dto/update-milestones.dto';
import { TurnaroundStatus } from './schemas/turnaround.schema';

// REST API for managing turnaround operations.
// Endpoints mirror the Go flight service pattern: /api/<resource>
@Controller('api/turnarounds')
export class TurnaroundController {
  constructor(private readonly turnaroundService: TurnaroundService) {}

  // POST /api/turnarounds — Create a turnaround (manual or via event consumer)
  @Post()
  async create(@Body() dto: CreateTurnaroundDto) {
    return this.turnaroundService.createTurnaround(dto);
  }

  // GET /api/turnarounds?status=in_progress&limit=20&offset=0
  @Get()
  async list(
    @Query('status') status?: TurnaroundStatus,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    return this.turnaroundService.listTurnarounds({
      status,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  }

  // GET /api/turnarounds/:id — Returns turnaround with all embedded tasks
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.turnaroundService.getTurnaround(id);
  }

  // PATCH /api/turnarounds/:id/tasks/:taskId — Update task status/notes/crew
  @Patch(':id/tasks/:taskId')
  async updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.turnaroundService.updateTask(id, taskId, dto);
  }

  // PATCH /api/turnarounds/:id/milestones — Update A-CDM milestones (TOBT, TSAT, etc.)
  @Patch(':id/milestones')
  async updateMilestones(
    @Param('id') id: string,
    @Body() dto: UpdateMilestonesDto,
  ) {
    return this.turnaroundService.updateMilestones(id, dto);
  }
}
