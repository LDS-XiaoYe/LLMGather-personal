import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWorkflowDto, RunWorkflowDto } from './dto/workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.workflowsService.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateWorkflowDto) {
    return { data: await this.workflowsService.create(user.id, payload) };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return { data: await this.workflowsService.get(user.id, id) };
  }

  @Post(':id/runs')
  async run(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RunWorkflowDto,
  ) {
    return {
      data: await this.workflowsService.run(user.id, id, payload.input, payload.agentId
        ? { runtimeAgentId: payload.agentId, skipWorkflowAgentIds: [payload.agentId] }
        : {}),
    };
  }
}
