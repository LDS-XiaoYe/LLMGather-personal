import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.reloadAll();
    console.log('[SystemSettings] loaded', Array.from(this.cache.keys()));
  }

  async reloadAll(): Promise<void> {
    const conn = this.db.connection;
    try {
      const rows = (await conn.prepare('SELECT `key`, value FROM system_settings').all()) as Array<{
        key: string;
        value: string;
      }>;
      this.cache.clear();
      for (const r of rows) this.cache.set(r.key, r.value);
    } catch (e) {
      // table might not exist yet during early init — swallow and leave cache empty
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
