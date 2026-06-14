import { CreateMemoryDto, UpdateMemoryDto } from '../dto/memory.dto';
import { MemoryItem, MemoryProviderCapabilities } from '../memory.types';

export interface MemoryProvider {
  capabilities(): MemoryProviderCapabilities;
  list(userId: string, agentId?: string): Promise<MemoryItem[]>;
  create(userId: string, dto: CreateMemoryDto): Promise<MemoryItem>;
  search(userId: string, query: string, agentId?: string, limit?: number): Promise<MemoryItem[]>;
  update(userId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryItem>;
  remove(userId: string, id: string): Promise<void>;
  removeAll(userId: string, agentId?: string): Promise<number>;
}
