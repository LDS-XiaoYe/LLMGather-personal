import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createConnection } from 'mysql2/promise';
import { DatabaseService } from '../database.service';
import { MysqlDatabaseAdapter } from '../adapters/mysql.adapter';
import { seedSystemSettings } from './system-settings.seed';
import { SYSTEM_SETTINGS_DEFAULTS } from './system-settings.defaults';

const integration = process.env.DATABASE_BOOTSTRAP_INTEGRATION === 'true' ? describe : describe.skip;
integration('isolated MySQL system settings initialization', () => {
  jest.setTimeout(120000);
  let db: DatabaseService;
  const originalEnv = { ...process.env };
  const workerPath = resolve(__dirname, '../../../scripts/database-bootstrap-worker.cjs');
  async function worker(mode: string, database: string) {
    return new Promise<string>((resolveResult, reject) => {
      const child = spawn(process.execPath, [workerPath, mode], {
        env: { ...process.env, MYSQL_DATABASE: database }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', data => { output += data.toString(); });
      child.stderr.on('data', data => { output += data.toString(); });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolveResult(output) : reject(Error('Worker exit=' + code + '\n' + output)));
    });
  }
  async function rows() {
    return db.connection.prepare('SELECT * FROM system_settings ORDER BY `key`').all();
  }
  beforeAll(async () => {
    if (process.env.MYSQL_DATABASE !== 'seed_test_fresh' || process.env.MYSQL_HOST !== '127.0.0.1') {
      throw Error('Use only the isolated database bootstrap launcher');
    }
    const c = await createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT),
      user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD });
    try {
      const [databases] = await c.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', ['seed_test_fresh']);
      expect(databases).toEqual([]);
    } finally { await c.end(); }
    db = new DatabaseService();
  });
  afterAll(async () => { await db?.onModuleDestroy(); process.env = { ...originalEnv }; });
  it('creates a previously absent database, all existing schema tables and exact source defaults', async () => {
    await db.initialize();
    expect(db.isReady).toBe(true);
    const all = await rows();
    expect(all).toHaveLength(23);
    for (const entry of SYSTEM_SETTINGS_DEFAULTS) {
      expect(all.find(row => row.key === entry.key)).toMatchObject({ key: entry.key, value: entry.value, description: entry.description });
    }
    const source = readFileSync(resolve(__dirname, '../database.service.ts'), 'utf8');
    const names = [...source.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map(match => match[1]);
    const tables = await db.connection.prepare('SHOW TABLES').all();
    const existing = tables.flatMap(row => Object.values(row));
    for (const name of [...names, 'workflow_checkpoints', 'workflow_checkpoint_writes', 'memory_index_spaces']) expect(existing).toContain(name);
  });
  it('repeat full bootstrap preserves all values, descriptions, timestamps and uniqueness', async () => {
    const before = await rows();
    const output = await worker('bootstrap', 'seed_test_fresh');
    expect(output).toContain('PASS process bootstrap');
    expect(await rows()).toEqual(before);
  });
  it('never runs obsolete startup model rewrites over administrator settings', async () => {
    await db.connection.prepare('UPDATE system_settings SET value=?, description=? WHERE `key`=?').run('auto,gemini-legacy,qwen3.6-plus', 'admin override', 'page_models_vision');
    await db.connection.prepare('UPDATE system_settings SET value=? WHERE `key`=?').run('{"auto":["custom"]}', 'model_tags');
    const before = await rows();
    await worker('bootstrap', 'seed_test_fresh');
    expect(await rows()).toEqual(before);
  });
  it('fills only a missing setting and leaves unrelated/custom settings unchanged', async () => {
    await db.connection.prepare('DELETE FROM system_settings WHERE `key`=?').run('invitation_credits');
    const before = await rows();
    await worker('bootstrap', 'seed_test_fresh');
    const all = await rows();
    expect(all.filter(row => row.key !== 'invitation_credits')).toEqual(before);
    expect(all.find(row => row.key === 'invitation_credits')?.value).toBe(SYSTEM_SETTINGS_DEFAULTS.find(row => row.key === 'invitation_credits')?.value);
  });
  it('preserves null descriptions and allows concurrent direct missing-only seeds', async () => {
    const defaults = [{ key: 'seed_test_nullable', value: '', description: null, seedVersion: 'test-only' }];
    await Promise.all([seedSystemSettings(db.connection, defaults), seedSystemSettings(db.connection, defaults)]);
    const row = await db.connection.prepare('SELECT description FROM system_settings WHERE `key`=?').get('seed_test_nullable');
    expect(row?.description).toBeNull();
  });
  it('seeds an existing but empty system_settings table without other bootstrap data', async () => {
    const adapter = new MysqlDatabaseAdapter({ host: process.env.MYSQL_HOST!, port: Number(process.env.MYSQL_PORT),
      user: process.env.MYSQL_USER!, password: process.env.MYSQL_PASSWORD!, database: 'seed_test_empty_table' });
    await adapter.init();
    try {
      await adapter.exec('CREATE TABLE system_settings (`key` VARCHAR(128) PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      expect(await adapter.prepare('SELECT * FROM system_settings').all()).toEqual([]);
      await seedSystemSettings(adapter);
      expect(await adapter.prepare('SELECT `key` FROM system_settings').all()).toHaveLength(23);
    } finally { await adapter.close(); }
  });
  it('serializes two separate full bootstrap processes against the same fresh schema', async () => {
    const results = await Promise.all([worker('bootstrap', 'seed_test_concurrent'), worker('bootstrap', 'seed_test_concurrent')]);
    for (const result of results) expect(result).toContain('PASS process bootstrap');
    const c = await createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT),
      user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: 'seed_test_concurrent' });
    try {
      const [all] = await c.query('SELECT `key`, value, description FROM system_settings ORDER BY `key`');
      expect(all).toEqual(SYSTEM_SETTINGS_DEFAULTS.map(({ key, value, description }) => ({ key, value, description })));
    } finally { await c.end(); }
  });
  it.each(['fail-connection', 'fail-schema', 'fail-seed'])('does not bind HTTP or report Ready on %s', async mode => {
    const output = await worker(mode, 'seed_test_' + mode.replaceAll('-', '_'));
    expect(output).toContain('application not ready; listen=false');
    expect(output).not.toContain('SECRET_VALUE_SENTINEL');
    expect(output).not.toContain('Tables & seed data ready');
  });
  it('fails startup clearly when another process holds the bootstrap lock beyond its timeout', async () => {
    await (db.connection as MysqlDatabaseAdapter).withInitializationLock(async () => {
      const output = await worker('fail-lock', 'seed_test_fresh');
      expect(output).toContain('BOOTSTRAP_LOCK_TIMEOUT');
      expect(output).toContain('listen=false');
    }, 3);
  });
  it('starts the full AppModule on an empty database with the settings cache ready before HTTP', async () => {
    const output = await worker('app', 'seed_test_full_app');
    expect(output).toContain('GET /v1/health=200');
    expect(output).toContain('[SystemSettings] loaded 23 keys');
  });
});
