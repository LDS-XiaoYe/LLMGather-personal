import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CreateMemoryDto, UpdateMemoryDto } from '../dto/memory.dto';
import { MemoryProvider } from './memory-provider';
import { MemoryItem, MemoryRow, MEMORY_TYPES } from '../memory.types';
import { mapMemory, normalizeMemoryType, recencyBoost, scoreText, terms, typeBoost } from '../memory-utils';

@Injectable()
export class NativeMemoryProvider implements MemoryProvider {
  constructor(private readonly databaseService: DatabaseService) {}

  capabilities() {
    return {
      provider: 'native' as const,
      displayName: '本地记忆',
      configured: true,
      writable: true,
      searchable: true,
      supportedTypes: MEMORY_TYPES,
    };
  }

  async list(userId: string, agentId?: string): Promise<MemoryItem[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, agent_id as agentId, namespace, memory_type as memoryType,
              content, importance, metadata, COALESCE(provider, 'native') as provider,
              external_id as externalId, provider_payload as providerPayload,
              created_at as createdAt, updated_at as updatedAt
       FROM memories
       WHERE user_id = ? AND deleted_at IS NULL AND (? = '' OR agent_id = ? OR agent_id = '')
       ORDER BY importance DESC, updated_at DESC
       LIMIT 100`,
    ).all(userId, agentId ?? '', agentId ?? '') as unknown as MemoryRow[];
    return rows.map((row) => mapMemory(row));
  }

  async create(userId: string, dto: CreateMemoryDto): Promise<MemoryItem> {
    return this.createMirror(userId, dto, 'native');
  }

  async createMirror(
    userId: string,
    dto: CreateMemoryDto,
    provider: 'native' | 'langgraph',
    externalId = '',
    providerPayload = '',
  ): Promise<MemoryItem> {
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO memories
        (id, user_id, agent_id, namespace, memory_type, content, importance, metadata, provider, external_id, provider_payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      dto.agentId ?? '',
      dto.namespace?.trim() || 'default',
      normalizeMemoryType(dto.memoryType),
      dto.content.trim(),
      dto.importance ?? 3,
      dto.metadata ? JSON.stringify(dto.metadata) : '',
      provider,
      externalId,
      providerPayload,
      now,
      now,
    );
    return this.getOwned(userId, id);
  }

  async search(userId: string, query: string, agentId?: string, limit = 5): Promise<MemoryItem[]> {
    const memories = await this.list(userId, agentId);
    const queryTerms = terms(query);
    const now = Date.now();
    return memories
      .map((memory) => ({
        ...memory,
        score: scoreText(memory.content, queryTerms)
          + memory.importance * 1.8
          + typeBoost(memory.memoryType)
          + recencyBoost(memory.updatedAt, now),
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
       SET namespace = ?, memory_type = ?, content = ?, importance = ?, metadata = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(
      dto.namespace?.trim() || current.namespace,
      normalizeMemoryType(dto.memoryType ?? current.memoryType),
      dto.content?.trim() || current.content,
      dto.importance ?? current.importance,
      dto.metadata ? JSON.stringify(dto.metadata) : current.metadata,
      now,
      id,
      userId,
    );
    return this.getOwned(userId, id);
  }

  async updateProviderMirror(
    userId: string,
    id: string,
    dto: UpdateMemoryDto,
    externalId: string,
    providerPayload: string,
  ): Promise<MemoryItem> {
    const updated = await this.update(userId, id, dto);
    await this.databaseService.connection.prepare(
      `UPDATE memories SET provider = ?, external_id = ?, provider_payload = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run('langgraph', externalId, providerPayload, this.databaseService.now(), id, userId);
    return this.getOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(now, now, id, userId);
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

  async getOwned(userId: string, id: string): Promise<MemoryItem> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, agent_id as agentId, namespace, memory_type as memoryType,
              content, importance, metadata, COALESCE(provider, 'native') as provider,
              external_id as externalId, provider_payload as providerPayload,
              created_at as createdAt, updated_at as updatedAt
       FROM memories
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(id, userId) as unknown as MemoryRow | undefined;
    if (!row) throw new NotFoundException('记忆不存在或无权访问');
    return mapMemory(row);
  }
}
