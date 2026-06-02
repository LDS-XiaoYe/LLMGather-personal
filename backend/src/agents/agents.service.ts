import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import { ChatService } from '../gateway/chat.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { ChatCompletionRequest } from '../providers/provider.types';
import { ToolsService } from '../tools/tools.service';
import { CreateAgentDto, RunAgentDto, UpdateAgentDto } from './dto/agent.dto';

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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
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
      now,
      now,
    );
    await this.toolsService.setAgentTools(userId, id, dto.toolIds ?? []);
    await this.knowledgeService.setAgentKnowledgeBases(userId, id, dto.knowledgeBaseIds ?? []);
    return this.getById(userId, id);
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
    return this.getById(userId, agentId);
  }

  async softDelete(userId: string, agentId: string): Promise<void> {
    await this.getById(userId, agentId);
    await this.databaseService.connection.prepare(
      'UPDATE agents SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    ).run(this.databaseService.now(), this.databaseService.now(), agentId, userId);
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
        const toolResults = await this.toolsService.autoInvokeForInput(userId, agent.id, runId, dto.input);
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

  private buildChatRequest(agent: AgentDefinition, dto: RunAgentDto, contextBlocks: string[]): ChatCompletionRequest {
    const messages: ChatCompletionRequest['messages'] = [];
    const systemBlocks = [agent.systemPrompt.trim(), ...contextBlocks].filter(Boolean);
    if (systemBlocks.length > 0) {
      messages.push({ role: 'system', content: systemBlocks.join('\n\n---\n\n') });
    }
    for (const msg of dto.messages ?? []) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: dto.input });
    return {
      model: agent.model,
      messages,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    };
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

  private async withBindings(userId: string, agent: AgentDefinition): Promise<AgentDefinition> {
    const [tools, knowledgeBases] = await Promise.all([
      this.toolsService.getAgentTools(userId, agent.id),
      this.knowledgeService.getAgentKnowledgeBases(userId, agent.id),
    ]);
    return {
      ...agent,
      toolIds: tools.map((tool) => tool.id),
      knowledgeBaseIds: knowledgeBases.map((kb) => kb.id),
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
      status: row.status || 'active',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastRunAt: row.lastRunAt || undefined,
      runCount: Number(row.runCount ?? 0),
    };
  }
}
