import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { validateSettingValue } from './setting-validation';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private cache = new Map<string, string>();
  private initialization?: Promise<void>;
  private reloadQueue: Promise<void> = Promise.resolve();

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  initialize(): Promise<void> {
    return this.initialization ??= this.loadInitialSettings();
  }

  private async loadInitialSettings(): Promise<void> {
    await this.reloadAll();
    console.log(`[SystemSettings] loaded ${this.cache.size} keys`);
  }

  reloadAll(): Promise<void> {
    const next = this.reloadQueue.then(() => this.readAll());
    this.reloadQueue = next.catch(() => {});
    return next;
  }

  private async readAll(): Promise<void> {
    await this.db.initialize();
    const conn = this.db.connection;
    try {
      const rows = (await conn.prepare('SELECT `key`, value FROM system_settings').all()) as Array<{
        key: string;
        value: string;
      }>;
      const cache = new Map<string, string>();
      for (const r of rows) cache.set(r.key, r.value);
      this.cache = cache;
    } catch {
      // Fail startup rather than reporting Ready with an empty cache. Never log SQL/values.
      throw new Error('[SystemSettings] settings cache load failed');
    }
  }

  /** Lock keys in a stable order, check stale edits, and commit related settings together. */
  async updateValues(values: Record<string, string>, expected: Record<string, string> = {}): Promise<void> {
    const keys = Object.keys(values).sort();
    const validated = new Map(keys.map(key => [key, validateSettingValue(key, values[key])]));
    await this.db.transaction(async tx => {
      for (const key of keys) {
        const row = await tx.prepare('SELECT value FROM system_settings WHERE `key`=? FOR UPDATE').get(key);
        if (!row) throw new NotFoundException(`配置 ${key} 不存在`);
        if (expected[key] !== undefined && row.value !== expected[key]) throw new ConflictException('配置已被其他管理员修改，请重新加载后再保存；当前草稿已保留');
      }
      for (const key of keys) await tx.prepare('UPDATE system_settings SET value=?,updated_at=? WHERE `key`=?').run(validated.get(key), this.db.now(), key);
    });
    await this.refreshCommitted(validated);
  }

  async mutateJSON(key: string, mutate: (value: any) => unknown): Promise<void> {
    let committed = '';
    await this.db.transaction(async tx => {
      const row = await tx.prepare('SELECT value FROM system_settings WHERE `key`=? FOR UPDATE').get(key);
      if (!row) throw new NotFoundException(`配置 ${key} 不存在`);
      const value = validateSettingValue(key, JSON.stringify(mutate(JSON.parse(String(row.value)))));
      await tx.prepare('UPDATE system_settings SET value=?,updated_at=? WHERE `key`=?').run(value, this.db.now(), key);
      committed = value;
    });
    await this.refreshCommitted(new Map([[key, committed]]));
  }

  private async refreshCommitted(values: Map<string, string>): Promise<void> {
    try { await this.reloadAll(); }
    catch {
      // A committed write is successful even if a subsequent cache SELECT fails.
      // Publish the validated committed values without reporting a misleading save failure.
      for (const [key, value] of values) this.cache.set(key, value);
      console.error('[SystemSettings] cache refresh failed after commit; committed values retained');
    }
  }

  getString(key: string, fallback?: string): string {
    const v = this.cache.get(key);
    return v !== undefined ? v : (fallback as string);
  }

  getNumber(key: string, fallback?: number): number {
    const v = this.cache.get(key);
    if (v === undefined) return fallback ?? NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback ?? NaN;
  }

  getJSON<T = any>(key: string, fallback?: T): T | undefined {
    const v = this.cache.get(key);
    if (v === undefined) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
}
