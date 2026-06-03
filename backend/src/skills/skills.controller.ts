import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BindAgentSkillDto, CreateSkillDto, SetAgentSkillsDto, TestSkillDto, UpdateSkillDto } from './dto/skill.dto';
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

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    const [skill, agents] = await Promise.all([
      this.skillsService.getById(user.id, id),
      this.skillsService.listBoundAgents(user.id, id),
    ]);
    return { data: { ...skill, boundAgents: agents } };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: UpdateSkillDto,
  ) {
    return { data: await this.skillsService.update(user.id, id, payload) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    await this.skillsService.remove(user.id, id);
    return { data: { ok: true } };
  }

  @Post(':id/copy')
  async copy(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return { data: await this.skillsService.copyToCustom(user.id, id) };
  }

  @Post(':id/test')
  async test(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: TestSkillDto,
  ) {
    return { data: await this.skillsService.runSkill(user.id, id, payload) };
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
