import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateMemoryDto } from './dto/memory.dto';

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
    return memories
      .map((memory) => ({
        ...memory,
        score: this.score(memory.content, terms) + memory.importance,
      }))
      .filter((memory) => (memory.score ?? 0) > memory.importance || memory.importance >= 4)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
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
