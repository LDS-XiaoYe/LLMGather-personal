import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { BillingAuditInfo, BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import { ChatService } from '../gateway/chat.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionUsage, ChatMessage, ChatToolDefinition, ProviderKeyAuditInfo } from '../providers/provider.types';
import { SkillsService } from '../skills/skills.service';
import { ToolDefinition, ToolsService } from '../tools/tools.service';
import { BUILTIN_AGENT_SPECS, BuiltinAgentKey, BuiltinAgentSpec, getBuiltinAgentSpec } from './builtin-agents';
import {
  CreateAgentDto,
  CreateAgentMarketplaceTemplateDto,
  CreateAgentTestCaseDto,
  CreateAgentTestSuiteDto,
  CreateAgentVersionDto,
  EvaluateAgentRunDto,
  GenerateAgentImprovementSuggestionsDto,
  GenerateAgentDto,
  InstallBuiltinAgentDto,
  InstallAgentTemplateDto,
  RunAgentDto,
  RunAgentTestSuiteDto,
  UpdateAgentDto,
  UpdateAgentPublicationDto,
} from './dto/agent.dto';

export interface AgentDefinition {
  id: string;
  userId: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  memoryEnabled: boolean;
  toolIds: string[];
  knowledgeBaseIds: string[];
  skillIds: string[];
  published: boolean;
  apiEnabled: boolean;
  publicSlug: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
  builtinKey?: string;
  source?: 'user' | 'builtin';
}

export interface AgentRunStep {
  id: number;
  runId: string;
  stepType: string;
  name: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error: string;
  startedAt: string;
  endedAt: string | null;
  latencyMs: number;
  metadata: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  model: string;
  error: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  createdAt: string;
  completedAt: string | null;
  steps: AgentRunStep[];
}

export interface AgentEvaluation {
  id: string;
  agentId: string;
  runId: string;
  userId: string;
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
  summary: string;
  rubric: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRunStats {
  agentId: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  successRate: number;
  averageLatencyMs: number;
  averageTokens: number;
  averageScore: number;
  evaluatedRuns: number;
}

export type AgentRunStreamEvent =
  | { type: 'run_created'; run: AgentRun }
  | { type: 'step_started'; step: AgentRunStep }
  | { type: 'step_updated'; step: AgentRunStep }
  | { type: 'step_completed'; step: AgentRunStep }
  | { type: 'context_packed'; runId: string; contextCount: number; strategy: string }
  | { type: 'reflection_started'; runId: string; round: number }
  | { type: 'reflection_completed'; runId: string; round: number; decision: string; reason: string }
  | { type: 'llm_delta'; runId: string; delta: string; output: string }
  | { type: 'run_completed'; run: AgentRun }
  | { type: 'error'; runId?: string; error: string };

type EmitAgentRunEvent = (event: AgentRunStreamEvent) => void;

type AgentExecutionOptions = {
  emitRunCreated?: boolean;
  delegationDepth?: number;
  inheritedKnowledgeBaseIds?: string[];
};

type AgentPlannerAction =
  | { action: 'tool'; toolId?: string; toolName?: string; args?: Record<string, unknown>; reason?: string }
  | { action: 'delegate'; agentKey?: string; agentId?: string; input?: string; reason?: string }
  | { action: 'final'; answer?: string; reason?: string };

type AgentRunStepInput = {
  stepType: string;
  name: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error?: string;
  startedAt: string;
  endedAt: string | null;
  latencyMs: number;
  metadata: string;
};

type ResolvedRunnableTools = {
  allowed: ToolDefinition[];
  skipped: Array<{ tool: ToolDefinition; reason: string; requiresApproval: boolean }>;
};

type AgentGraphState = {
  contextBlocks: string[];
  tools: ToolDefinition[];
  skippedTools: ResolvedRunnableTools['skipped'];
  observations: string[];
  action: AgentPlannerAction | null;
  reflection: AgentReflectionDecision | null;
  finalOutput: string;
  round: number;
  maxSteps: number;
};

type AgentReflectionDecision = {
  decision: 'continue' | 'final' | 'retry';
  reason: string;
  hint?: string;
};

type HarnessToolCall = NonNullable<ChatMessage['tool_calls']>[number];

type HarnessToolResult = {
  call: HarnessToolCall;
  tool: ToolDefinition | null;
  args: Record<string, unknown>;
  output: string;
  error: string;
  status: 'succeeded' | 'failed';
};

type AgentRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: string | number;
  maxTokens: string | number;
  memoryEnabled?: string | number;
  published?: string | number;
  apiEnabled?: string | number;
  publicSlug?: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount?: string | number;
};

@Injectable()
export class AgentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly chatService: ChatService,
    private readonly billingService: BillingService,
    private readonly toolsService: ToolsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly memoryService: MemoryService,
    private readonly skillsService: SkillsService,
  ) {}

  async listByUser(userId: string): Promise<AgentDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT
         a.id,
         a.user_id as userId,
         a.name,
         a.description,
         a.model,
         a.system_prompt as systemPrompt,
         a.temperature,
         a.max_tokens as maxTokens,
         a.memory_enabled as memoryEnabled,
         a.published,
         a.api_enabled as apiEnabled,
         a.public_slug as publicSlug,
         a.status,
         a.created_at as createdAt,
         a.updated_at as updatedAt,
         stats.lastRunAt,
         COALESCE(stats.runCount, 0) as runCount
       FROM agents a
       LEFT JOIN (
         SELECT agent_id, user_id, MAX(created_at) as lastRunAt, COUNT(*) as runCount
         FROM agent_runs
         GROUP BY agent_id, user_id
       ) stats ON stats.agent_id = a.id AND stats.user_id = a.user_id
       WHERE a.user_id = ? AND a.deleted_at IS NULL
       ORDER BY a.updated_at DESC`,
    ).all(userId) as unknown as AgentRow[];

    const agents: AgentDefinition[] = [];
    for (const row of rows) {
      agents.push(await this.withBindings(userId, this.mapAgent(row)));
    }
    return agents;
  }

  async getById(userId: string, agentId: string): Promise<AgentDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT
         id,
         user_id as userId,
         name,
         description,
         model,
         system_prompt as systemPrompt,
         temperature,
         max_tokens as maxTokens,
         memory_enabled as memoryEnabled,
         published,
         api_enabled as apiEnabled,
         public_slug as publicSlug,
         status,
         created_at as createdAt,
         updated_at as updatedAt,
         0 as runCount
       FROM agents
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(agentId, userId) as unknown as AgentRow | undefined;

    if (!row) throw new NotFoundException('Agent 不存在或已删除');
    return this.withBindings(userId, this.mapAgent(row));
  }

  async create(userId: string, dto: CreateAgentDto): Promise<AgentDefinition> {
    this.assertRunnableModel(dto.model);
    const now = this.databaseService.now();
    const id = randomUUID();
    await this.databaseService.connection.prepare(
      `INSERT INTO agents
        (id, user_id, name, description, model, system_prompt, temperature, max_tokens, memory_enabled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      dto.name.trim(),
      dto.description?.trim() ?? '',
      dto.model.trim(),
      dto.systemPrompt?.trim() ?? '',
      dto.temperature ?? 0.7,
      dto.maxTokens ?? 1024,
      dto.memoryEnabled === false ? 0 : 1,
      dto.status ?? 'active',
      now,
      now,
    );
    await this.toolsService.setAgentTools(userId, id, dto.toolIds ?? [], dto.toolPermissions ?? {});
    await this.knowledgeService.setAgentKnowledgeBases(userId, id, dto.knowledgeBaseIds ?? []);
    await this.skillsService.setAgentSkills(userId, id, dto.skillIds ?? []);
    return this.getById(userId, id);
  }

  async generate(userId: string, dto: GenerateAgentDto): Promise<AgentDefinition | Record<string, unknown>> {
    this.assertRunnableModel(dto.model);
    const tools = await this.toolsService.listForUser(userId);
    const skills = await this.skillsService.listForUser(userId);
    const request: ChatCompletionRequest = {
      model: dto.model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: [
            '你是 Agent 产品架构师。根据用户需求生成一个可运行 Agent 配置，只输出 JSON。',
            'JSON 字段: name, description, systemPrompt, temperature, maxTokens, toolNames, skillNames, memoryEnabled。',
            `可用工具: ${tools.map((tool) => tool.name).join(', ')}`,
            `可用 Skill: ${skills.map((skill) => skill.name).join(', ')}`,
          ].join('\n'),
        },
        { role: 'user', content: dto.requirement },
      ],
    };
    const completion = await this.chatService.createCompletion(request);
    const content = completion.choices?.[0]?.message?.content ?? '';
    const spec = this.extractGeneratedAgentSpec(content, dto.requirement);
    const toolIds = tools.filter((tool) => spec.toolNames.includes(tool.name)).map((tool) => tool.id);
    const skillIds = skills.filter((skill) => spec.skillNames.includes(skill.name)).map((skill) => skill.id);
    const payload: CreateAgentDto = {
      name: spec.name,
      description: spec.description,
      model: dto.model,
      systemPrompt: spec.systemPrompt,
      temperature: spec.temperature,
      maxTokens: spec.maxTokens,
      memoryEnabled: spec.memoryEnabled,
      toolIds,
      skillIds,
      knowledgeBaseIds: [],
    };
    if (dto.persist === false) {
      return { ...payload, toolIds, skillIds };
    }
    return this.create(userId, payload);
  }

  async update(userId: string, agentId: string, dto: UpdateAgentDto): Promise<AgentDefinition> {
    const current = await this.getById(userId, agentId);
    const next = {
      name: dto.name?.trim() ?? current.name,
      description: dto.description?.trim() ?? current.description,
      model: dto.model?.trim() ?? current.model,
      systemPrompt: dto.systemPrompt?.trim() ?? current.systemPrompt,
      temperature: dto.temperature ?? current.temperature,
      maxTokens: dto.maxTokens ?? current.maxTokens,
      memoryEnabled: dto.memoryEnabled ?? current.memoryEnabled,
      status: dto.status ?? current.status,
    };
    this.assertRunnableModel(next.model);

    await this.databaseService.connection.prepare(
      `UPDATE agents
       SET name = ?, description = ?, model = ?, system_prompt = ?, temperature = ?, max_tokens = ?, memory_enabled = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(
      next.name,
      next.description,
      next.model,
      next.systemPrompt,
      next.temperature,
      next.maxTokens,
      next.memoryEnabled ? 1 : 0,
      next.status,
      this.databaseService.now(),
      agentId,
      userId,
    );
    if (dto.toolIds) await this.toolsService.setAgentTools(userId, agentId, dto.toolIds, dto.toolPermissions ?? {});
    if (dto.knowledgeBaseIds) await this.knowledgeService.setAgentKnowledgeBases(userId, agentId, dto.knowledgeBaseIds);
    if (dto.skillIds) await this.skillsService.setAgentSkills(userId, agentId, dto.skillIds);
    return this.getById(userId, agentId);
  }

  async softDelete(userId: string, agentId: string): Promise<void> {
    await this.getById(userId, agentId);
    await this.databaseService.connection.prepare(
      'UPDATE agents SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    ).run(this.databaseService.now(), this.databaseService.now(), agentId, userId);
  }

  async listMarketplaceTemplates(userId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, source_agent_id as sourceAgentId, name, description, category,
              template_json as templateJson, created_at as createdAt, updated_at as updatedAt
       FROM agent_marketplace_templates
       WHERE user_id = ? AND public_enabled = 1
       ORDER BY updated_at DESC`,
    ).all(userId) as unknown as Array<{
      id: string;
      userId: string;
      sourceAgentId: string;
      name: string;
      description: string;
      category: string;
      templateJson: string;
      createdAt: string;
      updatedAt: string;
    }>;
    const customTemplates = rows.map((row) => {
      let template: Record<string, unknown> = {};
      try {
        template = JSON.parse(row.templateJson || '{}') as Record<string, unknown>;
      } catch {}
      return {
        ...template,
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        source: 'custom',
        sourceAgentId: row.sourceAgentId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
    return [...customTemplates, ...this.marketplaceTemplates()];
  }

  listBuiltinAgents(): Array<Record<string, unknown>> {
    return BUILTIN_AGENT_SPECS.map((agent) => ({
      key: agent.key,
      name: agent.name,
      category: agent.category,
      description: agent.description,
      intents: agent.intents,
      tags: agent.tags,
      riskLevel: agent.riskLevel,
      toolNames: agent.toolNames,
      skillNames: agent.skillNames,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      source: 'builtin',
    }));
  }

  async installBuiltinAgent(userId: string, key: string, dto: InstallBuiltinAgentDto = {}): Promise<AgentDefinition> {
    const spec = getBuiltinAgentSpec(key);
    if (!spec) throw new NotFoundException('内置 Agent 不存在');
    const model = (dto.model || 'qwen-plus').trim();
    this.assertRunnableModel(model);
    const runtime = await this.buildBuiltinRuntimeAgent(userId, spec, model);
    return this.create(userId, {
      name: runtime.name,
      description: runtime.description,
      model,
      systemPrompt: runtime.systemPrompt,
      temperature: runtime.temperature,
      maxTokens: runtime.maxTokens,
      memoryEnabled: runtime.memoryEnabled,
      toolIds: runtime.toolIds,
      skillIds: runtime.skillIds,
      knowledgeBaseIds: [],
    });
  }

  async runBuiltinAgent(
    userId: string,
    key: string,
    dto: RunAgentDto,
    model: string,
    emit?: EmitAgentRunEvent,
  ): Promise<AgentRun> {
    const spec = getBuiltinAgentSpec(key);
    if (!spec) throw new NotFoundException('内置 Agent 不存在');
    const agent = await this.buildBuiltinRuntimeAgent(userId, spec, model);
    return this.executeAgentRun(userId, agent, dto, emit ?? (() => undefined), { emitRunCreated: Boolean(emit), delegationDepth: 0 });
  }

  async createMarketplaceTemplate(
    userId: string,
    dto: CreateAgentMarketplaceTemplateDto,
  ): Promise<Record<string, unknown>> {
    const agent = await this.getById(userId, dto.sourceAgentId);
    const id = randomUUID();
    const now = this.databaseService.now();
    const template = {
      source: 'custom',
      sourceAgentId: agent.id,
      name: dto.name.trim(),
      category: (dto.category?.trim() || 'custom').slice(0, 64),
      description: dto.description?.trim() || agent.description || '用户发布的 Agent 模板',
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      memoryEnabled: agent.memoryEnabled,
      toolIds: agent.toolIds,
      skillIds: agent.skillIds,
      knowledgeBaseIds: agent.knowledgeBaseIds,
    };
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_marketplace_templates
       (id, user_id, source_agent_id, name, description, category, template_json, public_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      userId,
      agent.id,
      template.name,
      template.description,
      template.category,
      JSON.stringify(template),
      now,
      now,
    );
    return { ...template, id, createdAt: now, updatedAt: now };
  }

  async installMarketplaceTemplate(userId: string, dto: InstallAgentTemplateDto): Promise<AgentDefinition> {
    const template = (await this.listMarketplaceTemplates(userId)).find((item) => item.id === dto.templateId);
    if (!template) throw new NotFoundException('Agent 模板不存在');
    const tools = await this.toolsService.listForUser(userId);
    const skills = await this.skillsService.listForUser(userId);
    const templateToolIds = Array.isArray(template.toolIds) ? template.toolIds.map(String) : [];
    const templateSkillIds = Array.isArray(template.skillIds) ? template.skillIds.map(String) : [];
    const templateKbIds = Array.isArray(template.knowledgeBaseIds) ? template.knowledgeBaseIds.map(String) : [];
    const toolNames = Array.isArray(template.toolNames) ? template.toolNames.map(String) : [];
    const skillNames = Array.isArray(template.skillNames) ? template.skillNames.map(String) : [];
    const availableToolIds = new Set(tools.map((tool) => tool.id));
    const availableSkillIds = new Set(skills.map((skill) => skill.id));
    const toolIds = templateToolIds.length
      ? templateToolIds.filter((id) => availableToolIds.has(id))
      : tools.filter((tool) => toolNames.includes(tool.name)).map((tool) => tool.id);
    const skillIds = templateSkillIds.length
      ? templateSkillIds.filter((id) => availableSkillIds.has(id))
      : skills.filter((skill) => skillNames.includes(skill.name)).map((skill) => skill.id);
    return this.create(userId, {
      name: String(template.name),
      description: String(template.description),
      model: dto.model,
      systemPrompt: String(template.systemPrompt),
      temperature: Number(template.temperature ?? 0.4),
      maxTokens: Number(template.maxTokens ?? 2048),
      memoryEnabled: template.memoryEnabled !== false,
      toolIds,
      skillIds,
      knowledgeBaseIds: templateKbIds,
    });
  }

  async updatePublication(
    userId: string,
    agentId: string,
    dto: UpdateAgentPublicationDto,
  ): Promise<AgentDefinition> {
    const current = await this.getById(userId, agentId);
    const published = dto.published ?? current.published;
    const apiEnabled = dto.apiEnabled ?? current.apiEnabled;
    const publicSlug = this.normalizeSlug(dto.publicSlug ?? (current.publicSlug || current.name));
    await this.assertSlugAvailable(userId, agentId, publicSlug);

    await this.databaseService.connection.prepare(
      `UPDATE agents
       SET published = ?, api_enabled = ?, public_slug = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(
      published ? 1 : 0,
      apiEnabled ? 1 : 0,
      publicSlug,
      this.databaseService.now(),
      agentId,
      userId,
    );
    return this.getById(userId, agentId);
  }

  async runApi(userId: string, agentId: string, dto: RunAgentDto): Promise<AgentRun> {
    const agent = await this.getById(userId, agentId);
    if (!agent.apiEnabled) throw new BadRequestException('Agent 尚未开启 API 接入');
    return this.run(userId, agentId, dto);
  }

  async runPublished(publicSlug: string, dto: RunAgentDto): Promise<AgentRun> {
    const slug = this.normalizeSlug(publicSlug);
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId
       FROM agents
       WHERE public_slug = ? AND published = 1 AND api_enabled = 1 AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
    ).get(slug) as unknown as { id: string; userId: string } | undefined;
    if (!row) throw new NotFoundException('公开 Agent 不存在或未发布');
    return this.run(row.userId, row.id, dto);
  }

  async run(userId: string, agentId: string, dto: RunAgentDto): Promise<AgentRun> {
    const agent = await this.getById(userId, agentId);
    if (agent.status !== 'active') throw new BadRequestException('Agent 已归档，无法运行');
    return this.executeAgentRun(userId, agent, dto, () => undefined, { emitRunCreated: false, delegationDepth: 0 });
  }

  async runStream(
    userId: string,
    agentId: string,
    dto: RunAgentDto,
    emit: EmitAgentRunEvent,
  ): Promise<AgentRun> {
    const agent = await this.getById(userId, agentId);
    if (agent.status !== 'active') throw new BadRequestException('Agent 已归档，无法运行');
    return this.executeAgentRun(userId, agent, dto, emit, { emitRunCreated: true, delegationDepth: 0 });
  }

  private async executeAgentRun(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    emit: EmitAgentRunEvent,
    options: AgentExecutionOptions = {},
  ): Promise<AgentRun> {
    const runId = randomUUID();
    const startedAt = Date.now();
    const now = this.databaseService.now();
    const usageTotal: ChatCompletionUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_runs
        (id, agent_id, user_id, status, input, output, model, error, prompt_tokens, completion_tokens, total_tokens, latency_ms, created_at)
       VALUES (?, ?, ?, 'running', ?, '', ?, '', 0, 0, 0, 0, ?)`,
    ).run(runId, agent.id, userId, dto.input, agent.model, now);
    if (options.emitRunCreated) emit({ type: 'run_created', run: await this.getRun(userId, runId) });

    const insertAndEmit = async (step: AgentRunStepInput) => {
      const id = await this.insertStep(runId, agent.id, userId, step);
      const inserted = await this.getStep(userId, runId, id);
      emit({ type: inserted.status === 'running' ? 'step_started' : 'step_completed', step: inserted });
      return inserted;
    };

    const completeAndEmit = async (
      stepId: number,
      status: 'succeeded' | 'failed',
      output: string,
      error = '',
      metadata?: Record<string, unknown>,
    ) => {
      const endedAt = this.databaseService.now();
      const row = await this.getStep(userId, runId, stepId);
      const latencyMs = Date.now() - new Date(String(row.startedAt).replace(' ', 'T')).getTime();
      await this.databaseService.connection.prepare(
        `UPDATE agent_run_steps
         SET status = ?, output = ?, error = ?, ended_at = ?, latency_ms = ?, metadata = ?
         WHERE id = ? AND run_id = ? AND user_id = ?`,
      ).run(status, output, error, endedAt, Number.isFinite(latencyMs) ? latencyMs : 0, JSON.stringify(metadata ?? this.parseJsonRecord(row.metadata)), stepId, runId, userId);
      const updated = await this.getStep(userId, runId, stepId);
      emit({ type: 'step_completed', step: updated });
      return updated;
    };

    try {
      const maxSteps = Math.max(1, Math.min(10, dto.maxSteps ?? 6));
      const graph = this.buildAgentExecutionGraph(userId, agent, dto, runId, options, emit, insertAndEmit, completeAndEmit, usageTotal);
      const graphState = await graph.invoke({
        contextBlocks: [],
        tools: [],
        skippedTools: [],
        observations: [],
        action: null,
        reflection: null,
        finalOutput: '',
        round: 0,
        maxSteps,
      } as AgentGraphState) as AgentGraphState;
      const finalOutput = graphState.finalOutput || '';

      await this.applySmartMemory(userId, agent, dto, finalOutput, runId, insertAndEmit, usageTotal);
      const completedAt = this.databaseService.now();
      const latencyMs = Date.now() - startedAt;
      await this.databaseService.connection.prepare(
        `UPDATE agent_runs
         SET status = 'succeeded', output = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, latency_ms = ?, completed_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(finalOutput, usageTotal.prompt_tokens, usageTotal.completion_tokens, usageTotal.total_tokens, latencyMs, completedAt, runId, userId);
      const run = await this.getRun(userId, runId);
      emit({ type: 'run_completed', run });
      return run;
    } catch (error) {
      const message = this.errorMessage(error);
      const completedAt = this.databaseService.now();
      const latencyMs = Date.now() - startedAt;
      await insertAndEmit({
        stepType: 'error',
        name: '执行失败',
        status: 'failed',
        input: dto.input,
        output: '',
        error: message,
        startedAt: completedAt,
        endedAt: completedAt,
        latencyMs: 0,
        metadata: '',
      }).catch(() => undefined);
      await this.databaseService.connection.prepare(
        `UPDATE agent_runs
         SET status = 'failed', error = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, latency_ms = ?, completed_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(message, usageTotal.prompt_tokens, usageTotal.completion_tokens, usageTotal.total_tokens, latencyMs, completedAt, runId, userId);
      emit({ type: 'error', runId, error: message });
      const run = await this.getRun(userId, runId);
      emit({ type: 'run_completed', run });
      return run;
    }
  }

  private buildAgentExecutionGraph(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    runId: string,
    options: AgentExecutionOptions,
    emit: EmitAgentRunEvent,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    completeAndEmit: (stepId: number, status: 'succeeded' | 'failed', output: string, error?: string, metadata?: Record<string, unknown>) => Promise<AgentRunStep>,
    usageTotal: ChatCompletionUsage,
  ) {
    const State = Annotation.Root({
      contextBlocks: Annotation<string[]>(),
      tools: Annotation<ToolDefinition[]>(),
      skippedTools: Annotation<ResolvedRunnableTools['skipped']>(),
      observations: Annotation<string[]>(),
      action: Annotation<AgentPlannerAction | null>(),
      reflection: Annotation<AgentReflectionDecision | null>(),
      finalOutput: Annotation<string>(),
      round: Annotation<number>(),
      maxSteps: Annotation<number>(),
    });

    type StateType = typeof State.State;

    const graph = new StateGraph(State)
      .addNode('context', async (state: StateType) => {
        const contextBlocks = await this.collectAgentContext(userId, agent, dto, runId, options, insertAndEmit);
        emit({ type: 'context_packed', runId, contextCount: contextBlocks.length, strategy: dto.contextStrategy ?? 'balanced' });
        return { ...state, contextBlocks };
      })
      .addNode('guardTools', async (state: StateType) => {
        const { allowed, skipped } = await this.resolveRunnableTools(userId, agent, dto.approvedToolIds ?? []);
        for (const item of skipped) {
          await insertAndEmit({
            stepType: 'tool_call',
            name: `跳过工具：${item.tool.displayName || item.tool.name}`,
            status: 'failed',
            input: JSON.stringify({ toolId: item.tool.id, toolName: item.tool.name }, null, 2),
            output: '',
            error: item.reason,
            startedAt: this.databaseService.now(),
            endedAt: this.databaseService.now(),
            latencyMs: 0,
            metadata: JSON.stringify({
              skipped: true,
              requiresApproval: item.requiresApproval,
              permissionLevel: item.tool.permissionLevel ?? 'auto',
              riskLevel: this.effectiveToolRisk(item.tool),
            }),
          });
        }
        return { ...state, tools: allowed, skippedTools: skipped };
      })
      .addNode('plan', async (state: StateType) => {
        const round = state.round + 1;
        const planStarted = this.databaseService.now();
        let action: AgentPlannerAction;
        try {
          const planned = await this.planNextAgentAction(agent, dto, state.contextBlocks, state.observations, state.tools, options.delegationDepth ?? 0);
          this.addUsage(usageTotal, planned.usage);
          action = planned.action;
          await insertAndEmit({
            stepType: 'plan',
            name: `LangGraph 规划 ${round}`,
            status: 'succeeded',
            input: dto.input,
            output: JSON.stringify(action, null, 2),
            startedAt: planStarted,
            endedAt: this.databaseService.now(),
            latencyMs: 0,
            metadata: JSON.stringify({
              round,
              graphNode: 'plan',
              availableTools: state.tools.map((tool: ToolDefinition) => tool.name),
              plannerConfidence: this.plannerActionConfidence(action),
            }),
          });
        } catch (error) {
          action = { action: 'final', reason: `规划失败，直接回答：${this.errorMessage(error)}` };
          await insertAndEmit({
            stepType: 'plan',
            name: `LangGraph 规划 ${round}`,
            status: 'failed',
            input: dto.input,
            output: '',
            error: this.errorMessage(error),
            startedAt: planStarted,
            endedAt: this.databaseService.now(),
            latencyMs: 0,
            metadata: JSON.stringify({ round, graphNode: 'plan' }),
          });
        }
        return { ...state, action, round };
      })
      .addNode('tool', async (state: StateType) => this.runGraphToolNode(userId, agent, dto, runId, state, insertAndEmit))
      .addNode('delegate', async (state: StateType) => this.runGraphDelegateNode(userId, agent, dto, runId, options, state, insertAndEmit, completeAndEmit))
      .addNode('observe', async (state: StateType) => state)
      .addNode('reflect', async (state: StateType) => {
        emit({ type: 'reflection_started', runId, round: state.round });
        const reflected = this.reflectAgentProgress(dto, state);
        await insertAndEmit({
          stepType: 'reflection',
          name: `执行反思 ${state.round}`,
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(reflected, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: 0,
          metadata: JSON.stringify({
            round: state.round,
            graphNode: 'reflect',
            observationCount: state.observations.length,
            fallbackReason: reflected.reason,
          }),
        });
        emit({ type: 'reflection_completed', runId, round: state.round, decision: reflected.decision, reason: reflected.reason });
        return { ...state, reflection: reflected };
      })
      .addNode('final', async (state: StateType) => {
        const hint = state.round >= state.maxSteps
          ? '已达到最大执行轮数，请基于已有观察输出最终结果。'
          : state.reflection?.decision === 'final'
            ? state.reflection.hint || state.reflection.reason
          : state.action?.action === 'final'
            ? state.action.answer || state.action.reason || ''
            : '';
        const finalOutput = await this.generateFinalAgentOutput(
          userId,
          agent,
          dto,
          state.contextBlocks,
          state.observations,
          hint,
          runId,
          emit,
          insertAndEmit,
          completeAndEmit,
          usageTotal,
          state.tools,
          state.maxSteps,
        );
        return { ...state, finalOutput };
      })
      .addEdge(START, 'context')
      .addEdge('context', 'guardTools')
      .addConditionalEdges('guardTools', (state: StateType) => state.tools.length > 0 ? 'final' : 'plan', {
        final: 'final',
        plan: 'plan',
      })
      .addConditionalEdges('plan', (state: StateType) => this.routePlannedAction(state), {
        tool: 'tool',
        delegate: 'delegate',
        final: 'final',
      })
      .addEdge('tool', 'observe')
      .addEdge('delegate', 'observe')
      .addConditionalEdges('observe', (state: StateType) => this.shouldReflect(dto, state) ? 'reflect' : state.round >= state.maxSteps ? 'final' : 'plan', {
        reflect: 'reflect',
        plan: 'plan',
        final: 'final',
      })
      .addConditionalEdges('reflect', (state: StateType) => this.routeReflection(state), {
        plan: 'plan',
        final: 'final',
      })
      .addEdge('final', END);

    return graph.compile({ name: 'agent-execution-graph' });
  }

  private routePlannedAction(state: AgentGraphState): 'tool' | 'delegate' | 'final' {
    if (state.round >= state.maxSteps) return 'final';
    if (state.action?.action === 'tool') return 'tool';
    if (state.action?.action === 'delegate') return 'delegate';
    return 'final';
  }

  private shouldReflect(dto: RunAgentDto, state: AgentGraphState): boolean {
    if (dto.mode === 'fast') return false;
    if (dto.mode === 'reflective') return true;
    return state.skippedTools.length > 0 || state.observations.some((item) => /\bfailed\b|失败|不可用|未授权/i.test(item));
  }

  private routeReflection(state: AgentGraphState): 'plan' | 'final' {
    if (state.round >= state.maxSteps) return 'final';
    if (state.reflection?.decision === 'final') return 'final';
    return 'plan';
  }

  private reflectAgentProgress(dto: RunAgentDto, state: AgentGraphState): AgentReflectionDecision {
    const lastObservation = state.observations[state.observations.length - 1] ?? '';
    const hasFailure = state.skippedTools.length > 0 || /\bfailed\b|失败|不可用|未授权/i.test(lastObservation);
    if (state.round >= state.maxSteps) {
      return {
        decision: 'final',
        reason: '已达到最大执行轮数。',
        hint: '基于已有观察给出最终结果，并说明哪些步骤受限。',
      };
    }
    if (dto.mode === 'reflective' && !lastObservation && state.round > 0) {
      return {
        decision: 'final',
        reason: '没有新的观察可继续扩展。',
        hint: '直接回答用户任务，并说明可用上下文有限。',
      };
    }
    if (hasFailure && state.round + 1 >= state.maxSteps) {
      return {
        decision: 'final',
        reason: '工具或委派受限，且剩余轮数不足。',
        hint: '给出替代方案、人工验证步骤和受限原因。',
      };
    }
    return {
      decision: hasFailure ? 'retry' : 'continue',
      reason: hasFailure ? '检测到失败或跳过的能力，回到规划阶段寻找替代路径。' : '已有观察可继续推进。',
    };
  }

  private plannerActionConfidence(action: AgentPlannerAction): number {
    if (action.action === 'final') return action.answer || action.reason ? 0.78 : 0.55;
    if (action.action === 'tool') return action.toolId || action.toolName ? 0.82 : 0.42;
    if (action.action === 'delegate') return action.agentKey ? 0.76 : 0.4;
    return 0.5;
  }

  private async runGraphToolNode(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    runId: string,
    state: AgentGraphState,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
  ): Promise<Partial<AgentGraphState>> {
    const action = state.action?.action === 'tool' ? state.action : null;
    const tool = action
      ? state.tools.find((item) => item.id === action.toolId || item.name === action.toolName || item.name === action.toolId)
      : undefined;
    if (!action || !tool) {
      const denied = `工具不可用或未授权: ${action?.toolName || action?.toolId || 'unknown'}`;
      await insertAndEmit({
        stepType: 'observation',
        name: '工具不可用',
        status: 'failed',
        input: JSON.stringify(action ?? {}, null, 2),
        output: '',
        error: denied,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ round: state.round, graphNode: 'tool', fallbackReason: denied }),
      });
      return { observations: [...state.observations, denied], action: null };
    }

    const stepStarted = Date.now();
    const result = await this.toolsService.invoke(userId, tool.id, action.args ?? {}, { agentId: agent.id, runId });
    await insertAndEmit({
      stepType: 'tool_call',
      name: `工具调用：${tool.displayName || tool.name}`,
      status: result.status,
      input: JSON.stringify(action.args ?? {}, null, 2),
      output: result.output,
      error: result.error,
      startedAt: this.databaseService.now(),
      endedAt: this.databaseService.now(),
      latencyMs: Date.now() - stepStarted,
      metadata: JSON.stringify({
        toolId: tool.id,
        toolName: tool.name,
        round: state.round,
        reason: action.reason ?? '',
        graphNode: 'act',
        fallbackReason: result.status === 'failed' ? result.error : '',
      }),
    });
    const observation = `${tool.name} ${result.status}: ${result.output || result.error}`;
    await insertAndEmit({
      stepType: 'observation',
      name: '工具观察',
      status: result.status,
      input: tool.name,
      output: observation,
      error: result.error,
      startedAt: this.databaseService.now(),
      endedAt: this.databaseService.now(),
      latencyMs: 0,
      metadata: JSON.stringify({ round: state.round, graphNode: 'observe' }),
    });
    return { observations: [...state.observations, observation.slice(0, 6000)], action: null };
  }

  private async runGraphDelegateNode(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    runId: string,
    options: AgentExecutionOptions,
    state: AgentGraphState,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    completeAndEmit: (stepId: number, status: 'succeeded' | 'failed', output: string, error?: string, metadata?: Record<string, unknown>) => Promise<AgentRunStep>,
  ): Promise<Partial<AgentGraphState>> {
    const action = state.action?.action === 'delegate' ? state.action : null;
    if (!action) return { action: null };
    const delegated = await this.delegateBuiltinAgent(userId, agent, dto, action, runId, options, insertAndEmit, completeAndEmit);
    return { observations: [...state.observations, delegated.observation], action: null };
  }

  private async collectAgentContext(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    runId: string,
    options: AgentExecutionOptions,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
  ): Promise<string[]> {
    const contextBlocks: string[] = [];
    const strategy = dto.contextStrategy ?? 'balanced';
    const now = this.databaseService.now();
    await insertAndEmit({
      stepType: 'context_pack',
      name: '上下文打包',
      status: 'succeeded',
      input: dto.input,
      output: JSON.stringify({
        systemPrompt: Boolean(agent.systemPrompt),
        historyMessages: dto.messages?.length ?? 0,
        model: agent.model,
        source: agent.source ?? 'user',
        builtinKey: agent.builtinKey ?? '',
        strategy,
      }, null, 2),
      startedAt: now,
      endedAt: this.databaseService.now(),
      latencyMs: 0,
      metadata: JSON.stringify({ runId, graphNode: 'contextPack', contextSources: [] }),
    });

    if (strategy !== 'minimal' && agent.skillIds.length > 0) {
      const started = Date.now();
      const skills = await this.resolveAgentSkills(userId, agent);
      if (skills.length > 0) {
        contextBlocks.push(`Agent Skills:\n${skills.map((skill) => `## ${skill.name}\n${skill.content}`).join('\n\n')}`);
      }
      await insertAndEmit({
        stepType: 'skill_context',
        name: 'Skill 能力注入',
        status: 'succeeded',
        input: dto.input,
        output: JSON.stringify(skills.map((skill) => ({ id: skill.id, name: skill.name, category: skill.category })), null, 2),
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: Date.now() - started,
        metadata: JSON.stringify({
          graphNode: 'contextPack',
          contextSources: skills.map((skill) => ({ type: 'skill', id: skill.id, name: skill.name })),
          skillIds: agent.skillIds,
          count: skills.length,
        }),
      });
    }

    if (strategy !== 'minimal' && strategy !== 'knowledge_first' && agent.memoryEnabled) {
      const started = Date.now();
      try {
        const memories = await this.memoryService.search(userId, dto.input, agent.id, 6);
        if (memories.length > 0) {
          contextBlocks.push(`长期记忆:\n${memories.map((m, idx) => `[${idx + 1}] ${m.memoryType}/${m.importance}: ${m.content}`).join('\n')}`);
        }
        await insertAndEmit({
          stepType: 'memory_retrieval',
          name: '长期记忆检索',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(memories, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - started,
          metadata: JSON.stringify({
            graphNode: 'contextPack',
            contextSources: memories.map((memory) => ({ type: 'memory', id: memory.id, score: memory.score ?? null })),
            count: memories.length,
          }),
        });
      } catch (error) {
        await insertAndEmit({
          stepType: 'memory_retrieval',
          name: '长期记忆检索',
          status: 'failed',
          input: dto.input,
          output: '',
          error: this.errorMessage(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - started,
          metadata: JSON.stringify({ graphNode: 'contextPack', contextSources: [] }),
        });
      }
    }

    const kbIds = Array.from(new Set([...(agent.knowledgeBaseIds ?? []), ...(options.inheritedKnowledgeBaseIds ?? [])].filter(Boolean)));
    if (strategy !== 'minimal' && strategy !== 'memory_first' && kbIds.length > 0) {
      const started = Date.now();
      try {
        const chunks = await this.knowledgeService.search(userId, kbIds, dto.input, 6);
        if (chunks.length > 0) {
          contextBlocks.push(`知识库检索:\n${chunks.map((c, idx) => `[${idx + 1}] ${c.title}\n${c.content}`).join('\n\n')}`);
        }
        await insertAndEmit({
          stepType: 'rag_retrieval',
          name: '知识库检索',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(chunks, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - started,
          metadata: JSON.stringify({
            graphNode: 'contextPack',
            contextSources: chunks.map((chunk) => ({ type: 'knowledge', id: chunk.id, kbId: chunk.kbId, title: chunk.title, score: chunk.score })),
            knowledgeBaseIds: kbIds,
            count: chunks.length,
          }),
        });
      } catch (error) {
        await insertAndEmit({
          stepType: 'rag_retrieval',
          name: '知识库检索',
          status: 'failed',
          input: dto.input,
          output: '',
          error: this.errorMessage(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - started,
          metadata: JSON.stringify({ knowledgeBaseIds: kbIds }),
        });
      }
    }
    return contextBlocks;
  }

  private async resolveAgentSkills(userId: string, agent: AgentDefinition) {
    if (agent.source !== 'builtin') return this.skillsService.getAgentSkills(userId, agent.id);
    const skills = await this.skillsService.listForUser(userId);
    const ids = new Set(agent.skillIds);
    return skills.filter((skill) => ids.has(skill.id));
  }

  private async resolveRunnableTools(userId: string, agent: AgentDefinition, approvedToolIds: string[]): Promise<ResolvedRunnableTools> {
    const approved = new Set(approvedToolIds);
    const tools = agent.source === 'builtin'
      ? (await this.toolsService.listForUser(userId)).filter((tool) => agent.toolIds.includes(tool.id))
      : await this.toolsService.getAgentTools(userId, agent.id);
    const allowed: ToolDefinition[] = [];
    const skipped: ResolvedRunnableTools['skipped'] = [];
    for (const tool of tools) {
      if (tool.permissionLevel === 'disabled') {
        skipped.push({ tool, reason: '工具权限为 disabled，后端已禁止调用。', requiresApproval: false });
        continue;
      }
      const risk = this.effectiveToolRisk(tool);
      if (tool.permissionLevel === 'confirm' || risk === 'high') {
        if (approved.has(tool.id) || approved.has(tool.name)) {
          allowed.push(tool);
        } else {
          skipped.push({ tool, reason: '工具需要运行前授权，但本次请求未包含 approvedToolIds。', requiresApproval: true });
        }
        continue;
      }
      allowed.push(tool);
    }
    return { allowed, skipped };
  }

  private effectiveToolRisk(tool: { name: string; riskLevel?: string }): 'low' | 'medium' | 'high' {
    if (tool.riskLevel === 'high' || /runner|python|javascript|code/i.test(tool.name)) return 'high';
    if (tool.riskLevel === 'medium' || /browser|notion|fetch/i.test(tool.name)) return 'medium';
    return 'low';
  }

  private async planNextAgentAction(
    agent: AgentDefinition,
    dto: RunAgentDto,
    contextBlocks: string[],
    observations: string[],
    tools: Array<{ id: string; name: string; displayName: string; description: string; schema: Record<string, unknown> }>,
    delegationDepth: number,
  ): Promise<{ action: AgentPlannerAction; usage: ChatCompletionUsage }> {
    if (tools.length === 0 && delegationDepth >= 1) {
      return { action: { action: 'final', reason: '没有可用工具或委派目标，进入最终回答。' }, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
    }
    const builtinDelegates = delegationDepth >= 1 ? [] : BUILTIN_AGENT_SPECS
      .filter((spec) => spec.key !== agent.builtinKey)
      .map((spec) => ({ key: spec.key, name: spec.name, description: spec.description, tags: spec.tags }));
    const userDelegates = delegationDepth >= 1 ? [] : (await this.listByUser(agent.userId))
      .filter((item) => item.id !== agent.id && item.status === 'active')
      .slice(0, 12)
      .map((item) => ({ id: item.id, name: item.name, description: item.description, model: item.model }));
    const request: ChatCompletionRequest = {
      model: agent.model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            '你是 Agent 执行规划器。只输出 JSON，不要 Markdown，不要解释。',
            'JSON 格式只能是以下之一:',
            '{"action":"tool","toolId":"...","args":{},"reason":"..."}',
            '{"action":"delegate","agentKey":"research|code|data|support|writer|document|knowledge|orchestrator","input":"...","reason":"..."}',
            '{"action":"delegate","agentId":"用户自定义 Agent ID","input":"...","reason":"..."}',
            '{"action":"final","answer":"...","reason":"..."}',
            '当已有观察足够回答时选择 final。不要调用不可用工具。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            agent: { name: agent.name, builtinKey: agent.builtinKey || '', description: agent.description },
            task: dto.input,
            context: contextBlocks.join('\n\n---\n\n').slice(0, 12000),
            observations: observations.slice(-8),
            tools: tools.map((tool) => ({
              toolId: tool.id,
              name: tool.name,
              displayName: tool.displayName,
              description: tool.description,
              schema: tool.schema,
            })),
            delegateAgents: {
              builtin: builtinDelegates,
              user: userDelegates,
            },
          }, null, 2),
        },
      ],
    };
    const completion = await this.chatService.createCompletion(request);
    const usage = this.usageForCompletion(request, completion.usage);
    await this.billingService.chargeForCompletion(agent.userId, request, usage, 'agent', this.providerAuditFromCompletion(completion));
    const content = completion.choices?.[0]?.message?.content ?? '{}';
    return { action: this.sanitizePlannerAction(this.parseJsonRecord(content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? content)), usage };
  }

  private sanitizePlannerAction(raw: Record<string, unknown>): AgentPlannerAction {
    const action = String(raw.action || '').toLowerCase();
    if (action === 'tool') {
      return {
        action: 'tool',
        toolId: typeof raw.toolId === 'string' ? raw.toolId : undefined,
        toolName: typeof raw.toolName === 'string' ? raw.toolName : undefined,
        args: raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args) ? raw.args as Record<string, unknown> : {},
        reason: typeof raw.reason === 'string' ? raw.reason : '',
      };
    }
    if (action === 'delegate') {
      return {
        action: 'delegate',
        agentKey: typeof raw.agentKey === 'string' ? raw.agentKey : undefined,
        agentId: typeof raw.agentId === 'string' ? raw.agentId : undefined,
        input: typeof raw.input === 'string' ? raw.input : undefined,
        reason: typeof raw.reason === 'string' ? raw.reason : '',
      };
    }
    return {
      action: 'final',
      answer: typeof raw.answer === 'string' ? raw.answer : '',
      reason: typeof raw.reason === 'string' ? raw.reason : '',
    };
  }

  private async delegateBuiltinAgent(
    userId: string,
    parentAgent: AgentDefinition,
    dto: RunAgentDto,
    action: Extract<AgentPlannerAction, { action: 'delegate' }>,
    parentRunId: string,
    options: AgentExecutionOptions,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    completeAndEmit: (stepId: number, status: 'succeeded' | 'failed', output: string, error?: string, metadata?: Record<string, unknown>) => Promise<AgentRunStep>,
  ): Promise<{ observation: string; run?: AgentRun }> {
    if (action.agentId) {
      return this.delegateUserAgent(userId, parentAgent, dto, action, parentRunId, options, insertAndEmit, completeAndEmit);
    }
    const spec = getBuiltinAgentSpec(action.agentKey || '');
    if (!spec || (options.delegationDepth ?? 0) >= 1) {
      const error = !spec ? `委派目标不存在: ${action.agentKey || ''}` : '已达到委派深度上限';
      await insertAndEmit({
        stepType: 'delegate_agent',
        name: '委派失败',
        status: 'failed',
        input: JSON.stringify(action, null, 2),
        output: '',
        error,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ parentRunId }),
      });
      return { observation: error };
    }

    const child = await this.buildBuiltinRuntimeAgent(userId, spec, parentAgent.model, parentAgent.knowledgeBaseIds);
    const delegateStep = await insertAndEmit({
      stepType: 'delegate_agent',
      name: `委派给 ${spec.name}`,
      status: 'running',
      input: action.input || dto.input,
      output: JSON.stringify({ agentKey: spec.key, agentName: spec.name, reason: action.reason || '' }, null, 2),
      startedAt: this.databaseService.now(),
      endedAt: null,
      latencyMs: 0,
      metadata: JSON.stringify({ parentRunId, agentKey: spec.key, graphNode: 'delegate' }),
    });
    const run = await this.executeAgentRun(userId, child, {
      ...dto,
      input: action.input || dto.input,
      maxSteps: Math.min(4, dto.maxSteps ?? 4),
    }, () => undefined, {
      emitRunCreated: false,
      delegationDepth: (options.delegationDepth ?? 0) + 1,
      inheritedKnowledgeBaseIds: parentAgent.knowledgeBaseIds,
    });
    const observation = `${spec.name} (${run.status}) runId=${run.id}\n${run.output || run.error}`;
    await completeAndEmit(
      delegateStep.id,
      run.status === 'failed' ? 'failed' : 'succeeded',
      observation.slice(0, 8000),
      run.error,
      {
        parentRunId,
        childRunId: run.id,
        agentKey: spec.key,
        graphNode: 'delegate',
        childStatus: run.status,
      },
    );
    await insertAndEmit({
      stepType: 'delegate_observation',
      name: `${spec.name} 返回`,
      status: run.status,
      input: action.input || dto.input,
      output: observation,
      error: run.error,
      startedAt: this.databaseService.now(),
      endedAt: this.databaseService.now(),
      latencyMs: run.latencyMs,
      metadata: JSON.stringify({ childRunId: run.id, agentKey: spec.key }),
    });
    return { observation: observation.slice(0, 8000), run };
  }

  private async delegateUserAgent(
    userId: string,
    parentAgent: AgentDefinition,
    dto: RunAgentDto,
    action: Extract<AgentPlannerAction, { action: 'delegate' }>,
    parentRunId: string,
    options: AgentExecutionOptions,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    completeAndEmit: (stepId: number, status: 'succeeded' | 'failed', output: string, error?: string, metadata?: Record<string, unknown>) => Promise<AgentRunStep>,
  ): Promise<{ observation: string; run?: AgentRun }> {
    if ((options.delegationDepth ?? 0) >= 1) {
      const error = '已达到委派深度上限';
      await insertAndEmit({
        stepType: 'delegate_agent',
        name: '委派失败',
        status: 'failed',
        input: JSON.stringify(action, null, 2),
        output: '',
        error,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ parentRunId, graphNode: 'delegate', fallbackReason: error }),
      });
      return { observation: error };
    }
    const delegatedAgentId = action.agentId || '';
    if (delegatedAgentId === parentAgent.id) {
      const error = '禁止委派给当前 Agent 自身';
      await insertAndEmit({
        stepType: 'delegate_agent',
        name: '委派失败',
        status: 'failed',
        input: JSON.stringify(action, null, 2),
        output: '',
        error,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ parentRunId, agentId: delegatedAgentId, graphNode: 'delegate', fallbackReason: error }),
      });
      return { observation: error };
    }

    let child: AgentDefinition;
    try {
      child = await this.getById(userId, delegatedAgentId);
    } catch (error) {
      const message = `委派目标不存在: ${action.agentId || ''}`;
      await insertAndEmit({
        stepType: 'delegate_agent',
        name: '委派失败',
        status: 'failed',
        input: JSON.stringify(action, null, 2),
        output: '',
        error: message,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ parentRunId, agentId: delegatedAgentId, graphNode: 'delegate', fallbackReason: this.errorMessage(error) }),
      });
      return { observation: message };
    }
    if (child.status !== 'active') {
      const error = '委派目标 Agent 已归档';
      await insertAndEmit({
        stepType: 'delegate_agent',
        name: '委派失败',
        status: 'failed',
        input: JSON.stringify(action, null, 2),
        output: '',
        error,
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: 0,
        metadata: JSON.stringify({ parentRunId, agentId: child.id, graphNode: 'delegate', fallbackReason: error }),
      });
      return { observation: error };
    }

    const delegateStep = await insertAndEmit({
      stepType: 'delegate_agent',
      name: `委派给 ${child.name}`,
      status: 'running',
      input: action.input || dto.input,
      output: JSON.stringify({ agentId: child.id, agentName: child.name, reason: action.reason || '' }, null, 2),
      startedAt: this.databaseService.now(),
      endedAt: null,
      latencyMs: 0,
      metadata: JSON.stringify({ parentRunId, agentId: child.id, graphNode: 'delegate' }),
    });
    const run = await this.executeAgentRun(userId, child, {
      ...dto,
      input: action.input || dto.input,
      maxSteps: Math.min(4, dto.maxSteps ?? 4),
    }, () => undefined, {
      emitRunCreated: false,
      delegationDepth: (options.delegationDepth ?? 0) + 1,
      inheritedKnowledgeBaseIds: parentAgent.knowledgeBaseIds,
    });
    const observation = `${child.name} (${run.status}) runId=${run.id}\n${run.output || run.error}`;
    await completeAndEmit(
      delegateStep.id,
      run.status === 'failed' ? 'failed' : 'succeeded',
      observation.slice(0, 8000),
      run.error,
      {
        parentRunId,
        childRunId: run.id,
        agentId: child.id,
        graphNode: 'delegate',
        childStatus: run.status,
      },
    );
    await insertAndEmit({
      stepType: 'delegate_observation',
      name: `${child.name} 返回`,
      status: run.status,
      input: action.input || dto.input,
      output: observation,
      error: run.error,
      startedAt: this.databaseService.now(),
      endedAt: this.databaseService.now(),
      latencyMs: run.latencyMs,
      metadata: JSON.stringify({ childRunId: run.id, agentId: child.id, graphNode: 'delegate' }),
    });
    return { observation: observation.slice(0, 8000), run };
  }

  private async generateFinalAgentOutput(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    contextBlocks: string[],
    observations: string[],
    plannerHint: string,
    runId: string,
    emit: EmitAgentRunEvent,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    completeAndEmit: (stepId: number, status: 'succeeded' | 'failed', output: string, error?: string, metadata?: Record<string, unknown>) => Promise<AgentRunStep>,
    usageTotal: ChatCompletionUsage,
    tools: ToolDefinition[] = [],
    maxSteps = 6,
  ): Promise<string> {
    const llmStep = await insertAndEmit({
      stepType: 'llm_completion',
      name: tools.length > 0 ? 'Harness 最终回答' : '最终回答',
      status: 'running',
      input: dto.input,
      output: '',
      startedAt: this.databaseService.now(),
      endedAt: null,
      latencyMs: 0,
      metadata: JSON.stringify({ model: agent.model, observations: observations.length, toolUseHarness: tools.length > 0 }),
    });
    const request = this.buildFinalChatRequest(agent, dto, contextBlocks, observations, plannerHint);
    if (tools.length > 0) {
      try {
        const output = await this.runToolUseHarness(userId, agent, dto, runId, request, tools, maxSteps, insertAndEmit, usageTotal);
        emit({ type: 'llm_delta', runId, delta: output, output });
        const updatedUser = await this.billingService.getBalance(userId);
        await completeAndEmit(llmStep.id, 'succeeded', output, '', {
          creditBalance: updatedUser.credits,
          toolUseHarness: true,
          toolCount: tools.length,
        });
        return output;
      } catch (error) {
        await completeAndEmit(llmStep.id, 'failed', '', this.errorMessage(error), {
          toolUseHarness: true,
          fallback: true,
          toolCount: tools.length,
        });
        const fallbackHint = [plannerHint, `Function calling harness 不可用，已降级普通回答：${this.errorMessage(error)}`].filter(Boolean).join('\n');
        return this.generateFinalAgentOutput(
          userId,
          agent,
          dto,
          contextBlocks,
          observations,
          fallbackHint,
          runId,
          emit,
          insertAndEmit,
          completeAndEmit,
          usageTotal,
          [],
          maxSteps,
        );
      }
    }
    const output = await this.collectCompletionStream(request, (delta, full) => {
      emit({ type: 'llm_delta', runId, delta, output: full });
    });
    const usage = this.billingService.reserveForStream(userId, request);
    usage.completion_tokens = Math.max(1, Math.ceil(output.length / 4));
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    const updatedUser = await this.billingService.chargeForCompletion(userId, request, usage, 'agent');
    this.addUsage(usageTotal, usage);
    await completeAndEmit(llmStep.id, 'succeeded', output, '', { usage, creditBalance: updatedUser.credits, streamed: true });
    return output;
  }

  private buildFinalChatRequest(agent: AgentDefinition, dto: RunAgentDto, contextBlocks: string[], observations: string[], plannerHint: string): ChatCompletionRequest {
    const messages: ChatCompletionRequest['messages'] = [];
    const systemBlocks = [
      agent.systemPrompt.trim(),
      contextBlocks.join('\n\n---\n\n'),
      observations.length ? `执行观察:\n${observations.map((item, index) => `[${index + 1}] ${item}`).join('\n\n')}` : '',
      plannerHint ? `规划提示:\n${plannerHint}` : '',
    ].filter(Boolean);
    if (systemBlocks.length > 0) messages.push({ role: 'system', content: systemBlocks.join('\n\n---\n\n') });
    for (const msg of dto.messages ?? []) {
      messages.push({ role: msg.role, content: msg.content });
    }
    if (dto.imageUrls?.length) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: dto.input },
          ...dto.imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ],
      });
    } else {
      messages.push({ role: 'user', content: dto.input });
    }
    return {
      model: agent.model,
      messages,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    };
  }

  private async runToolUseHarness(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    runId: string,
    baseRequest: ChatCompletionRequest,
    tools: ToolDefinition[],
    maxSteps: number,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    usageTotal: ChatCompletionUsage,
  ): Promise<string> {
    const toolDefinitions = tools.map((tool) => this.toolDefinitionToChatTool(tool));
    const toolMap = new Map<string, ToolDefinition>();
    for (const tool of tools) {
      toolMap.set(tool.name, tool);
      toolMap.set(tool.id, tool);
    }

    const messages: ChatMessage[] = [...baseRequest.messages];
    const rounds = Math.max(1, Math.min(10, maxSteps || 6));

    for (let round = 1; round <= rounds; round += 1) {
      const request: ChatCompletionRequest = {
        ...baseRequest,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        stream: false,
      };
      const completion = await this.chatService.createCompletion(request);
      const usage = this.usageForCompletion(request, completion.usage);
      await this.billingService.chargeForCompletion(userId, request, usage, 'agent', this.providerAuditFromCompletion(completion));
      this.addUsage(usageTotal, usage);

      const message = completion.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];
      const content = message?.content ?? '';
      if (toolCalls.length === 0) {
        return content || '模型未返回工具调用或文本内容。';
      }

      messages.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const result = await this.executeHarnessToolCall(userId, agent, runId, call, toolMap, round, insertAndEmit);
        messages.push({
          role: 'tool',
          name: result.tool?.name || call.function.name,
          tool_call_id: call.id,
          content: result.output || result.error || '',
        });
      }
    }

    const finalRequest: ChatCompletionRequest = {
      ...baseRequest,
      messages: [
        ...messages,
        {
          role: 'system',
          content: '已达到工具调用最大轮数。请基于已有工具结果输出最终答复；如果仍缺信息，请说明限制。',
        },
      ],
      tools: undefined,
      tool_choice: 'none',
      stream: false,
    };
    const completion = await this.chatService.createCompletion(finalRequest);
    const usage = this.usageForCompletion(finalRequest, completion.usage);
    await this.billingService.chargeForCompletion(userId, finalRequest, usage, 'agent', this.providerAuditFromCompletion(completion));
    this.addUsage(usageTotal, usage);
    return completion.choices?.[0]?.message?.content || '已达到最大工具调用轮数，但模型未返回最终文本。';
  }

  private toolDefinitionToChatTool(tool: ToolDefinition): ChatToolDefinition {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || tool.displayName || tool.name,
        parameters: this.normalizeToolParameters(tool.schema),
      },
    };
  }

  private normalizeToolParameters(schema: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || Object.keys(schema).length === 0) {
      return { type: 'object', properties: {} };
    }
    return schema;
  }

  private async executeHarnessToolCall(
    userId: string,
    agent: AgentDefinition,
    runId: string,
    call: HarnessToolCall,
    toolMap: Map<string, ToolDefinition>,
    round: number,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
  ): Promise<HarnessToolResult> {
    const functionName = call.function?.name || '';
    const tool = toolMap.get(functionName) ?? null;
    const parsedArgs = this.parseToolCallArguments(call.function?.arguments ?? '{}');
    const startedAt = this.databaseService.now();
    const started = Date.now();

    if (!tool) {
      const error = `工具不可用或未授权: ${functionName || 'unknown'}`;
      await this.recordHarnessToolCall(call, null, {}, 'failed', '', error, round, startedAt, 0, insertAndEmit);
      return { call, tool: null, args: {}, output: '', error, status: 'failed' };
    }

    if (parsedArgs.error) {
      await this.recordHarnessToolCall(call, tool, {}, 'failed', '', parsedArgs.error, round, startedAt, 0, insertAndEmit);
      return { call, tool, args: {}, output: '', error: parsedArgs.error, status: 'failed' };
    }

    const args = parsedArgs.args;
    const result = await this.toolsService.invoke(userId, tool.id, args, { agentId: agent.id, runId });
    await this.recordHarnessToolCall(
      call,
      tool,
      args,
      result.status,
      result.output,
      result.error,
      round,
      startedAt,
      Date.now() - started,
      insertAndEmit,
    );
    return { call, tool, args, output: result.output, error: result.error, status: result.status };
  }

  private parseToolCallArguments(raw: string): { args: Record<string, unknown>; error?: string } {
    if (!raw.trim()) return { args: {} };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { args: {}, error: '工具参数必须是 JSON object' };
      }
      return { args: parsed as Record<string, unknown> };
    } catch (error) {
      return { args: {}, error: `工具参数 JSON 解析失败: ${this.errorMessage(error)}` };
    }
  }

  private async recordHarnessToolCall(
    call: HarnessToolCall,
    tool: ToolDefinition | null,
    args: Record<string, unknown>,
    status: 'succeeded' | 'failed',
    output: string,
    error: string,
    round: number,
    startedAt: string,
    latencyMs: number,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
  ): Promise<void> {
    const toolName = tool?.name || call.function?.name || 'unknown';
    await insertAndEmit({
      stepType: 'tool_call',
      name: `工具调用：${tool?.displayName || toolName}`,
      status,
      input: JSON.stringify(args, null, 2),
      output,
      error,
      startedAt,
      endedAt: this.databaseService.now(),
      latencyMs,
      metadata: JSON.stringify({
        toolId: tool?.id || '',
        toolName,
        functionCallId: call.id,
        round,
        graphNode: 'harness_tool',
        toolUseHarness: true,
        fallbackReason: status === 'failed' ? error : '',
      }),
    });
    const observation = `${toolName} ${status}: ${output || error}`;
    await insertAndEmit({
      stepType: 'observation',
      name: '工具观察',
      status,
      input: toolName,
      output: observation,
      error,
      startedAt: this.databaseService.now(),
      endedAt: this.databaseService.now(),
      latencyMs: 0,
      metadata: JSON.stringify({
        round,
        graphNode: 'harness_observe',
        functionCallId: call.id,
        toolUseHarness: true,
      }),
    });
  }

  private async applySmartMemory(
    userId: string,
    agent: AgentDefinition,
    dto: RunAgentDto,
    output: string,
    runId: string,
    insertAndEmit: (step: AgentRunStepInput) => Promise<AgentRunStep>,
    usageTotal: ChatCompletionUsage,
  ): Promise<void> {
    if (!agent.memoryEnabled) return;
    const started = Date.now();
    try {
      const actions = await this.extractMemoryActions(userId, agent, dto.input, output, usageTotal);
      await insertAndEmit({
        stepType: 'memory_extract',
        name: '智能记忆抽取',
        status: 'succeeded',
        input: dto.input,
        output: JSON.stringify(actions, null, 2),
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: Date.now() - started,
        metadata: JSON.stringify({ runId, count: actions.length }),
      });
      const results = [];
      for (const action of actions.slice(0, 6)) {
        if (action.operation === 'forget') {
          const removed = await this.memoryService.forgetMatching(userId, agent.id, action.content, 5);
          results.push({ operation: 'forget', content: action.content, removed: removed.map((item) => item.id) });
        } else if (action.content.trim()) {
          const result = await this.memoryService.upsertExtracted(userId, agent.id, action);
          results.push({ operation: result.action, memoryId: result.memory.id, content: result.memory.content, memoryType: result.memory.memoryType });
        }
      }
      if (results.length > 0) {
        await insertAndEmit({
          stepType: 'memory_update',
          name: '长期记忆更新',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(results, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: 0,
          metadata: JSON.stringify({ runId }),
        });
      }
    } catch (error) {
      await insertAndEmit({
        stepType: 'memory_extract',
        name: '智能记忆抽取',
        status: 'failed',
        input: dto.input,
        output: '',
        error: this.errorMessage(error),
        startedAt: this.databaseService.now(),
        endedAt: this.databaseService.now(),
        latencyMs: Date.now() - started,
        metadata: JSON.stringify({ runId }),
      });
    }
  }

  private async extractMemoryActions(
    userId: string,
    agent: AgentDefinition,
    input: string,
    output: string,
    usageTotal: ChatCompletionUsage,
  ): Promise<Array<{ operation: 'upsert' | 'forget'; content: string; memoryType?: string; importance?: number; namespace?: string; confidence?: number; reason?: string }>> {
    const heuristic = this.heuristicMemoryActions(input);
    const request: ChatCompletionRequest = {
      model: agent.model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: [
            '你是长期记忆抽取器。只输出 JSON，不要 Markdown。',
            '只记录未来仍有用的用户事实、偏好、稳定约束、工作流程，或者明确遗忘请求。',
            'JSON 格式: {"items":[{"operation":"upsert|forget","content":"...","memoryType":"fact|preference|procedure|episode","importance":1-5,"confidence":0-1,"reason":"..."}]}',
            '不要把本次普通任务摘要写入记忆。',
          ].join('\n'),
        },
        { role: 'user', content: JSON.stringify({ input, output: output.slice(0, 3000) }, null, 2) },
      ],
    };
    try {
      const completion = await this.chatService.createCompletion(request);
      const usage = this.usageForCompletion(request, completion.usage);
      await this.billingService.chargeForCompletion(userId, request, usage, 'agent', this.providerAuditFromCompletion(completion));
      this.addUsage(usageTotal, usage);
      const parsed = this.parseJsonRecord(completion.choices?.[0]?.message?.content ?? '{}');
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const llmItems = items
        .filter((item) => item && typeof item === 'object')
        .map((item) => item as Record<string, unknown>)
        .filter((item) => item.operation === 'upsert' || item.operation === 'forget')
        .map((item) => ({
          operation: item.operation as 'upsert' | 'forget',
          content: String(item.content || '').slice(0, 1000),
          memoryType: String(item.memoryType || 'fact'),
          importance: Math.max(1, Math.min(5, Number(item.importance ?? 3))),
          namespace: 'agent_profile',
          confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.6))),
          reason: String(item.reason || ''),
        }))
        .filter((item) => item.content.trim() && (item.confidence ?? 0) >= 0.45);
      return llmItems.length > 0 ? llmItems : heuristic;
    } catch {
      return heuristic;
    }
  }

  private heuristicMemoryActions(input: string): Array<{ operation: 'upsert' | 'forget'; content: string; memoryType?: string; importance?: number; namespace?: string; confidence?: number; reason?: string }> {
    const forget = input.match(/(?:忘记|删除记忆|不要记住|不再记住|forget)([\s\S]{0,500})/i);
    if (forget) {
      return [{ operation: 'forget', content: (forget[1] || input).trim(), confidence: 0.7, reason: '用户明确要求遗忘' }];
    }
    if (/(记住|以后|我的偏好|我喜欢|我不喜欢|我叫|我是|remember)/i.test(input)) {
      return [{ operation: 'upsert', content: input.slice(0, 800), memoryType: 'preference', importance: 4, namespace: 'agent_profile', confidence: 0.65, reason: '用户表达了长期偏好或身份信息' }];
    }
    return [];
  }

  private addUsage(total: ChatCompletionUsage, usage: ChatCompletionUsage): void {
    total.prompt_tokens += usage.prompt_tokens;
    total.completion_tokens += usage.completion_tokens;
    total.total_tokens += usage.total_tokens;
  }

  private usageForCompletion(request: ChatCompletionRequest, usage?: ChatCompletionUsage): ChatCompletionUsage {
    if (usage) return usage;
    const prompt = Math.max(1, Math.ceil(JSON.stringify(request.messages).length / 4));
    const completion = Math.min(request.max_tokens ?? 256, 512);
    return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
  }

  private providerAuditFromCompletion(completion: ChatCompletionResponse): BillingAuditInfo | undefined {
    const audit = (completion as ChatCompletionResponse & { _providerKeyAudit?: ProviderKeyAuditInfo })._providerKeyAudit;
    if (!audit) return undefined;
    return {
      provider: audit.provider,
      providerKeyId: audit.keyId,
      providerKeyName: audit.keyName,
      providerKeyPrefix: audit.keyPrefix,
      providerKeySource: audit.keySource,
    };
  }

  async getRun(userId: string, runId: string): Promise<AgentRun> {
    const row = await this.databaseService.connection.prepare(
      `SELECT
         id,
         agent_id as agentId,
         user_id as userId,
         status,
         input,
         output,
         model,
         error,
         prompt_tokens as promptTokens,
         completion_tokens as completionTokens,
         total_tokens as totalTokens,
         latency_ms as latencyMs,
         created_at as createdAt,
         completed_at as completedAt
       FROM agent_runs
       WHERE id = ? AND user_id = ?`,
    ).get(runId, userId) as unknown as Omit<AgentRun, 'steps'> | undefined;
    if (!row) throw new NotFoundException('Agent 运行记录不存在');

    const steps = await this.databaseService.connection.prepare(
      `SELECT
         id,
         run_id as runId,
         step_type as stepType,
         name,
         status,
         input,
         output,
         error,
         started_at as startedAt,
         ended_at as endedAt,
         latency_ms as latencyMs,
         metadata
       FROM agent_run_steps
       WHERE run_id = ? AND user_id = ?
       ORDER BY id ASC`,
    ).all(runId, userId) as unknown as AgentRunStep[];

    return {
      ...row,
      promptTokens: Number(row.promptTokens),
      completionTokens: Number(row.completionTokens),
      totalTokens: Number(row.totalTokens),
      latencyMs: Number(row.latencyMs),
      steps: steps.map((step) => ({
        ...step,
        id: Number(step.id),
        latencyMs: Number(step.latencyMs),
        endedAt: step.endedAt || null,
      })),
    };
  }

  async listRuns(userId: string, agentId: string): Promise<AgentRun[]> {
    await this.getById(userId, agentId);
    const rows = await this.databaseService.connection.prepare(
      `SELECT id FROM agent_runs
       WHERE agent_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    ).all(agentId, userId) as Array<{ id: string }>;

    const runs: AgentRun[] = [];
    for (const row of rows) {
      runs.push(await this.getRun(userId, row.id));
    }
    return runs;
  }

  async evaluateRun(
    userId: string,
    runId: string,
    options?: EvaluateAgentRunDto,
  ): Promise<AgentEvaluation> {
    const run = await this.getRun(userId, runId);
    const evaluation = await this.scoreRunWithJudge(run, options);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_evaluations
        (id, agent_id, run_id, user_id, score, grade, summary, rubric_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      run.agentId,
      run.id,
      userId,
      evaluation.score,
      evaluation.grade,
      evaluation.summary,
      JSON.stringify(evaluation.rubric),
      now,
    );
    return {
      id,
      agentId: run.agentId,
      runId: run.id,
      userId,
      score: evaluation.score,
      grade: evaluation.grade,
      summary: evaluation.summary,
      rubric: evaluation.rubric,
      createdAt: now,
    };
  }

  async listEvaluations(userId: string, agentId: string): Promise<AgentEvaluation[]> {
    await this.getById(userId, agentId);
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, agent_id as agentId, run_id as runId, user_id as userId,
              score, grade, summary, rubric_json as rubricJson, created_at as createdAt
       FROM agent_evaluations
       WHERE user_id = ? AND agent_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    ).all(userId, agentId) as Array<{
      id: string;
      agentId: string;
      runId: string;
      userId: string;
      score: number | string;
      grade: AgentEvaluation['grade'];
      summary: string;
      rubricJson: string;
      createdAt: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      runId: row.runId,
      userId: row.userId,
      score: Number(row.score),
      grade: row.grade,
      summary: row.summary,
      rubric: this.parseJsonRecord(row.rubricJson),
      createdAt: row.createdAt,
    }));
  }

  async getStats(userId: string, agentId: string): Promise<AgentRunStats> {
    await this.getById(userId, agentId);
    const runStats = await this.databaseService.connection.prepare(
      `SELECT
         COUNT(*) as totalRuns,
         SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeededRuns,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedRuns,
         AVG(latency_ms) as averageLatencyMs,
         AVG(total_tokens) as averageTokens
       FROM agent_runs
       WHERE user_id = ? AND agent_id = ?`,
    ).get(userId, agentId) as {
      totalRuns?: number | string;
      succeededRuns?: number | string | null;
      failedRuns?: number | string | null;
      averageLatencyMs?: number | string | null;
      averageTokens?: number | string | null;
    } | undefined;

    const evalStats = await this.databaseService.connection.prepare(
      `SELECT COUNT(*) as evaluatedRuns, AVG(score) as averageScore
       FROM agent_evaluations
       WHERE user_id = ? AND agent_id = ?`,
    ).get(userId, agentId) as {
      evaluatedRuns?: number | string;
      averageScore?: number | string | null;
    } | undefined;

    const totalRuns = Number(runStats?.totalRuns ?? 0);
    const succeededRuns = Number(runStats?.succeededRuns ?? 0);
    const failedRuns = Number(runStats?.failedRuns ?? 0);
    return {
      agentId,
      totalRuns,
      succeededRuns,
      failedRuns,
      successRate: totalRuns > 0 ? Number((succeededRuns / totalRuns).toFixed(4)) : 0,
      averageLatencyMs: Math.round(Number(runStats?.averageLatencyMs ?? 0)),
      averageTokens: Math.round(Number(runStats?.averageTokens ?? 0)),
      averageScore: Number(Number(evalStats?.averageScore ?? 0).toFixed(2)),
      evaluatedRuns: Number(evalStats?.evaluatedRuns ?? 0),
    };
  }

  async generateImprovementSuggestions(
    userId: string,
    agentId: string,
    dto: GenerateAgentImprovementSuggestionsDto = {},
  ): Promise<Record<string, unknown>> {
    const agent = await this.getById(userId, agentId);
    const limit = Math.max(1, Math.min(20, Number(dto.recentRunLimit ?? 8)));
    const runs = (await this.listRuns(userId, agentId)).slice(0, limit);
    const evaluations = await this.listEvaluations(userId, agentId);
    const stats = await this.getStats(userId, agentId);
    const failedSteps = runs.flatMap((run) => run.steps
      .filter((step) => step.status === 'failed' || step.error)
      .map((step) => ({
        runId: run.id,
        stepType: step.stepType,
        name: step.name,
        error: step.error,
        metadata: this.parseJsonRecord(step.metadata),
      }))).slice(0, 20);
    const slowSteps = runs.flatMap((run) => run.steps
      .filter((step) => step.latencyMs >= 5000)
      .map((step) => ({ runId: run.id, stepType: step.stepType, name: step.name, latencyMs: step.latencyMs }))).slice(0, 20);
    const lowEvaluations = evaluations.filter((evaluation) => evaluation.score < 70).slice(0, 10);
    const heuristic = this.heuristicAgentImprovementSuggestions(agent, runs, failedSteps, slowSteps, lowEvaluations, stats);

    if (dto.judgeModel?.trim() || agent.model) {
      try {
        const request: ChatCompletionRequest = {
          model: dto.judgeModel?.trim() || agent.model,
          temperature: 0.2,
          max_tokens: 900,
          messages: [
            {
              role: 'system',
              content: [
                '你是 Agent 运行诊断与优化顾问。只输出 JSON，不要 Markdown。',
                'JSON 字段: summary, promptSuggestions, capabilitySuggestions, testSuggestions, riskNotes。',
                '建议只生成草案，不要声称已经修改 Agent。',
              ].join('\n'),
            },
            {
              role: 'user',
              content: JSON.stringify({
                agent: {
                  name: agent.name,
                  description: agent.description,
                  model: agent.model,
                  toolCount: agent.toolIds.length,
                  knowledgeBaseCount: agent.knowledgeBaseIds.length,
                  skillCount: agent.skillIds.length,
                  memoryEnabled: agent.memoryEnabled,
                },
                stats,
                recentRuns: runs.map((run) => ({
                  id: run.id,
                  status: run.status,
                  latencyMs: run.latencyMs,
                  totalTokens: run.totalTokens,
                  error: run.error,
                  input: run.input.slice(0, 500),
                  outputPreview: run.output.slice(0, 700),
                  failedSteps: run.steps.filter((step) => step.status === 'failed').map((step) => ({ type: step.stepType, name: step.name, error: step.error })),
                })),
                lowEvaluations,
                heuristic,
              }, null, 2),
            },
          ],
        };
        const completion = await this.chatService.createCompletion(request);
        const usage = this.usageForCompletion(request, completion.usage);
        await this.billingService.chargeForCompletion(userId, request, usage, 'agent', this.providerAuditFromCompletion(completion));
        const parsed = this.parseJsonRecord((completion.choices?.[0]?.message?.content ?? '{}').match(/```json\s*([\s\S]*?)```/i)?.[1] ?? completion.choices?.[0]?.message?.content ?? '{}');
        return this.normalizeAgentImprovementSuggestions(parsed, heuristic, { agentId, generatedAt: this.databaseService.now(), usage });
      } catch {
        return this.normalizeAgentImprovementSuggestions({}, heuristic, { agentId, generatedAt: this.databaseService.now(), fallback: true });
      }
    }
    return this.normalizeAgentImprovementSuggestions({}, heuristic, { agentId, generatedAt: this.databaseService.now(), fallback: true });
  }

  private heuristicAgentImprovementSuggestions(
    agent: AgentDefinition,
    runs: AgentRun[],
    failedSteps: Array<Record<string, unknown>>,
    slowSteps: Array<Record<string, unknown>>,
    lowEvaluations: AgentEvaluation[],
    stats: AgentRunStats,
  ): Record<string, string[]> {
    const promptSuggestions: string[] = [];
    const capabilitySuggestions: string[] = [];
    const testSuggestions: string[] = [];
    const riskNotes: string[] = [];
    if (failedSteps.length > 0) {
      promptSuggestions.push('在系统提示词中加入失败兜底策略：工具不可用时说明限制、提供替代步骤并继续完成可回答部分。');
      capabilitySuggestions.push('检查失败步骤关联的工具权限、输入 schema 和超时设置。');
    }
    if (slowSteps.length > 0 || stats.averageLatencyMs > 15000) {
      promptSuggestions.push('要求 Agent 先判断是否真的需要工具/委派，避免不必要的多轮规划。');
      riskNotes.push('最近运行存在较慢步骤，建议关注工具耗时、知识库检索量和 maxSteps。');
    }
    if (stats.failedRuns > 0) {
      testSuggestions.push('为失败输入补充回归测试用例，并记录期望输出与错误处理标准。');
    }
    if (lowEvaluations.length > 0) {
      promptSuggestions.push('补充输出格式、验收标准和“不确定时如何回答”的规则。');
      testSuggestions.push('将低分评测样例加入测试集，用于版本发布前对比。');
    }
    if (agent.toolIds.length === 0 && runs.some((run) => /计算|查询|检索|代码|文件|网页|tool/i.test(run.input))) {
      capabilitySuggestions.push('当前未绑定工具，但最近任务可能需要外部能力；建议绑定合适工具或明确禁止工具依赖。');
    }
    if (agent.knowledgeBaseIds.length === 0 && runs.some((run) => /知识库|文档|资料|手册|政策/i.test(run.input))) {
      capabilitySuggestions.push('最近任务提到资料或文档，建议绑定相关知识库以减少幻觉。');
    }
    if (!agent.memoryEnabled) {
      capabilitySuggestions.push('若此 Agent 面向长期用户或连续任务，建议开启记忆并设置记忆边界。');
    }
    return {
      promptSuggestions: promptSuggestions.length ? promptSuggestions : ['当前提示词可补充任务拆解、输出格式和失败兜底规则。'],
      capabilitySuggestions: capabilitySuggestions.length ? capabilitySuggestions : ['当前能力配置暂无明显缺口；建议根据高频任务持续补充工具、知识库或 Skill。'],
      testSuggestions: testSuggestions.length ? testSuggestions : ['为高频任务、边界输入、工具失败和知识库缺失场景建立测试用例。'],
      riskNotes: riskNotes.length ? riskNotes : ['建议上线前通过测试集比较当前版本与候选版本。'],
    };
  }

  private normalizeAgentImprovementSuggestions(
    parsed: Record<string, unknown>,
    heuristic: Record<string, string[]>,
    meta: Record<string, unknown>,
  ): Record<string, unknown> {
    const list = (key: string) => Array.isArray(parsed[key])
      ? (parsed[key] as unknown[]).map(String).filter(Boolean).slice(0, 8)
      : heuristic[key] ?? [];
    return {
      ...meta,
      summary: String(parsed.summary || '已根据最近运行、失败步骤和评测结果生成优化建议草案。'),
      promptSuggestions: list('promptSuggestions'),
      capabilitySuggestions: list('capabilitySuggestions'),
      testSuggestions: list('testSuggestions'),
      riskNotes: list('riskNotes'),
    };
  }

  async createVersion(userId: string, agentId: string, dto: CreateAgentVersionDto = {}): Promise<Record<string, unknown>> {
    const agent = await this.getById(userId, agentId);
    const row = await this.databaseService.connection.prepare(
      'SELECT COALESCE(MAX(version_number), 0) + 1 as nextVersion FROM agent_versions WHERE agent_id = ? AND user_id = ?',
    ).get(agentId, userId) as { nextVersion?: number | string } | undefined;
    const versionNumber = Number(row?.nextVersion ?? 1);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_versions (id, agent_id, user_id, version_number, label, snapshot_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      agentId,
      userId,
      versionNumber,
      dto.label?.trim() || `v${versionNumber}`,
      JSON.stringify(agent),
      now,
    );
    return { id, agentId, userId, versionNumber, label: dto.label?.trim() || `v${versionNumber}`, snapshot: agent, createdAt: now };
  }

  async listVersions(userId: string, agentId: string): Promise<Array<Record<string, unknown>>> {
    await this.getById(userId, agentId);
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, agent_id as agentId, user_id as userId, version_number as versionNumber,
              label, snapshot_json as snapshotJson, created_at as createdAt
       FROM agent_versions
       WHERE agent_id = ? AND user_id = ?
       ORDER BY version_number DESC`,
    ).all(agentId, userId) as Array<{ id: string; agentId: string; userId: string; versionNumber: number | string; label: string; snapshotJson: string; createdAt: string }>;
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      userId: row.userId,
      versionNumber: Number(row.versionNumber),
      label: row.label,
      snapshot: this.parseJsonRecord(row.snapshotJson),
      createdAt: row.createdAt,
    }));
  }

  async restoreVersion(userId: string, agentId: string, versionId: string): Promise<AgentDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT snapshot_json as snapshotJson FROM agent_versions
       WHERE id = ? AND agent_id = ? AND user_id = ?`,
    ).get(versionId, agentId, userId) as { snapshotJson: string } | undefined;
    if (!row) throw new NotFoundException('Agent 版本不存在');
    const snapshot = this.parseJsonRecord(row.snapshotJson) as Partial<AgentDefinition>;
    const restored = await this.update(userId, agentId, {
      name: snapshot.name,
      description: snapshot.description,
      model: snapshot.model,
      systemPrompt: snapshot.systemPrompt,
      temperature: snapshot.temperature,
      maxTokens: snapshot.maxTokens,
      memoryEnabled: snapshot.memoryEnabled,
      status: snapshot.status,
      toolIds: snapshot.toolIds,
      knowledgeBaseIds: snapshot.knowledgeBaseIds,
      skillIds: snapshot.skillIds,
    });
    return restored;
  }

  async createTestSuite(userId: string, agentId: string, dto: CreateAgentTestSuiteDto): Promise<Record<string, unknown>> {
    await this.getById(userId, agentId);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_test_suites (id, agent_id, user_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, agentId, userId, dto.name.trim(), dto.description?.trim() ?? '', now, now);
    return { id, agentId, userId, name: dto.name.trim(), description: dto.description?.trim() ?? '', caseCount: 0, createdAt: now, updatedAt: now };
  }

  async listTestSuites(userId: string, agentId: string): Promise<Array<Record<string, unknown>>> {
    await this.getById(userId, agentId);
    const rows = await this.databaseService.connection.prepare(
      `SELECT s.id, s.agent_id as agentId, s.user_id as userId, s.name, s.description,
              s.created_at as createdAt, s.updated_at as updatedAt,
              COUNT(c.id) as caseCount
       FROM agent_test_suites s
       LEFT JOIN agent_test_cases c ON c.suite_id = s.id
       WHERE s.agent_id = ? AND s.user_id = ? AND s.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY s.updated_at DESC`,
    ).all(agentId, userId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ ...row, caseCount: Number(row.caseCount ?? 0) }));
  }

  async addTestCase(userId: string, suiteId: string, dto: CreateAgentTestCaseDto): Promise<Record<string, unknown>> {
    const suite = await this.getTestSuiteRow(userId, suiteId);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_test_cases
        (id, suite_id, agent_id, user_id, name, input, expected_output, rubric, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      suiteId,
      suite.agentId,
      userId,
      dto.name.trim(),
      dto.input,
      dto.expectedOutput?.trim() ?? '',
      dto.rubric?.trim() ?? '',
      now,
      now,
    );
    return { id, suiteId, agentId: suite.agentId, name: dto.name.trim(), input: dto.input, expectedOutput: dto.expectedOutput ?? '', rubric: dto.rubric ?? '', createdAt: now, updatedAt: now };
  }

  async listTestCases(userId: string, suiteId: string): Promise<Array<Record<string, unknown>>> {
    await this.getTestSuiteRow(userId, suiteId);
    return await this.databaseService.connection.prepare(
      `SELECT id, suite_id as suiteId, agent_id as agentId, name, input,
              expected_output as expectedOutput, rubric, created_at as createdAt, updated_at as updatedAt
       FROM agent_test_cases
       WHERE suite_id = ? AND user_id = ?
       ORDER BY created_at ASC`,
    ).all(suiteId, userId) as Array<Record<string, unknown>>;
  }

  async runTestSuite(userId: string, suiteId: string, options: RunAgentTestSuiteDto = {}): Promise<Record<string, unknown>> {
    const suite = await this.getTestSuiteRow(userId, suiteId);
    const cases = await this.listTestCases(userId, suiteId);
    if (cases.length === 0) throw new BadRequestException('测试集没有测试用例');
    const runId = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_test_runs
        (id, suite_id, agent_id, user_id, status, summary_json, case_results_json, created_at)
       VALUES (?, ?, ?, ?, 'running', '{}', '[]', ?)`,
    ).run(runId, suiteId, suite.agentId, userId, now);

    const results: Array<Record<string, unknown>> = [];
    for (const testCase of cases) {
      const run = await this.run(userId, suite.agentId, { input: String(testCase.input) });
      const evaluation = await this.evaluateRun(userId, run.id, {
        expectedOutput: String(testCase.expectedOutput || ''),
        rubric: String(testCase.rubric || ''),
        judgeModel: options.judgeModel,
        mode: options.evaluationMode ?? 'hybrid',
      });
      results.push({ caseId: testCase.id, runId: run.id, status: run.status, score: evaluation.score, grade: evaluation.grade, summary: evaluation.summary });
    }
    const averageScore = results.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / results.length;
    const summary = {
      total: results.length,
      passed: results.filter((item) => Number(item.score ?? 0) >= 70).length,
      failed: results.filter((item) => Number(item.score ?? 0) < 70).length,
      averageScore: Number(averageScore.toFixed(2)),
    };
    await this.databaseService.connection.prepare(
      `UPDATE agent_test_runs SET status = 'succeeded', summary_json = ?, case_results_json = ?, completed_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(JSON.stringify(summary), JSON.stringify(results), this.databaseService.now(), runId, userId);
    return { id: runId, suiteId, agentId: suite.agentId, status: 'succeeded', summary, caseResults: results, createdAt: now, completedAt: this.databaseService.now() };
  }

  async listTestRuns(userId: string, suiteId: string): Promise<Array<Record<string, unknown>>> {
    await this.getTestSuiteRow(userId, suiteId);
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, suite_id as suiteId, agent_id as agentId, user_id as userId,
              status, summary_json as summaryJson, case_results_json as caseResultsJson,
              created_at as createdAt, completed_at as completedAt
       FROM agent_test_runs
       WHERE suite_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
    ).all(suiteId, userId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapTestRunRow(row));
  }

  async getTestRun(userId: string, runId: string): Promise<Record<string, unknown>> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, suite_id as suiteId, agent_id as agentId, user_id as userId,
              status, summary_json as summaryJson, case_results_json as caseResultsJson,
              created_at as createdAt, completed_at as completedAt
       FROM agent_test_runs
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
    ).get(runId, userId) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException('Agent 测试运行不存在');
    return this.mapTestRunRow(row);
  }

  private extractGeneratedAgentSpec(content: string, requirement: string): {
    name: string;
    description: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    toolNames: string[];
    skillNames: string[];
    memoryEnabled: boolean;
  } {
    const raw = content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? content;
    try {
      const parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
      return {
        name: String(parsed.name || '自动生成 Agent').slice(0, 80),
        description: String(parsed.description || requirement).slice(0, 500),
        systemPrompt: String(parsed.systemPrompt || `你是为以下需求创建的任务型 Agent:\n${requirement}`).slice(0, 12000),
        temperature: Number(parsed.temperature ?? 0.4),
        maxTokens: Number(parsed.maxTokens ?? 2048),
        toolNames: Array.isArray(parsed.toolNames) ? parsed.toolNames.map(String) : [],
        skillNames: Array.isArray(parsed.skillNames) ? parsed.skillNames.map(String) : [],
        memoryEnabled: parsed.memoryEnabled !== false,
      };
    } catch {
      return {
        name: '自动生成 Agent',
        description: requirement.slice(0, 500),
        systemPrompt: `你是一个根据用户需求自动生成的任务型 Agent。\n需求:\n${requirement}\n请主动规划步骤、使用可用工具和知识，并输出可执行结果。`,
        temperature: 0.4,
        maxTokens: 2048,
        toolNames: ['calculator', 'text_stats', 'current_time'],
        skillNames: ['Workflow Orchestrator'],
        memoryEnabled: true,
      };
    }
  }

  private async getTestSuiteRow(userId: string, suiteId: string): Promise<{ id: string; agentId: string }> {
    const suite = await this.databaseService.connection.prepare(
      `SELECT id, agent_id as agentId FROM agent_test_suites
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(suiteId, userId) as { id: string; agentId: string } | undefined;
    if (!suite) throw new NotFoundException('Agent 测试集不存在');
    return suite;
  }

  private mapTestRunRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: String(row.id),
      suiteId: String(row.suiteId),
      agentId: String(row.agentId),
      userId: String(row.userId),
      status: String(row.status),
      summary: this.parseJsonRecord(String(row.summaryJson || '{}')),
      caseResults: this.parseJsonArray(String(row.caseResultsJson || '[]')),
      createdAt: String(row.createdAt || ''),
      completedAt: row.completedAt ? String(row.completedAt) : null,
    };
  }

  private parseJsonArray(raw: string): Array<Record<string, unknown>> {
    try {
      const parsed = JSON.parse(raw || '[]') as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>>
        : [];
    } catch {
      return [];
    }
  }

  private marketplaceTemplates(): Array<Record<string, unknown>> {
    return [
      {
        id: 'research-agent',
        name: 'Research Agent',
        category: 'research',
        description: '适合资料检索、证据整理、结论归纳和引用说明。',
        toolNames: ['browser_fetch', 'notion_search', 'text_stats'],
        skillNames: ['Research Planner', 'Workflow Orchestrator'],
        temperature: 0.3,
        maxTokens: 4096,
        systemPrompt: '你是严谨的研究型 Agent。你会先拆解问题，再检索资料、整理证据、标注不确定性，最后输出结论、依据和后续建议。',
      },
      {
        id: 'data-code-agent',
        name: 'Data & Code Agent',
        category: 'code',
        description: '适合轻量代码执行、数据计算、文本统计和结果解释。',
        toolNames: ['container_javascript_runner', 'calculator', 'text_stats'],
        skillNames: ['Code Operator', 'Data Analyst'],
        temperature: 0.2,
        maxTokens: 4096,
        systemPrompt: '你是数据与代码执行 Agent。遇到计算和代码任务时优先使用工具验证结果，并解释输入、过程、输出和边界情况。',
      },
      {
        id: 'customer-support-agent',
        name: 'Customer Support Agent',
        category: 'business',
        description: '适合客服问答、知识库检索、用户偏好记忆和标准答复。',
        toolNames: ['current_time', 'browser_fetch'],
        skillNames: ['Workflow Orchestrator'],
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: '你是专业客服 Agent。你会基于知识库和上下文给出简洁、礼貌、可执行的答复；不确定时说明需要补充的信息。',
      },
    ];
  }

  private async insertStep(
    runId: string,
    agentId: string,
    userId: string,
    step: AgentRunStepInput,
  ): Promise<number> {
    const endedAtSql = step.endedAt === null ? 'NULL' : '?';
    const sql = `INSERT INTO agent_run_steps
      (run_id, agent_id, user_id, step_type, name, status, input, output, error, started_at, ended_at, latency_ms, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${endedAtSql}, ?, ?)`;
    const params = [
      runId,
      agentId,
      userId,
      step.stepType,
      step.name,
      step.status,
      step.input,
      step.output,
      step.error ?? '',
      step.startedAt,
      ...(step.endedAt === null ? [] : [step.endedAt]),
      step.latencyMs,
      step.metadata,
    ];
    const result = await this.databaseService.connection.prepare(sql).run(...params);
    return Number(result.lastInsertRowid ?? 0);
  }

  private async getStep(userId: string, runId: string, stepId: number): Promise<AgentRunStep> {
    const row = await this.databaseService.connection.prepare(
      `SELECT
         id,
         run_id as runId,
         step_type as stepType,
         name,
         status,
         input,
         output,
         error,
         started_at as startedAt,
         ended_at as endedAt,
         latency_ms as latencyMs,
         metadata
       FROM agent_run_steps
       WHERE id = ? AND run_id = ? AND user_id = ?`,
    ).get(stepId, runId, userId) as unknown as AgentRunStep | undefined;
    if (!row) throw new NotFoundException('Agent 运行步骤不存在');
    return {
      ...row,
      id: Number(row.id),
      latencyMs: Number(row.latencyMs),
      endedAt: row.endedAt || null,
    };
  }

  private async collectCompletionStream(
    request: ChatCompletionRequest,
    onDelta: (delta: string, output: string) => void,
  ): Promise<string> {
    const upstream = await this.chatService.createCompletionStream(request);
    const reader = upstream.body?.getReader();
    if (!reader) throw new BadRequestException('模型流式响应不可用');

    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';

    const consumeEvent = (rawEvent: string) => {
      const dataLines = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim());
      for (const data of dataLines) {
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            output += delta;
            onDelta(delta, output);
          }
        } catch {
          continue;
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) consumeEvent(event);
      }
      if (buffer.trim()) consumeEvent(buffer);
      return output;
    } finally {
      reader.releaseLock();
    }
  }

  private assertRunnableModel(model: string): void {
    if (!model || model.trim() === 'auto') {
      throw new BadRequestException('Agent 需要绑定一个具体模型，暂不支持 auto 路由');
    }
  }

  private async scoreRunWithJudge(
    run: AgentRun,
    options?: EvaluateAgentRunDto,
  ): Promise<Pick<AgentEvaluation, 'score' | 'grade' | 'summary' | 'rubric'>> {
    const mode = options?.mode ?? 'hybrid';
    const rules = this.scoreRun(run, options);
    const judgeModel = options?.judgeModel?.trim();
    if (!judgeModel || mode === 'rules') {
      return {
        ...rules,
        rubric: {
          rules: rules.rubric,
          llmJudge: null,
          finalScore: rules.score,
          mode: 'rules',
        },
      };
    }

    try {
      const llmJudge = await this.runLlmJudge(run, options, judgeModel);
      const llmScore = Number(llmJudge.score ?? rules.score);
      const finalScore = mode === 'llm'
        ? llmScore
        : Math.round((rules.score * 0.45) + (llmScore * 0.55));
      const grade = this.gradeForScore(finalScore);
      return {
        score: finalScore,
        grade,
        summary: `Hybrid 评测 ${finalScore}/100。规则分 ${rules.score}/100，Judge 分 ${llmScore}/100。${String(llmJudge.reason || '')}`,
        rubric: {
          rules: rules.rubric,
          llmJudge: { ...llmJudge, model: judgeModel },
          finalScore,
          mode,
        },
      };
    } catch (error) {
      return {
        ...rules,
        summary: `${rules.summary} LLM Judge 未完成：${this.errorMessage(error)}`,
        rubric: {
          rules: rules.rubric,
          llmJudge: {
            model: judgeModel,
            error: this.errorMessage(error),
          },
          finalScore: rules.score,
          mode: 'rules_fallback',
        },
      };
    }
  }

  private async runLlmJudge(
    run: AgentRun,
    options: EvaluateAgentRunDto | undefined,
    judgeModel: string,
  ): Promise<Record<string, unknown>> {
    const request: ChatCompletionRequest = {
      model: judgeModel,
      temperature: 0,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: [
            '你是 Agent 质量评测器。只输出 JSON，不要输出 Markdown。',
            'JSON 格式: {"score":0-100,"reason":"...","failedItems":["..."],"suggestions":["..."]}',
            '评分要考虑任务完成度、准确性、可执行性、是否符合期望输出和 rubric。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            input: run.input,
            output: run.output,
            status: run.status,
            error: run.error,
            expectedOutput: options?.expectedOutput || '',
            rubric: options?.rubric || '',
            trace: run.steps.map((step) => ({
              type: step.stepType,
              name: step.name,
              status: step.status,
              error: step.error,
              latencyMs: step.latencyMs,
            })),
          }, null, 2),
        },
      ],
    };
    const completion = await this.chatService.createCompletion(request);
    const content = completion.choices?.[0]?.message?.content ?? '{}';
    const parsed = this.parseJsonRecord(content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? content);
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    return {
      score,
      reason: String(parsed.reason || ''),
      failedItems: Array.isArray(parsed.failedItems) ? parsed.failedItems.map(String).slice(0, 20) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).slice(0, 20) : [],
    };
  }

  private gradeForScore(score: number): AgentEvaluation['grade'] {
    return score >= 85 ? 'excellent'
      : score >= 70 ? 'good'
      : score >= 55 ? 'fair'
      : score >= 35 ? 'poor'
      : 'failed';
  }

  private scoreRun(
    run: AgentRun,
    options?: { expectedOutput?: string; rubric?: string },
  ): Pick<AgentEvaluation, 'score' | 'grade' | 'summary' | 'rubric'> {
    const checks: Record<string, number> = {};
    checks.status = run.status === 'succeeded' ? 30 : 0;
    checks.output = run.output.trim().length >= 20 ? 20 : Math.min(10, run.output.trim().length);
    checks.trace = run.steps.length > 0 && run.steps.every((step) => step.status !== 'failed') ? 15 : 5;
    checks.latency = run.latencyMs <= 15_000 ? 10 : run.latencyMs <= 45_000 ? 6 : 2;
    checks.cost = run.totalTokens <= 4000 ? 10 : run.totalTokens <= 12000 ? 6 : 2;
    checks.capability = Math.min(10, run.steps.filter((step) => ['tool_call', 'delegate_agent', 'delegate_observation', 'rag_retrieval', 'memory_retrieval', 'skill_context'].includes(step.stepType)).length * 3);

    if (options?.expectedOutput?.trim()) {
      const expectedTerms = this.extractEvalTerms(options.expectedOutput);
      const matchedTerms = expectedTerms.filter((term) => run.output.toLowerCase().includes(term.toLowerCase()));
      checks.expected = expectedTerms.length > 0
        ? Math.round((matchedTerms.length / expectedTerms.length) * 15)
        : 0;
    } else {
      checks.expected = run.output ? 5 : 0;
    }

    const score = Math.max(0, Math.min(100, Object.values(checks).reduce((sum, value) => sum + value, 0)));
    const grade = score >= 85 ? 'excellent'
      : score >= 70 ? 'good'
      : score >= 55 ? 'fair'
      : score >= 35 ? 'poor'
      : 'failed';
    const summary = run.status === 'failed'
      ? `运行失败：${run.error || '未返回错误详情'}`
      : `自动评测 ${score}/100，输出长度 ${run.output.length}，Trace 步骤 ${run.steps.length}，耗时 ${run.latencyMs}ms。`;
    return {
      score,
      grade,
      summary,
      rubric: {
        checks,
        expectedOutputProvided: Boolean(options?.expectedOutput?.trim()),
        customRubric: options?.rubric?.trim() ?? '',
      },
    };
  }

  private extractEvalTerms(text: string): string[] {
    const asciiTerms = text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [];
    const cjkTerms = Array.from(text.matchAll(/[\u3400-\u9fff]{2,}/g)).map((m) => m[0]);
    return Array.from(new Set([...asciiTerms, ...cjkTerms])).slice(0, 20);
  }

  private parseJsonRecord(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw || '{}') as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async withBindings(userId: string, agent: AgentDefinition): Promise<AgentDefinition> {
    const [tools, knowledgeBases, skills] = await Promise.all([
      this.toolsService.getAgentTools(userId, agent.id),
      this.knowledgeService.getAgentKnowledgeBases(userId, agent.id),
      this.skillsService.getAgentSkills(userId, agent.id),
    ]);
    return {
      ...agent,
      toolIds: tools.map((tool) => tool.id),
      knowledgeBaseIds: knowledgeBases.map((kb) => kb.id),
      skillIds: skills.map((skill) => skill.id),
    };
  }

  private async buildBuiltinRuntimeAgent(
    userId: string,
    spec: BuiltinAgentSpec,
    model: string,
    inheritedKnowledgeBaseIds: string[] = [],
  ): Promise<AgentDefinition> {
    this.assertRunnableModel(model);
    const [tools, skills] = await Promise.all([
      this.toolsService.listForUser(userId),
      this.skillsService.listForUser(userId),
    ]);
    const toolIds = tools.filter((tool) => spec.toolNames.includes(tool.name)).map((tool) => tool.id);
    const skillIds = skills.filter((skill) => spec.skillNames.includes(skill.name)).map((skill) => skill.id);
    const now = this.databaseService.now();
    return {
      id: `builtin:${spec.key}`,
      userId,
      name: spec.name,
      description: spec.description,
      model,
      systemPrompt: spec.systemPrompt,
      temperature: spec.temperature,
      maxTokens: spec.maxTokens,
      memoryEnabled: true,
      toolIds,
      knowledgeBaseIds: inheritedKnowledgeBaseIds,
      skillIds,
      published: false,
      apiEnabled: false,
      publicSlug: '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      builtinKey: spec.key,
      source: 'builtin',
    };
  }

  private mapAgent(row: AgentRow): AgentDefinition {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? '',
      model: row.model,
      systemPrompt: row.systemPrompt ?? '',
      temperature: Number(row.temperature ?? 0.7),
      maxTokens: Number(row.maxTokens ?? 1024),
      memoryEnabled: row.memoryEnabled === undefined ? true : Number(row.memoryEnabled) === 1,
      toolIds: [],
      knowledgeBaseIds: [],
      skillIds: [],
      published: Number(row.published ?? 0) === 1,
      apiEnabled: Number(row.apiEnabled ?? 0) === 1,
      publicSlug: row.publicSlug || '',
      status: row.status || 'active',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastRunAt: row.lastRunAt || undefined,
      runCount: Number(row.runCount ?? 0),
      source: 'user',
    };
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    if (!slug) throw new BadRequestException('公开访问标识不能为空');
    return slug;
  }

  private async assertSlugAvailable(userId: string, agentId: string, slug: string): Promise<void> {
    const existing = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId FROM agents
       WHERE public_slug = ? AND deleted_at IS NULL AND id <> ?
       LIMIT 1`,
    ).get(slug, agentId) as unknown as { id: string; userId: string } | undefined;
    if (existing) {
      throw new ConflictException('公开访问标识已被占用');
    }
  }
}
