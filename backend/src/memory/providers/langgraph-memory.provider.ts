import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateMemoryDto, UpdateMemoryDto } from '../dto/memory.dto';
import { MemoryProvider } from './memory-provider';
import { MemoryItem, MEMORY_TYPES } from '../memory.types';
import { normalizeMemoryType } from '../memory-utils';
import { NativeMemoryProvider } from './native-memory.provider';

type LangGraphStoreValue = {
  content: string;
  memoryType: string;
  importance: number;
  userId: string;
  agentId: string | null;
  namespace: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LangGraphMemoryProvider implements MemoryProvider {
  private readonly logger = new Logger(LangGraphMemoryProvider.name);

  constructor(private readonly nativeProvider: NativeMemoryProvider) {}

  capabilities() {
    const configured = Boolean(this.baseUrl);
    return {
      provider: 'langgraph' as const,
      displayName: 'LangGraph Memory',
      configured,
      writable: configured,
      searchable: configured,
      supportedTypes: MEMORY_TYPES,
      note: configured ? '通过 LangGraph Store 同步，并保留本地镜像' : '需要配置 LANGGRAPH_MEMORY_URL',
    };
  }

  async list(userId: string, agentId?: string): Promise<MemoryItem[]> {
    return this.nativeProvider.list(userId, agentId);
  }

  async create(userId: string, dto: CreateMemoryDto): Promise<MemoryItem> {
    this.assertConfigured();
    const memoryType = normalizeMemoryType(dto.memoryType);
    const namespace = dto.namespace?.trim() || 'default';
    const agentId = dto.agentId ?? null;
    const key = this.key(userId, agentId, namespace, memoryType);
    const value: LangGraphStoreValue = {
      content: dto.content.trim(),
      memoryType,
      importance: dto.importance ?? 3,
      userId,
      agentId,
      namespace,
      metadata: dto.metadata,
    };
    const payload = await this.putStoreItem(this.namespace(userId, agentId, namespace), key, value);
    const externalId = this.externalId(payload) || key;
    return this.nativeProvider.createMirror(
      userId,
      { ...dto, memoryType },
      'langgraph',
      externalId,
      JSON.stringify(payload ?? value),
    );
  }

  async search(userId: string, query: string, agentId?: string, limit = 5): Promise<MemoryItem[]> {
    if (!this.baseUrl) {
      return this.nativeProvider.search(userId, query, agentId, limit);
    }
    try {
      const namespace = this.namespace(userId, agentId ?? null, 'default');
      const results = await this.searchStore(namespace, query, limit);
      const remoteMemories = this.parseSearchResults(userId, agentId, results);
      if (remoteMemories.length > 0) return remoteMemories.slice(0, limit);
    } catch (error) {
      this.logger.warn(`LangGraph memory search failed, fallback to local mirror: ${error instanceof Error ? error.message : String(error)}`);
    }
    return this.nativeProvider.search(userId, query, agentId, limit);
  }

  async update(userId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryItem> {
    this.assertConfigured();
    const current = await this.nativeProvider.getOwned(userId, id);
    const memoryType = normalizeMemoryType(dto.memoryType ?? current.memoryType);
    const namespace = dto.namespace?.trim() || current.namespace;
    const agentId = current.agentId;
    const key = current.externalId || this.key(userId, agentId, namespace, memoryType);
    const value: LangGraphStoreValue = {
      content: dto.content?.trim() || current.content,
      memoryType,
      importance: dto.importance ?? current.importance,
      userId,
      agentId,
      namespace,
      metadata: dto.metadata,
    };
    const payload = await this.putStoreItem(this.namespace(userId, agentId, namespace), key, value);
    return this.nativeProvider.updateProviderMirror(
      userId,
      id,
      { ...dto, memoryType, content: value.content, importance: value.importance, namespace },
      key,
      JSON.stringify(payload ?? value),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.nativeProvider.getOwned(userId, id);
    if (this.baseUrl && current.externalId) {
      try {
        await this.deleteStoreItem(this.namespace(userId, current.agentId, current.namespace), current.externalId);
      } catch (error) {
        this.logger.warn(`LangGraph memory delete failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.nativeProvider.remove(userId, id);
  }

  async removeAll(userId: string, agentId?: string): Promise<number> {
    return this.nativeProvider.removeAll(userId, agentId);
  }

  private get baseUrl(): string {
    return (process.env.LANGGRAPH_MEMORY_URL || process.env.LANGGRAPH_API_URL || '').trim().replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return (process.env.LANGGRAPH_MEMORY_API_KEY || process.env.LANGGRAPH_API_KEY || '').trim();
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new BadRequestException('LangGraph Memory 未配置，请设置 LANGGRAPH_MEMORY_URL');
    }
  }

  private namespace(userId: string, agentId: string | null | undefined, namespace: string): string[] {
    return ['llmgather', userId, agentId || 'global', namespace || 'default'];
  }

  private key(userId: string, agentId: string | null | undefined, namespace: string, memoryType: string): string {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    return `${userId}:${agentId || 'global'}:${namespace}:${memoryType}:${suffix}`;
  }

  private async putStoreItem(namespace: string[], key: string, value: LangGraphStoreValue): Promise<unknown> {
    return this.request('/store/items', {
      method: 'PUT',
      body: JSON.stringify({ namespace, key, value }),
    });
  }

  private async searchStore(namespace: string[], query: string, limit: number): Promise<unknown> {
    return this.request('/store/items/search', {
      method: 'POST',
      body: JSON.stringify({ namespace_prefix: namespace.slice(0, 3), query, limit }),
    });
  }

  private async deleteStoreItem(namespace: string[], key: string): Promise<unknown> {
    return this.request('/store/items', {
      method: 'DELETE',
      body: JSON.stringify({ namespace, key }),
    });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      throw new BadRequestException(`LangGraph Memory 请求失败 (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
    }
    return payload;
  }

  private externalId(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    return String(record.key || record.id || record.itemId || '');
  }

  private parseSearchResults(userId: string, agentId: string | undefined, payload: unknown): MemoryItem[] {
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown> | null)?.items)
        ? (payload as { items: unknown[] }).items
        : [];
    return items.map((item, index) => {
      const record = item as Record<string, unknown>;
      const value = (record.value && typeof record.value === 'object' ? record.value : record) as Record<string, unknown>;
      return {
        id: String(record.key || record.id || `langgraph-${index}`),
        userId,
        agentId: agentId || null,
        namespace: Array.isArray(record.namespace) ? String(record.namespace.at(-1) || 'default') : 'default',
        memoryType: normalizeMemoryType(String(value.memoryType || 'fact')),
        content: String(value.content || value.text || ''),
        importance: Number(value.importance ?? 3),
        metadata: JSON.stringify(value.metadata || {}),
        provider: 'langgraph' as const,
        externalId: String(record.key || record.id || ''),
        providerPayload: JSON.stringify(item),
        createdAt: String(record.created_at || record.createdAt || new Date().toISOString()),
        updatedAt: String(record.updated_at || record.updatedAt || new Date().toISOString()),
        score: Number(record.score ?? 0),
      };
    }).filter((item) => item.content.trim());
  }
}
