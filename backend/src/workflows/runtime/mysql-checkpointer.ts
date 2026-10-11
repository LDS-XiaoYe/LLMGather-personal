import { Injectable } from '@nestjs/common';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite,
  CheckpointPendingWrite,
  WRITES_IDX_MAP,
} from '@langchain/langgraph-checkpoint';
import { DatabaseService } from '../../database/database.service';
import { seal, unseal } from './persistence-codec';

type Stored = { checkpoint: [string, string]; metadata: [string, string] };
type Row = { thread_id: string; ns: string; checkpoint_id: string; parent_id: string; payload: string };

/** Project-owned adapter conforming to the official interface, NOT an official MySQL saver. */
@Injectable()
export class MysqlCheckpointer extends BaseCheckpointSaver {
  constructor(private readonly database: DatabaseService) {
    super();
  }
  private ids(config: RunnableConfig) {
    const c = config.configurable || {};
    if (!c.thread_id) throw new Error('Persistent thread_id is required');
    const ids = [String(c.thread_id), String(c.checkpoint_ns || ''), String(c.checkpoint_id || '')];
    if (ids[0].length > 128 || ids[1].length > 191) throw new Error('Checkpoint identifier too long');
    return ids;
  }
  private config(thread: string, ns: string, id: string): RunnableConfig {
    return { configurable: { thread_id: thread, checkpoint_ns: ns, checkpoint_id: id } };
  }
  private fence(config: RunnableConfig): { source: string; params: unknown[] } {
    const c = config.configurable || {};
    if (!c.execution_owner) return { source: '', params: [] };
    if (!c.execution_run_id) throw new Error('Missing run ID for fenced checkpoint write');
    return {
      source: ` FROM workflow_runs WHERE id=? AND lease_owner=? AND status='running'
      AND cancel_requested=0 AND lease_until>NOW(3)`,
      params: [c.execution_run_id, c.execution_owner],
    };
  }
  private async pack(value: unknown): Promise<[string, string]> {
    const [type, bytes] = await this.serde.dumpsTyped(value);
    return [type, Buffer.from(bytes).toString('base64')];
  }
  private async unpack<T>(value: [string, string]): Promise<T> {
    return (await this.serde.loadsTyped(value[0], Buffer.from(value[1], 'base64'))) as T;
  }
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const [thread, ns, id] = this.ids(config);
    const row = (await this.database.connection
      .prepare(
        `SELECT * FROM workflow_checkpoints WHERE thread_id=? AND ns=? ${id ? 'AND checkpoint_id=?' : ''}
       ORDER BY checkpoint_id DESC LIMIT 1`,
      )
      .get(...(id ? [thread, ns, id] : [thread, ns]))) as Row | undefined;
    if (!row) return undefined;
    return this.tuple(row);
  }
  private async tuple(row: Row): Promise<CheckpointTuple> {
    const data = unseal<Stored>(row.payload);
    const rows = await this.database.connection
      .prepare(
        'SELECT task_id,channel,payload FROM workflow_checkpoint_writes WHERE thread_id=? AND ns=? AND checkpoint_id=? ORDER BY task_id,write_index',
      )
      .all(row.thread_id, row.ns, row.checkpoint_id);
    const pendingWrites: CheckpointPendingWrite[] = [];
    for (const w of rows)
      pendingWrites.push([String(w.task_id), String(w.channel), await this.unpack(unseal(w.payload as string))]);
    return {
      config: this.config(row.thread_id, row.ns, row.checkpoint_id),
      checkpoint: await this.unpack<Checkpoint>(data.checkpoint),
      metadata: await this.unpack<CheckpointMetadata>(data.metadata),
      parentConfig: row.parent_id ? this.config(row.thread_id, row.ns, row.parent_id) : undefined,
      pendingWrites,
    };
  }
  async *list(config: RunnableConfig, options: CheckpointListOptions = {}): AsyncGenerator<CheckpointTuple> {
    const [thread, ns, id] = this.ids(config);
    let before = options.before?.configurable?.checkpoint_id;
    let count = 0;
    while (true) {
      const params: unknown[] = [thread, ns];
      let where = 'thread_id=? AND ns=?';
      if (id) {
        where += ' AND checkpoint_id=?';
        params.push(id);
      }
      if (before) {
        where += ' AND checkpoint_id<?';
        params.push(before);
      }
      const rows = (await this.database.connection
        .prepare(`SELECT * FROM workflow_checkpoints WHERE ${where} ORDER BY checkpoint_id DESC LIMIT 100`)
        .all(...params)) as Row[];
      if (!rows.length) return;
      for (const row of rows) {
        const tuple = await this.tuple(row);
        if (
          options.filter &&
          !Object.entries(options.filter).every(
            ([k, v]) => JSON.stringify(tuple.metadata?.[k as keyof CheckpointMetadata]) === JSON.stringify(v),
          )
        )
          continue;
        if (options.limit !== undefined && count >= options.limit) return;
        count++;
        yield tuple;
      }
      if (id || rows.length < 100) return;
      before = rows[rows.length - 1].checkpoint_id;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _versions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const [thread, ns, parent] = this.ids(config);
    const payload = seal({ checkpoint: await this.pack(checkpoint), metadata: await this.pack(metadata) });
    const fence = this.fence(config);
    const saved = await this.database.connection
      .prepare(
        `INSERT INTO workflow_checkpoints (thread_id,ns,checkpoint_id,parent_id,payload)
      ${fence.source ? 'SELECT ?,?,?,?,?' + fence.source : 'VALUES (?,?,?,?,?)'} ON DUPLICATE KEY UPDATE payload=VALUES(payload)`,
      )
      .run(thread, ns, checkpoint.id, parent, payload, ...fence.params);
    if (fence.source && !saved.changes) throw new Error('Checkpoint write rejected: lease lost');
    return {
      ...config,
      configurable: { ...config.configurable, ...this.config(thread, ns, checkpoint.id).configurable },
    };
  }
  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const [thread, ns, id] = this.ids(config);
    if (!id) throw new Error('checkpoint_id is required for pending writes');
    if (!writes.length) return;
    const fence = this.fence(config);
    const rows = await Promise.all(
      writes.map(async ([channel, value], index) => [
        thread,
        ns,
        id,
        taskId,
        WRITES_IDX_MAP[channel] ?? index,
        channel,
        seal(await this.pack(value)),
      ]),
    );
    // All channels from a task form ONE atomic batch. A crash must never persist only half its state update.
    const clauses = rows.map(() => (fence.source ? 'SELECT ?,?,?,?,?,?,?' + fence.source : '(?,?,?,?,?,?,?)'));
    const params = rows.flatMap((row) => [...row, ...fence.params]);
    await this.database.connection
      .prepare(
        `INSERT INTO workflow_checkpoint_writes
      (thread_id,ns,checkpoint_id,task_id,write_index,channel,payload)
      ${fence.source ? clauses.join(' UNION ALL ') : 'VALUES ' + clauses.join(',')}
      ON DUPLICATE KEY UPDATE payload=IF(workflow_checkpoint_writes.write_index<0,VALUES(payload),workflow_checkpoint_writes.payload)`,
      )
      .run(...params);
  }

  async deleteThread(thread: string): Promise<void> {
    await this.database.connection.prepare('DELETE FROM workflow_checkpoint_writes WHERE thread_id=?').run(thread);
    await this.database.connection.prepare('DELETE FROM workflow_checkpoints WHERE thread_id=?').run(thread);
  }
}
