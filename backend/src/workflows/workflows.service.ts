import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
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
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
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

type WorkflowRunOptions = {
  skipWorkflowAgentIds?: string[];
  runtimeAgentId?: string;
};

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
    private readonly toolsService: ToolsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly memoryService: MemoryService,
    private readonly skillsService: SkillsService,
  ) {}

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
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO workflows (id, user_id, name, description, definition_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(id, userId, dto.name.trim(), dto.description?.trim() ?? '', JSON.stringify({ nodes: dto.nodes }), now, now);
    return this.get(userId, id);
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
    const runId = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO workflow_runs (id, workflow_id, user_id, status, input, output, error, created_at)
       VALUES (?, ?, ?, 'running', ?, '', '', ?)`,
    ).run(runId, workflowId, userId, input, now);

    const graph = this.buildWorkflowGraph(userId, workflow, runId, input, options);
    const finalState = await graph.invoke({
      nodes: [],
      current: input,
      originalInput: input,
      index: 0,
      status: 'succeeded',
      error: '',
    } as WorkflowGraphState) as WorkflowGraphState;

    await this.databaseService.connection.prepare(
      `UPDATE workflow_runs SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
    ).run(finalState.status, finalState.current, finalState.error, this.databaseService.now(), runId, userId);
    return this.getRun(userId, runId);
  }

  private buildWorkflowGraph(userId: string, workflow: Workflow, runId: string, input: string, options: WorkflowRunOptions) {
    const State = Annotation.Root({
      nodes: Annotation<WorkflowNodeDto[]>(),
      current: Annotation<string>(),
      originalInput: Annotation<string>(),
      index: Annotation<number>(),
      status: Annotation<'succeeded' | 'failed'>(),
      error: Annotation<string>(),
    });
    type StateType = typeof State.State;

    return new StateGraph(State)
      .addNode('prepare', async (state: StateType) => ({
        ...state,
        nodes: this.orderNodes(workflow.nodes),
        current: input,
        originalInput: input,
        index: 0,
        status: 'succeeded' as const,
        error: '',
      }))
      .addNode('node', async (state: StateType) => {
        const node = state.nodes[state.index];
        if (!node) return state;
        try {
          const output = await this.runNode(userId, node, state.current, state.originalInput, options);
          await this.insertStep(runId, workflow.id, userId, node, state.current, output, 'succeeded', '');
          return { ...state, current: output, index: state.index + 1 };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          await this.insertStep(runId, workflow.id, userId, node, state.current, '', 'failed', error);
          return { ...state, status: 'failed' as const, error, index: state.index + 1 };
        }
      })
      .addNode('finalize', async (state: StateType) => state)
      .addEdge(START, 'prepare')
      .addConditionalEdges('prepare', (state: StateType) => state.nodes.length > 0 ? 'node' : 'finalize', {
        node: 'node',
        finalize: 'finalize',
      })
      .addConditionalEdges('node', (state: StateType) => {
        if (state.status === 'failed') return 'finalize';
        return state.index >= state.nodes.length ? 'finalize' : 'node';
      }, {
        node: 'node',
        finalize: 'finalize',
      })
      .addEdge('finalize', END)
      .compile({ name: 'workflow-graph' });
  }

  async getRun(userId: string, runId: string): Promise<WorkflowRun> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, workflow_id as workflowId, user_id as userId, status, input, output, error,
              created_at as createdAt, completed_at as completedAt
       FROM workflow_runs WHERE id = ? AND user_id = ?`,
    ).get(runId, userId) as unknown as Omit<WorkflowRun, 'steps'> | undefined;
    if (!row) throw new NotFoundException('Workflow 运行记录不存在');

    const steps = await this.databaseService.connection.prepare(
      `SELECT id, node_id as nodeId, node_type as nodeType, status, input, output, error, created_at as createdAt
       FROM workflow_run_steps WHERE run_id = ? AND user_id = ? ORDER BY id ASC`,
    ).all(runId, userId) as unknown as WorkflowRun['steps'];
    return { ...row, steps };
  }

  private async runNode(userId: string, node: WorkflowNodeDto, input: string, originalInput: string, options: WorkflowRunOptions): Promise<string> {
    const dagType = typeof node.config.dagType === 'string' ? node.config.dagType : node.type;
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
      const matched = branches.find((branch) => String(branch.keyword ?? '').trim() && input.includes(String(branch.keyword)));
      return JSON.stringify({ branch: matched?.name || matched?.id || 'default', input }, null, 2);
    }

    if (node.type === 'http_request' || dagType === 'http_request') {
      return this.runHttpNode(node, input, originalInput);
    }

    if (node.type === 'code' || dagType === 'code') {
      const code = String(node.config.code ?? '');
      if (!code.trim()) return input;
      const result = await this.toolsService.invoke(userId, 'javascript_runner', { code, input: { input, originalInput } });
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
        }, options.skipWorkflowAgentIds ?? []);
        if (run.status === 'failed') throw new Error(run.error || 'Workflow LLM 节点执行失败');
        return run.output;
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
        }, options.skipWorkflowAgentIds ?? []);
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
      const result = await this.toolsService.invoke(userId, tool, args);
      return result.output;
    }

    if (node.type === 'agent' || dagType === 'agent_call') {
      const agentId = String(node.config.agentId || '');
      if (!agentId) throw new NotFoundException('Workflow Agent 节点缺少 agentId');
      const agentInputTemplate = typeof node.config.input === 'string' ? node.config.input : '{{input}}';
      const run = await this.agentsService.runFromWorkflow(userId, agentId, {
        input: this.interpolateText(agentInputTemplate, input, originalInput),
      }, options.skipWorkflowAgentIds ?? []);
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

  private async runHttpNode(node: WorkflowNodeDto, input: string, originalInput: string): Promise<string> {
    const urlText = this.interpolateText(String(node.config.url ?? ''), input, originalInput);
    if (!/^https?:\/\//i.test(urlText)) throw new Error('HTTP 节点 URL 必须以 http:// 或 https:// 开头');
    const method = String(node.config.method ?? 'GET').toUpperCase();
    const headers = this.interpolateArgs(node.config.headers as Record<string, unknown> | undefined, input, originalInput);
    const bodyTemplate = typeof node.config.body === 'string' ? node.config.body : '';
    const response = await fetch(urlText, {
      method,
      headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])),
      body: ['GET', 'HEAD'].includes(method) ? undefined : this.interpolateText(bodyTemplate || input, input, originalInput),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    return JSON.stringify({ status: response.status, ok: response.ok, body: text.slice(0, 12000) }, null, 2);
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

  private orderNodes(nodes: WorkflowNodeDto[]): WorkflowNodeDto[] {
    const hasEdges = nodes.some((node) => this.getNextIds(node).length > 0);
    if (!hasEdges) return nodes;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const edges = new Map<string, string[]>();

    for (const node of nodes) {
      const nextIds = this.getNextIds(node).filter((id) => byId.has(id) && id !== node.id);
      edges.set(node.id, nextIds);
      for (const nextId of nextIds) {
        indegree.set(nextId, (indegree.get(nextId) ?? 0) + 1);
      }
    }

    const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0);
    const ordered: WorkflowNodeDto[] = [];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      ordered.push(node);
      for (const nextId of edges.get(node.id) ?? []) {
        const nextDegree = (indegree.get(nextId) ?? 0) - 1;
        indegree.set(nextId, nextDegree);
        if (nextDegree <= 0) {
          const nextNode = byId.get(nextId);
          if (nextNode) queue.push(nextNode);
        }
      }
    }

    if (ordered.length !== nodes.length) {
      const remaining = nodes.filter((node) => !seen.has(node.id));
      return [...ordered, ...remaining];
    }
    return ordered;
  }

  private getNextIds(node: WorkflowNodeDto): string[] {
    const value = node.config.nextIds;
    return Array.isArray(value) ? value.map(String) : [];
  }

  private async insertStep(
    runId: string,
    workflowId: string,
    userId: string,
    node: WorkflowNodeDto,
    input: string,
    output: string,
    status: 'succeeded' | 'failed',
    error: string,
  ) {
    await this.databaseService.connection.prepare(
      `INSERT INTO workflow_run_steps (run_id, workflow_id, user_id, node_id, node_type, status, input, output, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(runId, workflowId, userId, node.id, node.type, status, input, output, error, this.databaseService.now());
  }

  private mapWorkflow(row: WorkflowRow): Workflow {
    let nodes: WorkflowNodeDto[] = [];
    try {
      const definition = JSON.parse(row.definitionJson || '{}') as { nodes?: WorkflowNodeDto[] };
      nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    } catch {}
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      nodes,
      status: row.status || 'active',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
