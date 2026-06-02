import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentsService } from './agents.service';
import { CreateAgentDto, RunAgentDto, UpdateAgentDto } from './dto/agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.agentsService.listByUser(user.id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: CreateAgentDto,
  ) {
    return { data: await this.agentsService.create(user.id, payload) };
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.getById(user.id, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: UpdateAgentDto,
  ) {
    return { data: await this.agentsService.update(user.id, id, payload) };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    await this.agentsService.softDelete(user.id, id);
    return { ok: true };
  }

  @Post(':id/runs')
  async run(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RunAgentDto,
  ) {
    return { data: await this.agentsService.run(user.id, id, payload) };
  }

  @Get(':id/runs')
  async listRuns(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.listRuns(user.id, id) };
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('runId') runId: string,
  ) {
    return { data: await this.agentsService.getRun(user.id, runId) };
  }
}
