import { Injectable } from '@nestjs/common';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';
import { LangGraphMemoryProvider } from './providers/langgraph-memory.provider';
import { NativeMemoryProvider } from './providers/native-memory.provider';
import { MemoryProvider } from './providers/memory-provider';
import { MemoryItem, MemoryProviderCapabilities, MemoryProviderName } from './memory.types';
import { normalizeMemoryType, similarity } from './memory-utils';

@Injectable()
export class MemoryService {
  constructor(
    private readonly nativeProvider: NativeMemoryProvider,
    private readonly langGraphProvider: LangGraphMemoryProvider,
  ) {}

  getProviderName(): MemoryProviderName {
    return process.env.MEMORY_PROVIDER === 'langgraph' ? 'langgraph' : 'native';
  }

  capabilities(): MemoryProviderCapabilities[] {
    return [this.nativeProvider.capabilities(), this.langGraphProvider.capabilities()];
  }

  async list(userId: string, agentId?: string): Promise<MemoryItem[]> {
    return this.provider().list(userId, agentId);
  }

  async create(userId: string, dto: CreateMemoryDto): Promise<MemoryItem> {
    return this.provider().create(userId, dto);
  }

  async search(userId: string, query: string, agentId?: string, limit = 5, memoryType?: string): Promise<MemoryItem[]> {
    const results = await this.provider().search(userId, query, agentId, limit * 2);
    const normalizedType = memoryType ? normalizeMemoryType(memoryType) : '';
    return results
      .filter((memory) => !normalizedType || memory.memoryType === normalizedType)
      .slice(0, limit);
  }

  async update(userId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryItem> {
    return this.provider().update(userId, id, dto);
  }

  async remove(userId: string, id: string): Promise<void> {
    return this.provider().remove(userId, id);
  }

  async removeAll(userId: string, agentId?: string): Promise<number> {
    return this.provider().removeAll(userId, agentId);
  }

  async autoRemember(userId: string, agentId: string, input: string, output: string): Promise<MemoryItem | null> {
    const content = `用户输入: ${input.slice(0, 500)}\nAgent 输出摘要: ${output.slice(0, 800)}`;
    if (content.trim().length < 20) return null;
    return this.create(userId, {
      agentId,
      namespace: 'conversation',
      memoryType: 'messages',
      content,
      importance: 2,
      metadata: { source: 'agent_run' },
    });
  }

  async upsertExtracted(
    userId: string,
    agentId: string,
    item: { content: string; memoryType?: string; importance?: number; namespace?: string; confidence?: number; reason?: string },
  ): Promise<{ action: 'created' | 'updated'; memory: MemoryItem }> {
    const content = item.content.trim();
    const namespace = item.namespace?.trim() || this.defaultNamespace(item.memoryType);
    const memoryType = normalizeMemoryType(item.memoryType);
    const importance = Math.max(1, Math.min(5, Number(item.importance ?? 3)));
    const existing = (await this.list(userId, agentId))
      .filter((memory) => {
        const sameScope = agentId ? memory.agentId === agentId : !memory.agentId;
        return sameScope && memory.namespace === namespace && memory.memoryType === memoryType;
      })
      .map((memory) => ({ memory, similarity: similarity(memory.content, content) }))
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (existing && existing.similarity >= 0.42) {
      const updated = await this.update(userId, existing.memory.id, {
        content,
        namespace,
        memoryType,
        importance: Math.max(existing.memory.importance, importance),
        metadata: { confidence: item.confidence, reason: item.reason },
      });
      return { action: 'updated', memory: updated };
    }

    const memory = await this.create(userId, {
      agentId,
      namespace,
      memoryType,
      content,
      importance,
      metadata: { confidence: item.confidence, reason: item.reason },
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

  private provider(): MemoryProvider {
    return this.getProviderName() === 'langgraph' ? this.langGraphProvider : this.nativeProvider;
  }

  private defaultNamespace(memoryType?: string): string {
    const type = normalizeMemoryType(memoryType);
    if (type === 'messages' || type === 'summary') return 'conversation';
    if (type === 'preference') return 'user_profile';
    if (type === 'project') return 'project_context';
    if (type === 'skill') return 'agent_skills';
    return 'facts';
  }
}

export { MemoryItem } from './memory.types';
