import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgentsService } from '../agents/agents.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
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

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly agentsService: AgentsService,
    private readonly toolsService: ToolsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly memoryService: MemoryService,
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

  async run(userId: string, workflowId: string, input: string): Promise<WorkflowRun> {
    const workflow = await this.get(userId, workflowId);
    const runId = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO workflow_runs (id, workflow_id, user_id, status, input, output, error, created_at)
       VALUES (?, ?, ?, 'running', ?, '', '', ?)`,
    ).run(runId, workflowId, userId, input, now);

    const originalInput = input;
    let current = input;
    let status: 'succeeded' | 'failed' = 'succeeded';
    let error = '';

    for (const node of workflow.nodes) {
      try {
        const output = await this.runNode(userId, node, current, originalInput);
        await this.insertStep(runId, workflowId, userId, node, current, output, 'succeeded', '');
        current = output;
      } catch (err) {
        status = 'failed';
        error = err instanceof Error ? err.message : String(err);
        await this.insertStep(runId, workflowId, userId, node, current, '', 'failed', error);
        break;
      }
    }

    await this.databaseService.connection.prepare(
      `UPDATE workflow_runs SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
    ).run(status, current, error, this.databaseService.now(), runId, userId);
    return this.getRun(userId, runId);
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

  private async runNode(userId: string, node: WorkflowNodeDto, input: string, originalInput: string): Promise<string> {
    if (node.type === 'prompt') {
      const template = String(node.config.template ?? '{{input}}');
      return this.interpolateText(template, input, originalInput);
    }

    if (node.type === 'tool') {
      const tool = String(node.config.tool || node.config.toolId || '');
      const args = this.interpolateArgs(node.config.args as Record<string, unknown> | undefined, input, originalInput);
      const result = await this.toolsService.invoke(userId, tool, args);
      return result.output;
    }

    if (node.type === 'agent') {
      const agentId = String(node.config.agentId || '');
      if (!agentId) throw new NotFoundException('Workflow Agent 节点缺少 agentId');
      const agentInputTemplate = typeof node.config.input === 'string' ? node.config.input : '{{input}}';
      const run = await this.agentsService.run(userId, agentId, {
        input: this.interpolateText(agentInputTemplate, input, originalInput),
      });
      if (run.status === 'failed') {
        throw new Error(run.error || 'Agent 节点执行失败');
      }
      return run.output;
    }

    if (node.type === 'knowledge') {
      const kbIds = Array.isArray(node.config.kbIds) ? node.config.kbIds.map(String) : [];
      const results = await this.knowledgeService.search(userId, kbIds, input, 5);
      return results.map((item, idx) => `[${idx + 1}] ${item.title}\n${item.content}`).join('\n\n') || '未检索到相关知识。';
    }

    if (node.type === 'memory') {
      const agentId = typeof node.config.agentId === 'string' ? node.config.agentId : undefined;
      const results = await this.memoryService.search(userId, input, agentId, 5);
      return results.map((item, idx) => `[${idx + 1}] ${item.memoryType}: ${item.content}`).join('\n\n') || '未检索到相关记忆。';
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

  private interpolateText(template: string, input: string, originalInput: string): string {
    return template
      .replaceAll('{{input}}', input)
      .replaceAll('{{originalInput}}', originalInput);
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
