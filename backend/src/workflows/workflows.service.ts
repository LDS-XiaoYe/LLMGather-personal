import { Inject, Injectable, NotFoundException, OnModuleInit, forwardRef } from '@nestjs/common';
import { WorkflowRuntimeService, RuntimeOptions } from './runtime/workflow-runtime.service';
import { validateDefinition } from './runtime/workflow-engine';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { BillingService } from '../billing/billing.service';
import { randomUUID } from 'crypto';
import { AgentsService } from '../agents/agents.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { SkillsService } from '../skills/skills.service';
import { ToolsService } from '../tools/tools.service';
import { CreateWorkflowDto, WorkflowNodeDto } from './dto/workflow.dto';

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  nodes: WorkflowNodeDto[];
  schemaVersion: 1 | 2;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled';
  input: string;
  output: string;
  error: string;
  createdAt: string;
  completedAt: string | null;
  steps: Array<{
    id: number;
    nodeId: string;
    nodeType: string;
    status: string;
    input: string;
    output: string;
    error: string;
    createdAt: string;
  }>;
}

type WorkflowRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  definitionJson: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

type WorkflowGraphState = {
  nodes: WorkflowNodeDto[];
  current: string;
  originalInput: string;
  index: number;
  status: 'succeeded' | 'failed';
  error: string;
};

type WorkflowRunOptions = RuntimeOptions;

