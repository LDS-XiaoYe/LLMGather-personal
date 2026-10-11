import { IDatabaseAdapter } from '../database.adapter.interface';

/** Additive, restartable MySQL migration. Only duplicate-column errors are ignored. */
export async function migrateP0(db: IDatabaseAdapter): Promise<void> {
  const columns: Record<string, string[]> = {
    workflow_runs: [
      "engine VARCHAR(24) NOT NULL DEFAULT 'legacy'",
      'snapshot LONGTEXT',
      'lease_owner VARCHAR(36)',
      'lease_until DATETIME(3)',
      'cancel_requested INT NOT NULL DEFAULT 0',
      'attempt INT NOT NULL DEFAULT 0',
    ],
    knowledge_bases: [
      "retrieval_backend VARCHAR(24) NOT NULL DEFAULT 'legacy'",
      'rag_owner VARCHAR(36)',
      'rag_lease_until DATETIME(3)',
    ],
    workflow_run_steps: [
      'metadata_json TEXT',
      'started_at DATETIME(3)',
      'ended_at DATETIME(3)',
      'latency_ms INT NOT NULL DEFAULT 0',
    ],
  };
  for (const [table, definitions] of Object.entries(columns)) {
    for (const definition of definitions) {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
  }
  const tables = [
    `CREATE TABLE IF NOT EXISTS workflow_checkpoints (
      thread_id VARCHAR(128) NOT NULL, ns VARCHAR(191) NOT NULL, checkpoint_id VARCHAR(64) NOT NULL,
      parent_id VARCHAR(64) NOT NULL, payload LONGTEXT NOT NULL,
      PRIMARY KEY(thread_id, ns, checkpoint_id))`,
    `CREATE TABLE IF NOT EXISTS workflow_checkpoint_writes (
      thread_id VARCHAR(128) NOT NULL, ns VARCHAR(191) NOT NULL, checkpoint_id VARCHAR(64) NOT NULL,
      task_id VARCHAR(191) NOT NULL, write_index INT NOT NULL, channel VARCHAR(191) NOT NULL,
      payload LONGTEXT NOT NULL, PRIMARY KEY(thread_id, ns, checkpoint_id, task_id, write_index))`,
    `CREATE TABLE IF NOT EXISTS workflow_node_executions (
      run_id VARCHAR(36) NOT NULL, node_id VARCHAR(64) NOT NULL,
      status VARCHAR(24) NOT NULL, payload LONGTEXT, updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY(run_id,node_id))`,
    `CREATE TABLE IF NOT EXISTS knowledge_indexes (
      kb_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, fingerprint VARCHAR(64) NOT NULL,
      collection_name VARCHAR(128) NOT NULL, model_json TEXT NOT NULL, status VARCHAR(24) NOT NULL,
      cursor_id VARCHAR(36) NOT NULL DEFAULT '', indexed_count INT NOT NULL DEFAULT 0,
      error TEXT, lease_owner VARCHAR(36), lease_until DATETIME(3), updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY(kb_id,fingerprint), INDEX idx_ki_user(user_id))`,
  ];
  for (const sql of tables) await db.exec(`${sql} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
}
