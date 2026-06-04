import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SettingsThrottle } from '../common/settings-throttle.decorator';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';
import { AgentsService } from './agents.service';
import { RunAgentDto } from './dto/agent.dto';

@Controller()
export class AgentAccessController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('agents/:id/invoke')
  @UseGuards(ApiKeyOrJwtGuard)
  async invoke(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RunAgentDto,
  ) {
    return { data: await this.agentsService.runApi(user.id, id, payload) };
  }

  @Post('public/agents/:slug/runs')
  @SettingsThrottle('rate_limit_public_agent')
  @UseGuards(SettingsThrottleGuard)
  async runPublished(
    @Param('slug') slug: string,
    @Body() payload: RunAgentDto,
  ) {
    return { data: await this.agentsService.runPublished(slug, payload) };
  }
}