@Injectable()
export class WorkflowsService implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
    private readonly toolsService: ToolsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly memoryService: MemoryService,
    private readonly skillsService: SkillsService,
    private readonly runtime: WorkflowRuntimeService,
    private readonly providers: ProviderRegistryService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void { this.runtime.register((user, node, input, original, options) => this.runNode(user, node, input, original, options)); }

  async list(userId: string): Promise<Workflow[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, definition_json as definitionJson,
              status, created_at as createdAt, updated_at as updatedAt
       FROM workflows
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
    ).all(userId) as unknown as WorkflowRow[];
    return rows.map((row) => this.mapWorkflow(row));
  }

  async create(userId: string, dto: CreateWorkflowDto): Promise<Workflow> {
    validateDefinition({ schemaVersion: dto.schemaVersion ?? 1, nodes: dto.nodes });
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO workflows (id, user_id, name, description, definition_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(id, userId, dto.name.trim(), dto.description?.trim() ?? '', JSON.stringify({ schemaVersion: dto.schemaVersion ?? 1, nodes: dto.nodes }), now, now);
    return this.get(userId, id);
  }

  async update(userId: string, workflowId: string, dto: CreateWorkflowDto): Promise<Workflow> {
    await this.get(userId, workflowId);
    validateDefinition({ schemaVersion: dto.schemaVersion ?? 1, nodes: dto.nodes });
    await this.databaseService.connection.prepare('UPDATE workflows SET name = ?, description = ?, definition_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL').run(dto.name.trim(), dto.description?.trim() ?? '', JSON.stringify({ schemaVersion: dto.schemaVersion ?? 1, nodes: dto.nodes }), this.databaseService.now(), workflowId, userId);
    return this.get(userId, workflowId);
  }

  async get(userId: string, workflowId: string): Promise<Workflow> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, definition_json as definitionJson,
              status, created_at as createdAt, updated_at as updatedAt
       FROM workflows
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(workflowId, userId) as unknown as WorkflowRow | undefined;
    if (!row) throw new NotFoundException('Workflow 不存在');
    return this.mapWorkflow(row);
  }

  async run(userId: string, workflowId: string, input: string, options: WorkflowRunOptions = {}): Promise<WorkflowRun> {
    const workflow = await this.get(userId, workflowId);
    if (options.runtimeAgentId) {
      const agent = await this.agentsService.getById(userId, options.runtimeAgentId);
      if (agent.status !== 'active') throw new Error('Agent 已归档');
    }
    const runId = await this.runtime.start(userId, workflowId, { schemaVersion: workflow.schemaVersion, nodes: workflow.nodes }, input, options);
    return this.getRun(userId, runId);
  }
  async resume(userId: string, runId: string): Promise<WorkflowRun> {
    await this.runtime.resume(runId, userId); return this.getRun(userId, runId);
  }
  async cancel(userId: string, runId: string): Promise<WorkflowRun> {
    await this.runtime.cancel(runId, userId); return this.getRun(userId, runId);
  }
  async runtimeHealth() { return this.runtime.health(); }

  async getRun(userId: string, runId: string): Promise<WorkflowRun> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, workflow_id as workflowId, user_id as userId, status, input, output, error,
              created_at as createdAt, completed_at as completedAt
       FROM workflow_runs WHERE id = ? AND user_id = ?`,
    ).get(runId, userId) as unknown as Omit<WorkflowRun, 'steps'> | undefined;
    if (!row) throw new NotFoundException('Workflow 运行记录不存在');

    const steps = await this.databaseService.connection.prepare(
      `SELECT id, node_id as nodeId, node_type as nodeType, status, input, output, error, created_at as createdAt,
              started_at as startedAt, ended_at as endedAt, latency_ms as latencyMs, metadata_json as metadata
       FROM workflow_run_steps WHERE run_id = ? AND user_id = ? ORDER BY id ASC`,
    ).all(runId, userId) as unknown as WorkflowRun['steps'];
    return { ...row, steps };
  }

  private async runNode(userId: string, node: WorkflowNodeDto, input: string, originalInput: string, options: WorkflowRunOptions): Promise<string> {
    const dagType = typeof node.config.dagType === 'string' ? node.config.dagType : node.type;
    options.signal?.throwIfAborted();
    if (['start','user_input','file_input'].includes(dagType)) return input;
    if (node.type === 'end' || dagType === 'end' || dagType === 'output') {
      return this.interpolateText(String(node.config.template ?? '{{input}}'), input, originalInput);
    }

    if (node.type === 'template_transform' || dagType === 'template_transform' || dagType === 'prompt_builder' || dagType === 'format_output') {
      return this.interpolateText(String(node.config.template ?? '{{input}}'), input, originalInput);
    }

    if (node.type === 'variable_assigner' || dagType === 'variable_assigner') {
      const vars = this.interpolateArgs(node.config.variables as Record<string, unknown> | undefined, input, originalInput);
      return JSON.stringify({ input, variables: vars }, null, 2);
    }

    if (node.type === 'if_else' || dagType === 'if_else' || dagType === 'condition') {
      const expression = String(node.config.expression ?? '').trim();
      const matched = expression ? input.toLowerCase().includes(expression.toLowerCase()) : Boolean(input.trim());
      const template = matched ? String(node.config.trueTemplate ?? '{{input}}') : String(node.config.falseTemplate ?? '{{input}}');
      return this.interpolateText(template, input, originalInput);
    }

    if (node.type === 'question_classifier' || dagType === 'question_classifier' || dagType === 'multi_branch') {
      const branches = Array.isArray(node.config.branches) ? node.config.branches as Array<Record<string, unknown>> : [];
      const matched = branches.find((branch) => String(branch.keyword ?? '').trim() && input.toLowerCase().includes(String(branch.keyword).toLowerCase()));
      const chosen = matched ?? branches.find(branch => !String(branch.keyword ?? '').trim());
      return JSON.stringify({ branch: chosen?.id || chosen?.name || '__unmatched__', input }, null, 2);
    }

    if (options.publicInvocation && node.type === 'http_request') throw new Error('公开调用不执行外部 HTTP 请求');
    if (node.type === 'http_request' || dagType === 'http_request') {
      return this.runHttpNode(node, input, originalInput, options);
    }

    if (node.type === 'code' || dagType === 'code') {
      const code = String(node.config.code ?? '');
      if (!code.trim()) return input;
      const result = await this.agentsService.invokeWorkflowTool(userId, 'javascript_runner', { code, input: { input, originalInput } }, options);
      if (result.status === 'failed') throw new Error(result.error || 'Tool execution failed');
      return result.output;
    }

    if (node.type === 'llm' || dagType === 'llm_generate' || dagType === 'result_summary' || dagType === 'result_rewrite') {
      const template = String(node.config.template ?? node.config.prompt ?? '{{input}}');
      const rendered = this.interpolateText(template, input, originalInput);
      if (options.runtimeAgentId) {
        const run = await this.agentsService.runFromWorkflow(userId, options.runtimeAgentId, {
          input: rendered,
          mode: 'fast',
          maxSteps: 3,
          approvedToolIds: options.publicInvocation ? [] : options.approvedToolIds,
        }, options.skipWorkflowAgentIds ?? [], { publicInvocation: options.publicInvocation, runnableAgent: options.runtimeAgentSnapshot });
        if (run.status === 'failed') throw new Error(run.error || 'Workflow LLM 节点执行失败');
        return run.output;
      }
      if (options.schemaVersion === 2) {
        const model = String(node.config.model || '');
        if (!model) throw new Error('LLM node requires config.model or runtimeAgentId');
        const maxTokens = Number(node.config.maxTokens ?? 2048);
        if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32768) throw new Error('Invalid LLM token budget');
        const request = { model, max_tokens: maxTokens, messages: [{ role: 'user' as const, content: rendered }] };
        const completion = await this.providers.resolveProvider(model).chatCompletion(request);
        if (!completion.usage) throw new Error('LLM provider did not return billable usage');
        await this.billing.chargeForCompletion(userId, request, completion.usage, 'agent');
        return completion.choices?.[0]?.message?.content || '';
      }
      return rendered;
    }

    if (node.type === 'prompt') {
      const template = String(node.config.template ?? '{{input}}');
      const rendered = this.interpolateText(template, input, originalInput);
      if (options.runtimeAgentId && this.shouldRunPromptWithAgent(node)) {
        const run = await this.agentsService.runFromWorkflow(userId, options.runtimeAgentId, {
          input: rendered,
          mode: 'fast',
          maxSteps: 3,
          approvedToolIds: options.publicInvocation ? [] : options.approvedToolIds,
        }, options.skipWorkflowAgentIds ?? [], { publicInvocation: options.publicInvocation, runnableAgent: options.runtimeAgentSnapshot });
        if (run.status === 'failed') {
          throw new Error(run.error || 'Workflow Prompt 节点执行失败');
        }
        return run.output;
      }
      return rendered;
    }

    if (node.type === 'tool' || dagType === 'tool_call') {
      const tool = String(node.config.tool || node.config.toolId || '');
      const args = this.interpolateArgs(node.config.args as Record<string, unknown> | undefined, input, originalInput);
      const result = await this.agentsService.invokeWorkflowTool(userId, tool, args, options);
      if (result.status === 'failed') throw new Error(result.error || 'Tool execution failed');
      return result.output;
    }

    if (node.type === 'agent' || dagType === 'agent_call') {
      const agentId = String(node.config.agentId || '');
      if (!agentId) throw new NotFoundException('Workflow Agent 节点缺少 agentId');
      const agentInputTemplate = typeof node.config.input === 'string' ? node.config.input : '{{input}}';
      const run = await this.agentsService.runFromWorkflow(userId, agentId, {
        input: this.interpolateText(agentInputTemplate, input, originalInput),
        approvedToolIds: options.publicInvocation ? [] : options.approvedToolIds,
        }, options.skipWorkflowAgentIds ?? [], { publicInvocation: options.publicInvocation, runnableAgent: options.runtimeAgentSnapshot });
      if (run.status === 'failed') {
        throw new Error(run.error || 'Agent 节点执行失败');
      }
      return run.output;
    }

    if (node.type === 'knowledge' || dagType === 'knowledge_search') {
      const kbIds = Array.isArray(node.config.kbIds) ? node.config.kbIds.map(String) : [];
      const results = await this.knowledgeService.search(userId, kbIds, input, 5);
      return results.map((item, idx) => `[${idx + 1}] ${item.title}\n${item.content}`).join('\n\n') || '未检索到相关知识。';
    }

    if (options.publicInvocation && (node.type === 'memory' || dagType === 'memory_write')) throw new Error('公开调用不访问私有记忆');
    if (node.type === 'memory' || dagType === 'memory_read') {
      const agentId = typeof node.config.agentId === 'string' ? node.config.agentId : undefined;
      const results = await this.memoryService.search(userId, input, agentId, 5);
      return results.map((item, idx) => `[${idx + 1}] ${item.memoryType}: ${item.content}`).join('\n\n') || '未检索到相关记忆。';
    }

    if (node.type === 'skill' || dagType === 'skill_call') {
      const skillId = String(node.config.skillId || '');
      if (!skillId) throw new NotFoundException('Workflow Skill 节点缺少 skillId');
      const skillInputTemplate = typeof node.config.input === 'string' ? node.config.input : '{{input}}';
      const result = await this.skillsService.runSkill(userId, skillId, {
        input: this.interpolateText(skillInputTemplate, input, originalInput),
      });
      if (result.error) throw new Error(result.error);
      return result.output;
    }

    return input;
  }

  private interpolateArgs(args: Record<string, unknown> | undefined, input: string, originalInput: string): Record<string, unknown> {
    const source = args ?? { text: '{{input}}' };
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      result[key] = typeof value === 'string' ? this.interpolateText(value, input, originalInput) : value;
    }
    return result;
  }

  private async runHttpNode(node: WorkflowNodeDto, input: string, originalInput: string, options: RuntimeOptions): Promise<string> {
    const urlText = this.interpolateText(String(node.config.url ?? ''), input, originalInput);
    const method = String(node.config.method ?? 'GET').toUpperCase();
    const headers = this.interpolateArgs(node.config.headers as Record<string, unknown> | undefined, input, originalInput);
    const bodyTemplate = typeof node.config.body === 'string' ? node.config.body : '';
    const response = await this.toolsService.requestExternalHttp(urlText, {
      method,
      headers: { ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])), 'Idempotency-Key': options.idempotencyKey || '' },
      body: ['GET', 'HEAD'].includes(method) ? undefined : this.interpolateText(bodyTemplate || input, input, originalInput),
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
    if (response.status < 200 || response.status >= 300) throw new Error('Workflow HTTP request failed: ' + response.status);
    return JSON.stringify({ status: response.status, ok: true, body: response.body }, null, 2);
  }

  private shouldRunPromptWithAgent(node: WorkflowNodeDto): boolean {
    const dagType = typeof node.config.dagType === 'string' ? node.config.dagType : '';
    return [
      'intent_detection',
      'parameter_extract',
      'info_extract',
      'content_classify',
      'condition',
      'multi_branch',
      'confidence_check',
      'llm_generate',
      'prompt_builder',
      'result_summary',
      'result_rewrite',
      'format_output',
      'json_parse',
      'multi_result_merge',
    ].includes(dagType);
  }

  private interpolateText(template: string, input: string, originalInput: string): string {
    return template
      .replaceAll('{{input}}', input)
      .replaceAll('{{originalInput}}', originalInput);
  }

  private mapWorkflow(row: WorkflowRow): Workflow {
    let nodes: WorkflowNodeDto[] = [];
    let schemaVersion: 1 | 2 = 1;
    try {
      const definition = JSON.parse(row.definitionJson || '{}') as { nodes?: WorkflowNodeDto[]; schemaVersion?: number };
      schemaVersion = definition.schemaVersion === 2 ? 2 : 1;
      nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    } catch {}
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      nodes,
      schemaVersion,
      status: row.status || 'active',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
