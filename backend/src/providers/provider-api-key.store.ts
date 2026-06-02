import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService, dbNow } from '../database/database.service';
import { ApiKeyPool } from './api-key-pool';
import { parseKeysFromEnv } from './openai-compatible.provider';
import { randomUUID } from 'crypto';

/* -------- Public types -------- */

export interface ProviderApiKeyRow {
  id: string;
  providerName: string;
  name: string;
  apiKey: string;
  keyPrefix: string;
  createdAt: string;
}

export interface ProviderConfig {
  id: string;
  providerName: string;
  displayName: string;
  baseUrl: string;
  models: string;
  modelPrefix: string | null;
  authHeader: string;
  authPrefix: string;
  timeoutMs: number;
  retryCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfigInput {
  providerName: string;
  displayName: string;
  baseUrl: string;
  models: string;
  modelPrefix?: string;
  authHeader?: string;
  authPrefix?: string;
  timeoutMs?: number;
  retryCount?: number;
}

/* -------- helpers -------- */

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return '***';
  return '***' + key.slice(-4);
}

/* -------- Hardcoded fallback (used when DB has no configs yet) -------- */

const DEFAULT_PROVIDER_NAMES = ['qwen', 'glm', 'deepseek', 'xiaomi-mimo', 'minimax', 'kimi', 'gui'];

const PROVIDER_ENV_MAP: Record<string, { keysEnv: string; keyEnv: string }> = {
  qwen: { keysEnv: 'QWEN_API_KEYS', keyEnv: 'QWEN_API_KEY' },
  glm: { keysEnv: 'GLM_API_KEYS', keyEnv: 'GLM_API_KEY' },
  deepseek: { keysEnv: 'DEEPSEEK_API_KEYS', keyEnv: 'DEEPSEEK_API_KEY' },
  'xiaomi-mimo': { keysEnv: 'XIAOMI_API_KEYS', keyEnv: 'XIAOMI_API_KEY' },
  minimax: { keysEnv: 'MINIMAX_API_KEYS', keyEnv: 'MINIMAX_API_KEY' },
  kimi: { keysEnv: 'KIMI_API_KEYS', keyEnv: 'KIMI_API_KEY' },
  gui: { keysEnv: 'GUI_API_KEYS', keyEnv: 'GUI_API_KEY' },
};

/* -------- Service -------- */

@Injectable()
export class ProviderApiKeyStore implements OnModuleInit {
  private pools = new Map<string, ApiKeyPool>();
  private _readyResolve!: () => void;
  readonly ready: Promise<void> = new Promise((r) => { this._readyResolve = r; });

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    console.log('[ProviderApiKeyStore] Initializing key pools...');

    // Load provider names from DB configs, fall back to hardcoded list
    const configs = await this.listConfigs();
    const names = configs.length > 0
      ? configs.filter((c) => c.enabled).map((c) => c.providerName)
      : DEFAULT_PROVIDER_NAMES;

