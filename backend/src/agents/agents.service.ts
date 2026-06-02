import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import { ChatService } from '../gateway/chat.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { ChatCompletionRequest } from '../providers/provider.types';
import { SkillsService } from '../skills/skills.service';
import { ToolsService } from '../tools/tools.service';
import {
  CreateAgentDto,
  CreateAgentTestCaseDto,
  CreateAgentTestSuiteDto,
  CreateAgentVersionDto,
  GenerateAgentDto,
  RunAgentDto,
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
    await this.toolsService.setAgentTools(userId, id, dto.toolIds ?? []);
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
    if (dto.toolIds) await this.toolsService.setAgentTools(userId, agentId, dto.toolIds);
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

    const runId = randomUUID();
    const startedAt = Date.now();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_runs
        (id, agent_id, user_id, status, input, output, model, error, prompt_tokens, completion_tokens, total_tokens, latency_ms, created_at)
       VALUES (?, ?, ?, 'running', ?, '', ?, '', 0, 0, 0, 0, ?)`,
    ).run(runId, agent.id, userId, dto.input, agent.model, now);

    await this.insertStep(runId, agent.id, userId, {
      stepType: 'context',
      name: '上下文组装',
      status: 'succeeded',
      input: dto.input,
      output: JSON.stringify({
        systemPrompt: Boolean(agent.systemPrompt),
        historyMessages: dto.messages?.length ?? 0,
        model: agent.model,
      }),
      startedAt: now,
      endedAt: this.databaseService.now(),
      latencyMs: 0,
      metadata: '',
    });

    const contextBlocks: string[] = [];

    if (agent.skillIds.length > 0) {
      const stepStarted = Date.now();
      try {
        const skills = await this.skillsService.getAgentSkills(userId, agent.id);
        if (skills.length > 0) {
          contextBlocks.push(`Agent Skills:\n${skills.map((skill) => `## ${skill.name}\n${skill.content}`).join('\n\n')}`);
        }
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'skill_context',
          name: 'Skill 能力注入',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(skills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
          })), null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ skillIds: agent.skillIds, count: skills.length }),
        });
      } catch (error) {
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'skill_context',
          name: 'Skill 能力注入',
          status: 'failed',
          input: dto.input,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ skillIds: agent.skillIds }),
        });
      }
    }

    if (agent.memoryEnabled) {
      const stepStarted = Date.now();
      try {
        const memories = await this.memoryService.search(userId, dto.input, agent.id, 5);
        if (memories.length > 0) {
          contextBlocks.push(`长期记忆:\n${memories.map((m, idx) => `[${idx + 1}] ${m.content}`).join('\n')}`);
        }
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'memory_retrieval',
          name: '长期记忆检索',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(memories, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ count: memories.length }),
        });
      } catch (error) {
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'memory_retrieval',
          name: '长期记忆检索',
          status: 'failed',
          input: dto.input,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: '',
        });
      }
    }

    if (agent.knowledgeBaseIds.length > 0) {
      const stepStarted = Date.now();
      try {
        const chunks = await this.knowledgeService.search(userId, agent.knowledgeBaseIds, dto.input, 6);
        if (chunks.length > 0) {
          contextBlocks.push(`知识库检索:\n${chunks.map((c, idx) => `[${idx + 1}] ${c.title}\n${c.content}`).join('\n\n')}`);
        }
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'rag_retrieval',
          name: '知识库检索',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(chunks, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ knowledgeBaseIds: agent.knowledgeBaseIds, count: chunks.length }),
        });
      } catch (error) {
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'rag_retrieval',
          name: '知识库检索',
          status: 'failed',
          input: dto.input,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ knowledgeBaseIds: agent.knowledgeBaseIds }),
        });
      }
    }

    if (agent.toolIds.length > 0) {
      const stepStarted = Date.now();
      try {
      const toolResults = await this.invokePlannedTools(userId, agent, runId, dto)
          .catch(() => [])
          .then(async (planned) => planned.length > 0
            ? planned
            : this.toolsService.autoInvokeForInput(userId, agent.id, runId, dto.input));
        if (toolResults.length > 0) {
          contextBlocks.push(`工具调用结果:\n${toolResults.map((t) => `${t.toolName}: ${t.output || t.error}`).join('\n')}`);
        }
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'tool_calling',
          name: '工具自动调用',
          status: 'succeeded',
          input: dto.input,
          output: JSON.stringify(toolResults, null, 2),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ toolIds: agent.toolIds, count: toolResults.length }),
        });
      } catch (error) {
        await this.insertStep(runId, agent.id, userId, {
          stepType: 'tool_calling',
          name: '工具自动调用',
          status: 'failed',
          input: dto.input,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          startedAt: this.databaseService.now(),
          endedAt: this.databaseService.now(),
          latencyMs: Date.now() - stepStarted,
          metadata: JSON.stringify({ toolIds: agent.toolIds }),
        });
      }
    }

    const llmStepId = await this.insertStep(runId, agent.id, userId, {
      stepType: 'llm_completion',
      name: '模型推理',
      status: 'running',
      input: dto.input,
      output: '',
      startedAt: this.databaseService.now(),
      endedAt: null,
      latencyMs: 0,
      metadata: JSON.stringify({ model: agent.model }),
    });

    try {
      const request = this.buildChatRequest(agent, dto, contextBlocks);
      const completion = await this.chatService.createCompletion(request);
      const output = completion.choices?.[0]?.message?.content ?? '';
      const usage = completion.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      const updatedUser = await this.billingService.chargeForCompletion(
        userId,
        request,
        usage,
        'agent',
      );

      const completedAt = this.databaseService.now();
      const latencyMs = Date.now() - startedAt;
      await this.databaseService.connection.prepare(
        `UPDATE agent_run_steps
         SET status = 'succeeded', output = ?, ended_at = ?, latency_ms = ?, metadata = ?
         WHERE id = ? AND run_id = ?`,
      ).run(
        output,
        completedAt,
        latencyMs,
        JSON.stringify({ usage, creditBalance: updatedUser.credits }),
        llmStepId,
        runId,
      );

      await this.databaseService.connection.prepare(
        `UPDATE agent_runs
         SET status = 'succeeded', output = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, latency_ms = ?, completed_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(
        output,
        usage.prompt_tokens,
        usage.completion_tokens,
        usage.total_tokens,
        latencyMs,
        completedAt,
        runId,
        userId,
      );

      if (agent.memoryEnabled) {
        const memory = await this.memoryService.autoRemember(userId, agent.id, dto.input, output).catch(() => null);
        if (memory) {
          await this.insertStep(runId, agent.id, userId, {
            stepType: 'memory_write',
            name: '长期记忆写入',
            status: 'succeeded',
            input: dto.input,
            output: JSON.stringify(memory, null, 2),
            startedAt: this.databaseService.now(),
            endedAt: this.databaseService.now(),
            latencyMs: 0,
            metadata: JSON.stringify({ memoryId: memory.id }),
          });
        }
      }

      return this.getRun(userId, runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const completedAt = this.databaseService.now();
      const latencyMs = Date.now() - startedAt;
      await this.databaseService.connection.prepare(
        `UPDATE agent_run_steps
         SET status = 'failed', error = ?, ended_at = ?, latency_ms = ?
         WHERE id = ? AND run_id = ?`,
      ).run(message, completedAt, latencyMs, llmStepId, runId);
      await this.databaseService.connection.prepare(
        `UPDATE agent_runs
         SET status = 'failed', error = ?, latency_ms = ?, completed_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(message, latencyMs, completedAt, runId, userId);
      return this.getRun(userId, runId);
    }
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
    options?: { expectedOutput?: string; rubric?: string },
  ): Promise<AgentEvaluation> {
    const run = await this.getRun(userId, runId);
    const evaluation = this.scoreRun(run, options);
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

  async runTestSuite(userId: string, suiteId: string): Promise<Record<string, unknown>> {
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

  private buildChatRequest(agent: AgentDefinition, dto: RunAgentDto, contextBlocks: string[]): ChatCompletionRequest {
    const messages: ChatCompletionRequest['messages'] = [];
    const systemBlocks = [agent.systemPrompt.trim(), ...contextBlocks].filter(Boolean);
    if (systemBlocks.length > 0) {
      messages.push({ role: 'system', content: systemBlocks.join('\n\n---\n\n') });
    }
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

  private async invokePlannedTools(userId: string, agent: AgentDefinition, runId: string, dto: RunAgentDto) {
    const tools = await this.toolsService.getAgentTools(userId, agent.id);
    if (tools.length === 0) return [];
    const standardTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      },
    }));
    const plannerRequest: ChatCompletionRequest = {
      model: agent.model,
      temperature: 0,
      max_tokens: 800,
      tools: standardTools,
      tool_choice: 'auto',
      messages: [
        {
          role: 'system',
          content: [
            '你是工具调用规划器。只输出 JSON，不要输出解释。',
            'JSON 格式: {"calls":[{"toolId":"...","args":{}}]}',
            '如果不需要工具，输出 {"calls":[]}.',
            `可用工具:\n${tools.map((tool) => JSON.stringify({
              toolId: tool.id,
              name: tool.name,
              description: tool.description,
              schema: tool.schema,
            })).join('\n')}`,
          ].join('\n\n'),
        },
        dto.imageUrls?.length
          ? {
              role: 'user',
              content: [
                { type: 'text', text: dto.input },
                ...dto.imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
              ],
            }
          : { role: 'user', content: dto.input },
      ],
    };
    const completion = await this.chatService.createCompletion(plannerRequest);
    const message = completion.choices?.[0]?.message;
    const plan = message?.tool_calls?.length
      ? {
          calls: message.tool_calls.map((call) => ({
            toolId: call.function.name,
            args: this.parseToolArguments(call.function.arguments),
          })),
        }
      : this.extractToolPlan(message?.content ?? '');
    const results = [];
    for (const call of plan.calls.slice(0, 5)) {
      const tool = tools.find((item) => item.id === call.toolId || item.name === call.toolId);
      if (!tool) continue;
      results.push(await this.toolsService.invoke(userId, tool.id, call.args ?? {}, { agentId: agent.id, runId }));
    }
    return results;
  }

  private extractToolPlan(content: string): { calls: Array<{ toolId: string; args: Record<string, unknown> }> } {
    const raw = content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? content;
    const parsed = JSON.parse(raw.trim()) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { calls?: unknown }).calls)) {
      return { calls: [] };
    }
    return {
      calls: (parsed as { calls: Array<{ toolId?: unknown; args?: unknown }> }).calls
        .filter((call) => typeof call.toolId === 'string')
        .map((call) => ({
          toolId: String(call.toolId),
          args: call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args as Record<string, unknown> : {},
        })),
    };
  }

  private parseToolArguments(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw || '{}') as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
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

  private async insertStep(
    runId: string,
    agentId: string,
    userId: string,
    step: {
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
    },
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

  private assertRunnableModel(model: string): void {
    if (!model || model.trim() === 'auto') {
      throw new BadRequestException('Agent 需要绑定一个具体模型，暂不支持 auto 路由');
    }
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
    checks.capability = Math.min(10, run.steps.filter((step) => ['tool_calling', 'rag_retrieval', 'memory_retrieval', 'skill_context'].includes(step.stepType)).length * 3);

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
