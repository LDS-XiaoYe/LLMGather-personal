import { IDatabaseAdapter } from '../database.adapter.interface';

/** The row itself is a transactional outbox: business data and dirty revision change in one SQL statement. */
export async function migrateMemoryIndex(db: IDatabaseAdapter): Promise<void> {
  for (const definition of [
    'index_revision BIGINT NOT NULL DEFAULT 1',
    "index_fingerprint VARCHAR(64) NOT NULL DEFAULT ''",
    'index_pending INT NOT NULL DEFAULT 1',
    'index_attempts INT NOT NULL DEFAULT 0',
    'index_next_attempt_at DATETIME(3)',
    'index_owner VARCHAR(36)',
    'index_lease_until DATETIME(3)',
  ]) {
    try { await db.exec(`ALTER TABLE memories ADD COLUMN ${definition}`); }
    catch (error) { if ((error as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw error; }
  }
  try {
    await db.exec('CREATE INDEX idx_memory_index_queue ON memories(index_pending,index_next_attempt_at,index_lease_until)');
  } catch (error) { if ((error as { code?: string }).code !== 'ER_DUP_KEYNAME') throw error; }
  await db.exec(`CREATE TABLE IF NOT EXISTS memory_index_spaces (
    fingerprint VARCHAR(64) PRIMARY KEY, collection_name VARCHAR(128) NOT NULL,
    descriptor_json TEXT NOT NULL, backfill_cursor VARCHAR(36) NOT NULL DEFAULT '',
    backfill_complete INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
}
