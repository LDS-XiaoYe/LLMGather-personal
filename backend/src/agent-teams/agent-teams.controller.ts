import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentTeamsService } from './agent-teams.service';
import { CreateAgentTeamDto, RunAgentTeamDto } from './dto/agent-team.dto';

@Controller('agent-teams')
@UseGuards(JwtAuthGuard)
export class AgentTeamsController {
  constructor(private readonly agentTeamsService: AgentTeamsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.agentTeamsService.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateAgentTeamDto) {
    return { data: await this.agentTeamsService.create(user.id, payload) };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return { data: await this.agentTeamsService.get(user.id, id) };
  }

  @Post(':id/runs')
  async run(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RunAgentTeamDto,
  ) {
    return { data: await this.agentTeamsService.run(user.id, id, payload.input) };
  }
}
