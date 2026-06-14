import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentsService } from './agents.service';
import {
  CreateAgentDto,
  CreateAgentMarketplaceTemplateDto,
  CreateAgentTestCaseDto,
  CreateAgentTestSuiteDto,
  CreateAgentTaskDto,
  CreateAgentVersionDto,
  EvaluateAgentRunDto,
  GenerateAgentImprovementSuggestionsDto,
  GenerateAgentDto,
  InstallBuiltinAgentDto,
  InstallAgentTemplateDto,
  PublishAgentVersionDto,
  RunAgentDto,
  RunAgentTestSuiteDto,
  UpdateAgentDto,
  UpdateAgentPublicationDto,
} from './dto/agent.dto';

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

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: GenerateAgentDto,
  ) {
    return { data: await this.agentsService.generate(user.id, payload) };
  }

  @Get('marketplace/templates')
  async marketplaceTemplates(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.agentsService.listMarketplaceTemplates(user.id) };
  }

  @Get('builtin')
  async builtinAgents() {
    return { data: this.agentsService.listBuiltinAgents() };
  }

  @Post('builtin/:key/install')
  async installBuiltinAgent(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('key') key: string,
    @Body() payload: InstallBuiltinAgentDto = {},
  ) {
    return { data: await this.agentsService.installBuiltinAgent(user.id, key, payload) };
  }

  @Post('marketplace/templates')
  async createMarketplaceTemplate(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: CreateAgentMarketplaceTemplateDto,
  ) {
    return { data: await this.agentsService.createMarketplaceTemplate(user.id, payload) };
  }

  @Delete('marketplace/templates/:id')
  async deleteMarketplaceTemplate(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') templateId: string,
  ) {
    await this.agentsService.deleteMarketplaceTemplate(user.id, templateId);
    return { data: { ok: true } };
  }

  @Post('marketplace/install')
  async installMarketplaceTemplate(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: InstallAgentTemplateDto,
  ) {
    return { data: await this.agentsService.installMarketplaceTemplate(user.id, payload) };
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('runId') runId: string,
  ) {
    return { data: await this.agentsService.getRun(user.id, runId) };
  }

  @Get('tasks/:taskId')
  async getTask(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('taskId') taskId: string,
  ) {
    return { data: await this.agentsService.getTask(user.id, taskId) };
  }

  @Post('runs/:runId/evaluations')
  async evaluateRun(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('runId') runId: string,
    @Body() payload: EvaluateAgentRunDto,
  ) {
    return { data: await this.agentsService.evaluateRun(user.id, runId, payload) };
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

  @Patch(':id/publication')
  async updatePublication(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: UpdateAgentPublicationDto,
  ) {
    return { data: await this.agentsService.updatePublication(user.id, id, payload) };
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

  @Post(':id/runs/stream')
  async streamRun(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RunAgentDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    const write = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      (res as Response & { flush?: () => void }).flush?.();
    };
    try {
      await this.agentsService.runStream(user.id, id, payload, write);
      res.write('data: [DONE]\n\n');
    } catch (error) {
      write({ type: 'error', error: error instanceof Error ? error.message : String(error) });
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  @Get(':id/runs')
  async listRuns(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.listRuns(user.id, id) };
  }

  @Get(':id/tasks')
  async listTasks(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.listTasks(user.id, id) };
  }

  @Post(':id/tasks')
  async createTask(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: CreateAgentTaskDto,
  ) {
    return { data: await this.agentsService.createTask(user.id, id, payload) };
  }

  @Get(':id/evaluations')
  async listEvaluations(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.listEvaluations(user.id, id) };
  }

  @Get(':id/stats')
  async getStats(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.agentsService.getStats(user.id, id) };
  }

  @Post(':id/improvement-suggestions')
  async improvementSuggestions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: GenerateAgentImprovementSuggestionsDto = {},
  ) {
    return { data: await this.agentsService.generateImprovementSuggestions(user.id, id, payload) };
  }

  @Get(':id/versions')
  async listVersions(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return { data: await this.agentsService.listVersions(user.id, id) };
  }

  @Post(':id/versions')
  async createVersion(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: CreateAgentVersionDto,
  ) {
    return { data: await this.agentsService.createVersion(user.id, id, payload) };
  }

  @Post(':id/versions/publish')
  async publishVersion(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: PublishAgentVersionDto,
  ) {
    return { data: await this.agentsService.publishVersion(user.id, id, payload) };
  }

  @Get(':id/versions/compare')
  async compareVersions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Query('left') left: string,
    @Query('right') right: string,
  ) {
    return { data: await this.agentsService.compareVersions(user.id, id, left, right) };
  }

  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return { data: await this.agentsService.restoreVersion(user.id, id, versionId) };
  }

  @Post(':id/versions/:versionId/rollback')
  async rollbackVersion(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return { data: await this.agentsService.rollbackToVersion(user.id, id, versionId) };
  }

  @Get(':id/test-suites')
  async listTestSuites(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return { data: await this.agentsService.listTestSuites(user.id, id) };
  }

  @Post(':id/test-suites')
  async createTestSuite(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: CreateAgentTestSuiteDto,
  ) {
    return { data: await this.agentsService.createTestSuite(user.id, id, payload) };
  }

  @Get('test-suites/:suiteId/cases')
  async listTestCases(@CurrentUser() user: AuthenticatedRequestUser, @Param('suiteId') suiteId: string) {
    return { data: await this.agentsService.listTestCases(user.id, suiteId) };
  }

  @Post('test-suites/:suiteId/cases')
  async addTestCase(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('suiteId') suiteId: string,
    @Body() payload: CreateAgentTestCaseDto,
  ) {
    return { data: await this.agentsService.addTestCase(user.id, suiteId, payload) };
  }

  @Post('test-suites/:suiteId/runs')
  async runTestSuite(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('suiteId') suiteId: string,
    @Body() payload: RunAgentTestSuiteDto = {},
  ) {
    return { data: await this.agentsService.runTestSuite(user.id, suiteId, payload) };
  }

  @Get('test-suites/:suiteId/runs')
  async listTestRuns(@CurrentUser() user: AuthenticatedRequestUser, @Param('suiteId') suiteId: string) {
    return { data: await this.agentsService.listTestRuns(user.id, suiteId) };
  }

  @Get('test-runs/:runId')
  async getTestRun(@CurrentUser() user: AuthenticatedRequestUser, @Param('runId') runId: string) {
    return { data: await this.agentsService.getTestRun(user.id, runId) };
  }
}
