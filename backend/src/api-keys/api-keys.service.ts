import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';

export interface ApiKeyRow {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** 生成 sk- 开头的 API Key */
  private generateRawKey(): string {
    const bytes = randomBytes(24);
    return 'sk-' + bytes.toString('base64url');
  }

  /** 对 key 做简单 hash 存储（防止数据库泄露后 key 可直接使用） */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /** 创建 API Key，返回完整 key（仅在创建时可见） */
  async create(userId: string, name: string): Promise<{ id: string; name: string; key: string; rawKey: string; createdAt: string }> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 7); // "sk-xxxx"
    const id = randomUUID();
    const createdAt = this.databaseService.now();

    const db = this.databaseService.connection;
    await db.prepare(
      'INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, userId, name, keyHash, keyPrefix, createdAt);

    return {
      id,
      name,
      key: rawKey.slice(0, 7) + '...' + rawKey.slice(-4), // masked
      rawKey, // full key, only returned once
      createdAt,
    };
  }

  /** 列出用户所有 Key（脱敏） */
  async listByUser(userId: string): Promise<Array<{ id: string; name: string; key: string; createdAt: string }>> {
    const db = this.databaseService.connection;
    const rows = await db.prepare(
      'SELECT id, name, key_prefix as keyPrefix, created_at as createdAt FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    ).all(userId) as Array<{ id: string; name: string; keyPrefix: string; createdAt: string }>;
    return rows.map(r => ({ id: r.id, name: r.name, key: r.keyPrefix + '...', createdAt: r.createdAt }));
  }

  /** 删除 Key */
  async revoke(userId: string, keyId: string): Promise<void> {
    const db = this.databaseService.connection;
    const row = await db.prepare('SELECT id FROM api_keys WHERE id = ? AND user_id = ?').get(keyId, userId) as { id: string } | undefined;
    if (!row) throw new NotFoundException('API Key 不存在');
    await db.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId);
  }

  /** 通过 raw key 验证并返回用户身份（用于中转 API 认证） */
  async validateKey(rawKey: string): Promise<{ userId: string; username: string; role: string } | null> {
    if (!rawKey || !rawKey.startsWith('sk-')) return null;
    const keyHash = this.hashKey(rawKey);
    const db = this.databaseService.connection;
    const row = await db.prepare(
      `SELECT ak.user_id as userId, COALESCE(u.username, '') as username, COALESCE(u.role, 'user') as role
       FROM api_keys ak
       LEFT JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = ?`,
    ).get(keyHash) as { userId: string; username: string; role: string } | undefined;
    return row ?? null;
  }
}
