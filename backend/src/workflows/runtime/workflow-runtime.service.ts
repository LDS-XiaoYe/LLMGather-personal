import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService, dbNow } from '../../database/database.service';
import { WorkflowNodeDto } from '../dto/workflow.dto';
import { MysqlCheckpointer } from './mysql-checkpointer';
import {
  LangGraphWorkflowEngine,
  LegacyWorkflowEngine,
  NodeResult,
  WorkflowDefinition,
  validateDefinition,
} from './workflow-engine';
import { seal, traceText, unseal } from './persistence-codec';
import { abortable } from './abortable';

export interface RuntimeOptions {
  runtimeAgentId?: string;
  skipWorkflowAgentIds?: string[];
  schemaVersion?: 1 | 2;
  signal?: AbortSignal;
  idempotencyKey?: string;
}
interface Snapshot {
  definition: WorkflowDefinition;
  options: RuntimeOptions;
  workflowId: string;
}
type RunRow = {
  id: string;
  user_id: string;
  workflow_id: string;
  input: string;
  status: string;
  snapshot: string;
  engine: string;
};
type Executor = (
  user: string,
  node: WorkflowNodeDto,
  input: string,
  original: string,
  options: RuntimeOptions,
) => Promise<string>;
export function boundedEnv(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
  return n;
}

