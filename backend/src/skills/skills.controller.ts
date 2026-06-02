import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BindAgentSkillDto, CreateSkillDto, SetAgentSkillsDto } from './dto/skill.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.skillsService.listForUser(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateSkillDto) {
    return { data: await this.skillsService.create(user.id, payload) };
  }

  @Post(':id/bind-agent')
  async bindAgent(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: BindAgentSkillDto,
  ) {
    await this.skillsService.bindAgentSkill(user.id, payload.agentId, id);
    return { data: { ok: true } };
  }

  @Post('agents/:agentId')
  async setAgentSkills(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('agentId') agentId: string,
    @Body() payload: SetAgentSkillsDto,
  ) {
    await this.skillsService.setAgentSkills(user.id, agentId, payload.skillIds);
    return { data: { ok: true } };
  }
}
