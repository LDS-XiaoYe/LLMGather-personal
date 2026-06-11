import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';

export interface MemoryItem {
  id: string;
  userId: string;
  agentId: string | null;
  namespace: string;
  memoryType: string;
  content: string;
  importance: number;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

type MemoryRow = {
  id: string;
  userId: string;
  agentId: string | null;
  namespace: string;
  memoryType: string;
  content: string;
  importance: number | string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class MemoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(userId: string, agentId?: string): Promise<MemoryItem[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, agent_id as agentId, namespace, memory_type as memoryType,
              content, importance, metadata, created_at as createdAt, updated_at as updatedAt
       FROM memories
       WHERE user_id = ? AND deleted_at IS NULL AND (? = '' OR agent_id = ? OR agent_id = '')
       ORDER BY importance DESC, updated_at DESC
       LIMIT 100`,
    ).all(userId, agentId ?? '', agentId ?? '') as unknown as MemoryRow[];
    return rows.map((row) => this.mapMemory(row));
  }

  async create(userId: string, dto: CreateMemoryDto): Promise<MemoryItem> {
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO memories
        (id, user_id, agent_id, namespace, memory_type, content, importance, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      dto.agentId ?? '',
      dto.namespace?.trim() || 'default',
      dto.memoryType ?? 'fact',
      dto.content.trim(),
      dto.importance ?? 3,
      '',
      now,
      now,
    );
    const item = (await this.list(userId, dto.agentId)).find((memory) => memory.id === id);
    return item ?? {
      id,
      userId,
      agentId: dto.agentId ?? null,
      namespace: dto.namespace?.trim() || 'default',
      memoryType: dto.memoryType ?? 'fact',
      content: dto.content.trim(),
      importance: dto.importance ?? 3,
      metadata: '',
      createdAt: now,
      updatedAt: now,
    };
  }

  async search(userId: string, query: string, agentId?: string, limit = 5): Promise<MemoryItem[]> {
    const memories = await this.list(userId, agentId);
    const terms = this.terms(query);
    const now = Date.now();
    return memories
      .map((memory) => ({
        ...memory,
        score: this.score(memory.content, terms)
          + memory.importance * 1.8
          + this.typeBoost(memory.memoryType)
          + this.recencyBoost(memory.updatedAt, now),
      }))
      .filter((memory) => (memory.score ?? 0) > memory.importance || memory.importance >= 4)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  async update(userId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryItem> {
    const current = await this.getOwned(userId, id);
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE memories
       SET namespace = ?, memory_type = ?, content = ?, importance = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(
      dto.namespace?.trim() || current.namespace,
      dto.memoryType ?? current.memoryType,
      dto.content?.trim() || current.content,
      dto.importance ?? current.importance,
      now,
      id,
      userId,
    );
    return this.getOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.databaseService.connection.prepare(
      `UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(this.databaseService.now(), this.databaseService.now(), id, userId);
  }

  async removeAll(userId: string, agentId?: string): Promise<number> {
    const now = this.databaseService.now();
    const result = await this.databaseService.connection.prepare(
      `UPDATE memories
       SET deleted_at = ?, updated_at = ?
       WHERE user_id = ? AND deleted_at IS NULL AND (? = '' OR agent_id = ?)`,
    ).run(now, now, userId, agentId ?? '', agentId ?? '');
    return Number((result as { changes?: number }).changes ?? 0);
  }

  async autoRemember(userId: string, agentId: string, input: string, output: string): Promise<MemoryItem | null> {
    const content = `用户任务: ${input.slice(0, 500)}\nAgent 结果摘要: ${output.slice(0, 800)}`;
    if (content.trim().length < 20) return null;
    return this.create(userId, {
      agentId,
      namespace: 'agent_runs',
      memoryType: 'episode',
      content,
      importance: 2,
    });
  }

  async upsertExtracted(
    userId: string,
    agentId: string,
    item: { content: string; memoryType?: string; importance?: number; namespace?: string; confidence?: number; reason?: string },
  ): Promise<{ action: 'created' | 'updated'; memory: MemoryItem }> {
    const content = item.content.trim();
    const namespace = item.namespace?.trim() || 'agent_profile';
    const memoryType = this.normalizeMemoryType(item.memoryType);
    const importance = Math.max(1, Math.min(5, Number(item.importance ?? 3)));
    const existing = (await this.list(userId, agentId))
      .filter((memory) => memory.namespace === namespace && memory.memoryType === memoryType)
      .map((memory) => ({ memory, similarity: this.similarity(memory.content, content) }))
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (existing && existing.similarity >= 0.42) {
      const updated = await this.update(userId, existing.memory.id, {
        content,
        namespace,
        memoryType: memoryType as 'fact' | 'preference' | 'procedure' | 'episode',
        importance: Math.max(existing.memory.importance, importance),
      });
      return { action: 'updated', memory: updated };
    }

    const memory = await this.create(userId, {
      agentId,
      namespace,
      memoryType: memoryType as 'fact' | 'preference' | 'procedure' | 'episode',
      content,
      importance,
    });
    return { action: 'created', memory };
  }

  async forgetMatching(userId: string, agentId: string, query: string, limit = 5): Promise<MemoryItem[]> {
    const matches = await this.search(userId, query, agentId, limit);
    for (const memory of matches) {
      await this.remove(userId, memory.id);
    }
    return matches;
  }

  private async getOwned(userId: string, id: string): Promise<MemoryItem> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, agent_id as agentId, namespace, memory_type as memoryType,
              content, importance, metadata, created_at as createdAt, updated_at as updatedAt
       FROM memories
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(id, userId) as unknown as MemoryRow | undefined;
    if (!row) throw new NotFoundException('记忆不存在或无权访问');
    return this.mapMemory(row);
  }

  private terms(query: string): string[] {
    const asciiTerms = query.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [];
    const cjkTerms = Array.from(query.matchAll(/[\u3400-\u9fff]{2,}/g)).map((m) => m[0]);
    return Array.from(new Set([...asciiTerms, ...cjkTerms]));
  }

  private score(text: string, terms: string[]): number {
    if (terms.length === 0) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      score += (lower.split(term.toLowerCase()).length - 1) * Math.min(10, term.length);
    }
    return score;
  }

  private typeBoost(memoryType: string): number {
    if (memoryType === 'preference') return 3;
    if (memoryType === 'procedure') return 2;
    if (memoryType === 'fact') return 1.5;
    return 0;
  }

  private recencyBoost(updatedAt: string, now: number): number {
    const timestamp = new Date(String(updatedAt).replace(' ', 'T')).getTime();
    if (!Number.isFinite(timestamp)) return 0;
    const days = Math.max(0, (now - timestamp) / 86400000);
    return Math.max(0, 2 - days / 30);
  }

  private normalizeMemoryType(value?: string): string {
    return ['fact', 'preference', 'procedure', 'episode'].includes(value || '') ? String(value) : 'fact';
  }

  private similarity(a: string, b: string): number {
    const aTerms = new Set(this.terms(a));
    const bTerms = new Set(this.terms(b));
    if (aTerms.size === 0 || bTerms.size === 0) return 0;
    let overlap = 0;
    for (const term of aTerms) {
      if (bTerms.has(term)) overlap++;
    }
    return overlap / Math.max(aTerms.size, bTerms.size);
  }

  private mapMemory(row: MemoryRow): MemoryItem {
    return {
      id: row.id,
      userId: row.userId,
      agentId: row.agentId || null,
      namespace: row.namespace,
      memoryType: row.memoryType,
      content: row.content,
      importance: Number(row.importance),
      metadata: row.metadata ?? '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