@Injectable()
export class WorkflowRuntimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private executor?: Executor;
  private scanner?: ReturnType<typeof setInterval>;
  private readonly active = new Map<string, AbortController>();
  private nodeCount = 0;
  private inFlight = 0;
  constructor(
    private readonly database: DatabaseService,
    private readonly saver: MysqlCheckpointer,
  ) {}
  register(executor: Executor): void {
    this.executor = executor;
  }
  onApplicationBootstrap(): void {
    this.scanner = setInterval(() => {
      void this.recover().catch(() => console.error('[Workflow recovery] scan failed'));
    }, 30000);
    this.scanner.unref();
    void this.recover().catch(() => console.error('[Workflow recovery] startup scan failed'));
  }
  onApplicationShutdown(): void {
    if (this.scanner) clearInterval(this.scanner);
    for (const controller of this.active.values()) controller.abort(new Error('Worker shutting down'));
  }
  async health(): Promise<{ status: string }> {
    await this.database.connection.prepare('SELECT 1 AS ok FROM workflow_checkpoints LIMIT 1').all();
    seal({ probe: true });
    return { status: 'ok' };
  }
  async start(
    userId: string,
    workflowId: string,
    definition: WorkflowDefinition,
    input: string,
    options: RuntimeOptions,
  ): Promise<string> {
    validateDefinition(definition);
    const engine = process.env.WORKFLOW_ENGINE || 'langgraph';
    if (!['legacy', 'langgraph'].includes(engine)) throw new Error('Unknown WORKFLOW_ENGINE');
    if (engine === 'legacy' && definition.schemaVersion !== 1) throw new Error('Version 2 requires LangGraph');
    const id = randomUUID();
    const snapshot: Snapshot = { definition, options, workflowId };
    const encrypted = seal(snapshot); // fail before creating a run if encryption is misconfigured
    await this.database.connection
      .prepare(
        `INSERT INTO workflow_runs
      (id,workflow_id,user_id,status,input,output,error,created_at,engine,snapshot)
      VALUES (?,?,?,'pending',?,'','',?,?,?)`,
      )
      .run(id, workflowId, userId, input, this.database.now(), engine, encrypted);
    if (this.inFlight < boundedEnv('WORKFLOW_RUN_CONCURRENCY', 4, 1, 64)) await this.execute(id, userId, false);
    return id;
  }
  async resume(id: string, user: string): Promise<void> {
    const row = await this.row(id, user);
    if (row.status === 'succeeded' || row.status === 'cancelled') return;
    if (row.engine !== 'langgraph') throw new ConflictException('Legacy runs cannot resume');
    await this.execute(id, user, true);
  }
  async cancel(id: string, user: string): Promise<void> {
    await this.row(id, user);
    await this.database.connection
      .prepare(
        `UPDATE workflow_runs SET cancel_requested=1,
      completed_at=IF(status IN ('pending','failed','interrupted') OR lease_until IS NULL OR lease_until<NOW(3),NOW(3),completed_at),
      status=IF(status IN ('pending','failed','interrupted') OR lease_until IS NULL OR lease_until<NOW(3),'cancelled',status)
      WHERE id=? AND user_id=? AND status NOT IN ('succeeded','cancelled')`,
      )
      .run(id, user);
    this.active.get(id)?.abort(new Error('Cancelled'));
  }
  private async row(id: string, user: string): Promise<RunRow> {
    const row = (await this.database.connection
      .prepare('SELECT * FROM workflow_runs WHERE id=? AND user_id=?')
      .get(id, user)) as RunRow | undefined;
    if (!row) throw new NotFoundException('Workflow run not found');
    return row;
  }
  private async recover(): Promise<void> {
    if (!this.executor || process.env.WORKFLOW_AUTO_RECOVER === 'false') return;
    const rows = await this.database.connection
      .prepare(
        `SELECT id,user_id,status FROM workflow_runs
      WHERE engine='langgraph' AND cancel_requested=0 AND status IN ('pending','running')
      AND (lease_until IS NULL OR lease_until<NOW(3)) ORDER BY created_at LIMIT 10`,
      )
      .all();
    for (const row of rows) {
      if (this.inFlight >= boundedEnv('WORKFLOW_RUN_CONCURRENCY', 4, 1, 64)) break;
      void this.execute(String(row.id), String(row.user_id), row.status !== 'pending').catch(() => undefined);
    }
  }
  private async execute(id: string, user: string, resume: boolean): Promise<void> {
    if (this.inFlight >= boundedEnv('WORKFLOW_RUN_CONCURRENCY', 4, 1, 64))
      throw new ConflictException('Workflow worker capacity reached');
    this.inFlight++;
    try {
      await this.executeOwned(id, user, resume);
    } finally {
      this.inFlight--;
    }
  }
  private async executeOwned(id: string, user: string, resume: boolean): Promise<void> {
    if (!this.executor) throw new Error('Workflow node executor not registered');
    const row = await this.row(id, user);
    const snapshot = unseal<Snapshot>(row.snapshot);
    const owner = randomUUID();
    const claim = await this.database.connection
      .prepare(
        `UPDATE workflow_runs
      SET status='running',lease_owner=?,lease_until=DATE_ADD(NOW(3),INTERVAL 60 SECOND),attempt=attempt+1,error=''
      WHERE id=? AND user_id=? AND status IN ('pending','running','failed','interrupted') AND cancel_requested=0
      AND (lease_until IS NULL OR lease_until<NOW(3))`,
      )
      .run(owner, id, user);
    if (!claim.changes) throw new ConflictException('Run already owned, terminal or cancelled');
    const controller = new AbortController();
    this.active.set(id, controller);
    const guard = async () => {
      controller.signal.throwIfAborted();
      const alive = await this.database.connection
        .prepare(
          `SELECT cancel_requested FROM workflow_runs WHERE id=? AND lease_owner=?
        AND status='running' AND lease_until>NOW(3)`,
        )
        .get(id, owner);
      if (!alive || Number(alive.cancel_requested)) {
        controller.abort(new Error('Cancelled or lease lost'));
        controller.signal.throwIfAborted();
      }
    };
    const heartbeat = setInterval(() => {
      void this.database.connection
        .prepare(
          `UPDATE workflow_runs SET lease_until=DATE_ADD(NOW(3),INTERVAL 60 SECOND)
        WHERE id=? AND lease_owner=? AND status='running' AND cancel_requested=0 AND lease_until>NOW(3)`,
        )
        .run(id, owner)
        .then((r) => {
          if (!r.changes) controller.abort(new Error('Cancelled or lease lost'));
        })
        .catch(() => controller.abort(new Error('Lease renewal failed')));
    }, 10000);
    const timer = setTimeout(
      () => controller.abort(new Error('Workflow timeout')),
      boundedEnv('WORKFLOW_TIMEOUT_MS', 120000, 100, 3600000),
    );
    try {
      const threadId = `${user}:${id}`;
      if (resume && !(await this.saver.getTuple({ configurable: { thread_id: threadId } }))) {
        const began = await this.database.connection
          .prepare('SELECT node_id FROM workflow_node_executions WHERE run_id=? LIMIT 1')
          .get(id);
        if (began) throw new Error('No checkpoint exists after node execution; reconcile before a new run');
        resume = false; // crash before the first checkpoint and before any business node began
      }
      const engine = row.engine === 'legacy' ? new LegacyWorkflowEngine() : new LangGraphWorkflowEngine();
      const output = await engine.execute(snapshot.definition, {
        threadId,
        input: row.input,
        resume,
        signal: controller.signal,
        checkpointer: this.saver,
        leaseOwner: owner,
        runId: id,
        maxSteps: boundedEnv('WORKFLOW_MAX_STEPS', 256, 4, 10000),
        execute: async (node, input) => {
          while (this.nodeCount >= boundedEnv('WORKFLOW_NODE_CONCURRENCY', 8, 1, 128)) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            controller.signal.throwIfAborted();
          }
          this.nodeCount++;
          try {
            await guard();
            return await this.executeNode(row, snapshot, node, input, owner, controller.signal, guard);
          } finally {
            this.nodeCount--;
          }
        },
      });
      await guard();
      await this.database.connection
        .prepare(
          `UPDATE workflow_runs SET status='succeeded',output=?,completed_at=?,lease_owner=NULL,lease_until=NULL
        WHERE id=? AND lease_owner=? AND status='running' AND cancel_requested=0`,
        )
        .run(traceText(output), this.database.now(), id, owner);
    } catch (error) {
      const message = traceText(error instanceof Error ? error.message : 'Workflow execution failed');
      const status = message.includes('Ambiguous side effect') || controller.signal.aborted ? 'interrupted' : 'failed';
      await this.database.connection
        .prepare(
          `UPDATE workflow_runs SET status=IF(cancel_requested=1,'cancelled',?),error=?,completed_at=?,
        lease_owner=NULL,lease_until=NULL WHERE id=? AND lease_owner=? AND status='running'`,
        )
        .run(status, message, this.database.now(), id, owner);
    } finally {
      clearInterval(heartbeat);
      clearTimeout(timer);
      this.active.delete(id);
    }
  }
  private async executeNode(
    row: RunRow,
    snapshot: Snapshot,
    node: WorkflowNodeDto,
    input: string,
    owner: string,
    signal: AbortSignal,
    guard: () => Promise<void>,
  ): Promise<NodeResult> {
    const db = this.database.connection;
    const existing = await db
      .prepare('SELECT status,payload FROM workflow_node_executions WHERE run_id=? AND node_id=?')
      .get(row.id, node.id);
    if (existing?.status === 'succeeded') {
      const result = unseal<NodeResult>(String(existing.payload));
      const trace = await db
        .prepare("SELECT id FROM workflow_run_steps WHERE run_id=? AND node_id=? AND status='succeeded' LIMIT 1")
        .get(row.id, node.id);
      if (!trace)
        await this.trace(
          row,
          node,
          'succeeded',
          input,
          result.output,
          '{"event":"node_completion_restored_from_ledger"}',
        );
      return result;
    }
    const pure =
      [
        'template_transform',
        'variable_assigner',
        'if_else',
        'question_classifier',
        'end',
        'knowledge',
        'memory',
      ].includes(node.type) ||
      (node.type === 'prompt' && !snapshot.options.runtimeAgentId);
    // Unknown outcome of arbitrary external effects is never automatically replayed.
    if (existing && !pure)
      throw new Error(`Ambiguous side effect at node ${node.id}; reconcile the external outcome before a new run`);
    await guard();
    await db
      .prepare(
        `INSERT INTO workflow_node_executions (run_id,node_id,status,updated_at) VALUES (?,?,'running',?)
      ON DUPLICATE KEY UPDATE status='running',updated_at=VALUES(updated_at)`,
      )
      .run(row.id, node.id, this.database.now());
    const started = Date.now();
    await this.trace(
      row,
      node,
      'running',
      input,
      '',
      JSON.stringify({ event: 'node_started', idempotencyKey: `${row.id}:${node.id}` }),
    );
    try {
      const timeoutMs = Number(node.config.timeoutMs ?? boundedEnv('WORKFLOW_NODE_TIMEOUT_MS', 60000, 100, 3600000));
      if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3600000)
        throw new Error('Invalid node timeout');
      const nodeSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
      const output = await abortable(
        this.executor!(row.user_id, node, input, row.input, {
          ...snapshot.options,
          schemaVersion: snapshot.definition.schemaVersion,
          signal: nodeSignal,
          idempotencyKey: `${row.id}:${node.id}`,
        }),
        nodeSignal,
      );
      if (Buffer.byteLength(output) > boundedEnv('WORKFLOW_MAX_NODE_BYTES', 1048576, 1024, 16777216))
        throw new Error('Node output budget exceeded');
      await guard();
      let next = nextFor(node, input, output);
      if (snapshot.definition.schemaVersion === 1) next = []; // compiler supplies compatibility edges
      const result = { output, next };
      // Fence durable result publication against a superseded worker lease.
      const saved = await db
        .prepare(
          `UPDATE workflow_node_executions e JOIN workflow_runs r ON r.id=e.run_id
        SET e.status='succeeded',e.payload=?,e.updated_at=? WHERE e.run_id=? AND e.node_id=? AND r.lease_owner=?
        AND r.status='running' AND r.cancel_requested=0 AND r.lease_until>NOW(3)`,
        )
        .run(seal(result), this.database.now(), row.id, node.id, owner);
      if (!saved.changes) throw new Error('Lease lost during node completion');
      await this.trace(
        row,
        node,
        'succeeded',
        input,
        output,
        JSON.stringify({ event: 'node_completed', latencyMs: Date.now() - started }),
      );
      return result;
    } catch (error) {
      const message = traceText(error instanceof Error ? error.message : 'Node failed');
      await this.trace(
        row,
        node,
        'failed',
        input,
        '',
        JSON.stringify({ event: 'node_failed', latencyMs: Date.now() - started, error: message }),
      );
      throw error;
    }
  }
  private async trace(
    row: RunRow,
    node: WorkflowNodeDto,
    status: string,
    input: string,
    output: string,
    metadata: string,
  ): Promise<void> {
    const details = JSON.parse(metadata) as { error?: string; latencyMs?: number };
    const now = this.database.now();
    const start =
      status === 'running'
        ? undefined
        : await this.database.connection
            .prepare(
              "SELECT created_at FROM workflow_run_steps WHERE run_id=? AND node_id=? AND status='running' ORDER BY id DESC LIMIT 1",
            )
            .get(row.id, node.id);
    await this.database.connection
      .prepare(
        `INSERT INTO workflow_run_steps
      (run_id,workflow_id,user_id,node_id,node_type,status,input,output,error,created_at,metadata_json,started_at,ended_at,latency_ms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULLIF(?,''),?)`,
      )
      .run(
        row.id,
        row.workflow_id,
        row.user_id,
        node.id,
        node.type,
        status,
        traceText(input),
        traceText(output),
        status === 'failed' ? traceText(details.error || 'Node failed') : '',
        now,
        traceText(metadata),
        start?.created_at instanceof Date ? dbNow(start.created_at) : String(start?.created_at || now),
        status === 'running' ? '' : now,
        Math.floor(details.latencyMs || 0),
      );
  }
}

export function nextFor(node: WorkflowNodeDto, input: string, output: string): string[] {
  const config = node.config;
  const kind = String(config.dagType || node.type);
  if (['end', 'output'].includes(kind) || node.type === 'end') return [];
  if (node.type === 'if_else' || kind === 'condition') {
    const expression = String(config.expression || '').trim();
    const matched = expression ? input.toLowerCase().includes(expression.toLowerCase()) : Boolean(input.trim());
    const ids = matched ? config.trueNextIds : config.falseNextIds;
    return Array.isArray(ids) ? ids.map(String) : [];
  }
  if (node.type === 'question_classifier' || ['question_classifier', 'multi_branch'].includes(kind)) {
    const branch = String((JSON.parse(output) as { branch: string }).branch);
    const branches = Array.isArray(config.branches) ? (config.branches as Record<string, unknown>[]) : [];
    const selected = branches.find((b) => String(b.name || b.id) === branch);
    const ids = selected?.nextIds || config.defaultNextIds;
    return Array.isArray(ids) ? ids.map(String) : [];
  }
  return Array.isArray(config.nextIds) ? config.nextIds.map(String) : [];
}