    for (const providerName of names) {
      await this.reloadPool(providerName);
    }
    const parts: string[] = [];
    this.pools.forEach((pool, name) => {
      parts.push(`${name}(${pool.size()} keys)`);
    });
    console.log(`[ProviderApiKeyStore] Pools ready: ${parts.join(', ')}`);
    this._readyResolve();
  }

  getPool(providerName: string): ApiKeyPool {
    const pool = this.pools.get(providerName);
    if (!pool) {
      throw new Error(
        `ProviderApiKeyStore: no pool for "${providerName}". Ensure keys are configured in DB or .env`,
      );
    }
    return pool;
  }

  async reloadPool(providerName: string): Promise<void> {
    const db = this.databaseService.connection;

    // 1. Load keys from DB (plaintext)
    const rows = (await db
      .prepare(
        'SELECT api_key FROM provider_api_keys WHERE provider_name = ? ORDER BY created_at ASC',
      )
      .all(providerName)) as Array<{ api_key: string }>;

    const dbKeys: string[] = rows.map((r) => r.api_key).filter(Boolean);

    // 2. Load fallback keys from .env
    const envConfig = PROVIDER_ENV_MAP[providerName];
    const envKeys: string[] = [];
    if (envConfig) {
      const primaryKeys = parseKeysFromEnv(envConfig.keysEnv);
      for (const k of primaryKeys) envKeys.push(k);
      const dashscopeKeys = parseKeysFromEnv('DASHSCOPE_API_KEYS');
      for (const k of dashscopeKeys) {
        if (!envKeys.includes(k)) envKeys.push(k);
      }
      const dashscopeKey = process.env.DASHSCOPE_API_KEY || '';
      if (dashscopeKey && !envKeys.includes(dashscopeKey)) envKeys.push(dashscopeKey);
      const singleKey = process.env[envConfig.keyEnv] || '';
      if (singleKey && !envKeys.includes(singleKey)) envKeys.push(singleKey);
    }

    // 3. Merge: DB keys first, then .env fallback (deduplicated)
    const seen = new Set(dbKeys);
    const merged = [...dbKeys];
    for (const k of envKeys) {
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(k);
      }
    }

    if (merged.length === 0) {
      console.warn(
        `[ProviderApiKeyStore] No keys configured for "${providerName}" (neither DB nor .env).`,
      );
      this.pools.delete(providerName);
      return;
    }

    // Read cooldown from system settings if configured
    let cooldown = 30_000;
    try {
      const row = (await this.databaseService.connection.prepare('SELECT value FROM system_settings WHERE `key` = ?').get('api_key_cooldown_ms')) as { value: string } | undefined;
      if (row && row.value) {
        const n = Number(row.value);
        if (Number.isFinite(n) && n > 0) cooldown = n;
      }
    } catch {}

    const pool = new ApiKeyPool(merged, cooldown);
    this.pools.set(providerName, pool);
    console.log(
      `[ProviderApiKeyStore] Pool "${providerName}" reloaded: ${pool.size()} keys (${dbKeys.length} DB + ${merged.length - dbKeys.length} env fallback)`,
    );
  }

  /* -------- API Key CRUD -------- */

  async addKey(
    providerName: string,
    name: string,
    apiKey: string,
  ): Promise<ProviderApiKeyRow> {
    const db = this.databaseService.connection;
    const id = randomUUID();
    const trimmedKey = apiKey.trim();
    const keyPrefix = maskApiKey(trimmedKey);
    const now = dbNow();

    await db
      .prepare(
        'INSERT INTO provider_api_keys (id, provider_name, name, api_key, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, providerName, name || 'Default', trimmedKey, keyPrefix, now);

    await this.reloadPool(providerName);

    return { id, providerName, name: name || 'Default', apiKey: trimmedKey, keyPrefix, createdAt: now };
  }

  async removeKey(id: string): Promise<{ providerName: string }> {
    const db = this.databaseService.connection;

    const row = (await db
      .prepare('SELECT provider_name FROM provider_api_keys WHERE id = ?')
      .get(id)) as { provider_name: string } | undefined;

    if (!row) {
      throw new Error(`ProviderApiKeyStore: key not found: ${id}`);
    }

    await db.prepare('DELETE FROM provider_api_keys WHERE id = ?').run(id);
    await this.reloadPool(row.provider_name);

    return { providerName: row.provider_name };
  }

  async listKeys(providerName?: string): Promise<ProviderApiKeyRow[]> {
    const db = this.databaseService.connection;

    let sql =
      'SELECT id, provider_name, name, api_key, key_prefix, created_at FROM provider_api_keys';
    const params: string[] = [];
    if (providerName) {
      sql += ' WHERE provider_name = ?';
      params.push(providerName);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = (await db.prepare(sql).all(...params)) as Array<{
      id: string;
      provider_name: string;
      name: string;
      api_key: string;
      key_prefix: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      providerName: r.provider_name,
      name: r.name,
      apiKey: r.api_key,
      keyPrefix: r.key_prefix,
      createdAt: r.created_at,
    }));
  }

  /* -------- Provider Config CRUD -------- */

  async listConfigs(): Promise<ProviderConfig[]> {
    const db = this.databaseService.connection;
    const rows = (await db
      .prepare(
        'SELECT id, provider_name, display_name, base_url, models, model_prefix, auth_header, auth_prefix, timeout_ms, retry_count, enabled, created_at, updated_at FROM provider_configs ORDER BY created_at ASC',
      )
      .all()) as Array<{
      id: string;
      provider_name: string;
      display_name: string;
      base_url: string;
      models: string;
      model_prefix: string | null;
      auth_header: string;
      auth_prefix: string;
      timeout_ms: number;
      retry_count: number;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      providerName: r.provider_name,
      displayName: r.display_name,
      baseUrl: r.base_url,
      models: r.models,
      modelPrefix: r.model_prefix || null,
      authHeader: r.auth_header || 'Authorization',
      authPrefix: r.auth_prefix || 'Bearer',
      timeoutMs: Number(r.timeout_ms),
      retryCount: Number(r.retry_count),
      enabled: r.enabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getConfig(providerName: string): Promise<ProviderConfig | null> {
    const all = await this.listConfigs();
    return all.find((c) => c.providerName === providerName) || null;
  }

  async createConfig(input: ProviderConfigInput): Promise<ProviderConfig> {
    const db = this.databaseService.connection;
    const id = randomUUID();
    const now = dbNow();

    await db
      .prepare(
        'INSERT INTO provider_configs (id, provider_name, display_name, base_url, models, model_prefix, auth_header, auth_prefix, timeout_ms, retry_count, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      )
      .run(
        id,
        input.providerName,
        input.displayName,
        input.baseUrl,
        input.models,
        input.modelPrefix || null,
        input.authHeader || 'Authorization',
        input.authPrefix || 'Bearer',
        input.timeoutMs ?? 25000,
        input.retryCount ?? 2,
        now,
        now,
      );

    // Build key pool for the new provider
    await this.reloadPool(input.providerName);

    return (await this.getConfig(input.providerName))!;
  }

  async updateConfig(
    id: string,
    input: Partial<ProviderConfigInput>,
  ): Promise<ProviderConfig> {
    const db = this.databaseService.connection;
    const now = dbNow();

    const existing = (await db
      .prepare('SELECT * FROM provider_configs WHERE id = ?')
      .get(id)) as Record<string, unknown> | undefined;

    if (!existing) throw new Error(`ProviderConfig not found: ${id}`);

    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.providerName !== undefined) {
      fields.push('provider_name = ?');
      params.push(input.providerName);
    }
    if (input.displayName !== undefined) {
      fields.push('display_name = ?');
      params.push(input.displayName);
    }
    if (input.baseUrl !== undefined) {
      fields.push('base_url = ?');
      params.push(input.baseUrl);
    }
    if (input.models !== undefined) {
      fields.push('models = ?');
      params.push(input.models);
    }
    if (input.modelPrefix !== undefined) {
      fields.push('model_prefix = ?');
      params.push(input.modelPrefix || null);
    }
    if (input.authHeader !== undefined) {
      fields.push('auth_header = ?');
      params.push(input.authHeader);
    }
    if (input.authPrefix !== undefined) {
      fields.push('auth_prefix = ?');
      params.push(input.authPrefix);
    }
    if (input.timeoutMs !== undefined) {
      fields.push('timeout_ms = ?');
      params.push(input.timeoutMs);
    }
    if (input.retryCount !== undefined) {
      fields.push('retry_count = ?');
      params.push(input.retryCount);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      params.push(now);
      params.push(id);
      await db
        .prepare(`UPDATE provider_configs SET ${fields.join(', ')} WHERE id = ?`)
        .run(...params);
    }

    return (await this.getConfig(
      (input.providerName as string) || (existing.provider_name as string),
    ))!;
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<ProviderConfig> {
    const db = this.databaseService.connection;
    const now = dbNow();

    const existing = (await db
      .prepare('SELECT provider_name FROM provider_configs WHERE id = ?')
      .get(id)) as { provider_name: string } | undefined;

    if (!existing) throw new Error(`ProviderConfig not found: ${id}`);

    await db
      .prepare(
        'UPDATE provider_configs SET enabled = ?, updated_at = ? WHERE id = ?',
      )
      .run(enabled ? 1 : 0, now, id);

    if (enabled) {
      await this.reloadPool(existing.provider_name);
    }

    return (await this.getConfig(existing.provider_name))!;
  }

  async deleteConfig(id: string): Promise<{ providerName: string }> {
    const db = this.databaseService.connection;

    const existing = (await db
      .prepare('SELECT provider_name FROM provider_configs WHERE id = ?')
      .get(id)) as { provider_name: string } | undefined;

    if (!existing) throw new Error(`ProviderConfig not found: ${id}`);

    // Delete associated keys and config
    await db
      .prepare('DELETE FROM provider_api_keys WHERE provider_name = ?')
      .run(existing.provider_name);
    await db.prepare('DELETE FROM provider_configs WHERE id = ?').run(id);

    this.pools.delete(existing.provider_name);

    return { providerName: existing.provider_name };
  }

  /** Count keys for a given provider (for admin UI display). */
  async keyCount(providerName: string): Promise<number> {
    const db = this.databaseService.connection;
    const { count } = (await db
      .prepare('SELECT COUNT(*) as count FROM provider_api_keys WHERE provider_name = ?')
      .get(providerName)) as { count: number };
    return count;
  }
}
