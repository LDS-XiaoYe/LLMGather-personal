import { IDatabaseAdapter } from '../database.adapter.interface';
import { modelRegistry } from '../../model-services/model.registry';

export async function migrateModelServices(db: IDatabaseAdapter): Promise<void> {
  for (const definition of ['embedding_instance_id VARCHAR(36)', 'embedding_spec_json TEXT']) {
    try { await db.exec(`ALTER TABLE knowledge_bases ADD COLUMN ${definition}`); }
    catch (e) { if ((e as {code?: string}).code !== 'ER_DUP_FIELDNAME') throw e; }
  }
  const tables = [
    `CREATE TABLE IF NOT EXISTS model_definitions (id VARCHAR(64) PRIMARY KEY, definition_json LONGTEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS model_nodes (id VARCHAR(36) PRIMARY KEY, name VARCHAR(128) NOT NULL,
      base_url VARCHAR(500) NOT NULL, token_cipher TEXT NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'OFFLINE',
      hardware_json TEXT, last_seen DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`,
    `CREATE TABLE IF NOT EXISTS model_instances (id VARCHAR(36) PRIMARY KEY, node_id VARCHAR(36) NOT NULL,
      model_id VARCHAR(64) NOT NULL, config_json TEXT NOT NULL, spec_json TEXT, fingerprint VARCHAR(64),
      desired_state VARCHAR(24) NOT NULL, actual_state VARCHAR(24) NOT NULL, provider_registered INT NOT NULL DEFAULT 0,
      operation_id VARCHAR(36), default_provider INT NOT NULL DEFAULT 0, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX model_node(node_id))`,
    `CREATE TABLE IF NOT EXISTS model_tasks (id VARCHAR(36) PRIMARY KEY, instance_id VARCHAR(36) NOT NULL, node_id VARCHAR(36) NOT NULL,
      request_json TEXT NOT NULL, request_hash VARCHAR(64) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'PENDING', phase VARCHAR(64) NOT NULL,
      progress_json TEXT, error VARCHAR(500) NOT NULL DEFAULT '', owner VARCHAR(36), lease_until DATETIME(3), cancel_requested INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX model_task_queue(status,lease_until))`,
    `CREATE TABLE IF NOT EXISTS model_downloads (task_id VARCHAR(36) PRIMARY KEY, instance_id VARCHAR(36) NOT NULL,
      source VARCHAR(32), downloaded_bytes BIGINT NOT NULL DEFAULT 0, total_bytes BIGINT NOT NULL DEFAULT 0, phase VARCHAR(64) NOT NULL,
      file_path VARCHAR(191), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`,
    `CREATE TABLE IF NOT EXISTS model_events (id BIGINT AUTO_INCREMENT PRIMARY KEY, task_id VARCHAR(36) NOT NULL,
      payload_json TEXT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX model_event_task(task_id,id))`,
    `CREATE TABLE IF NOT EXISTS model_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY, actor_id VARCHAR(36) NOT NULL,
      action VARCHAR(64) NOT NULL, target_id VARCHAR(36) NOT NULL, detail_json TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`,
    `CREATE TABLE IF NOT EXISTS model_settings (id VARCHAR(64) PRIMARY KEY, value VARCHAR(36))`,
  ];
  for (const sql of tables) await db.exec(sql);
  for (const model of modelRegistry.models) await db.prepare('INSERT INTO model_definitions (id,definition_json) VALUES (?,?) ON DUPLICATE KEY UPDATE definition_json=VALUES(definition_json)').run(model.id,JSON.stringify(model));
}
