import { MemoryItem, MemoryRow, MemoryType, MEMORY_TYPES } from './memory.types';

export function normalizeMemoryType(value?: string): MemoryType {
  if (value === 'episode') return 'messages';
  if (value === 'procedure') return 'skill';
  return MEMORY_TYPES.includes(value as MemoryType) ? value as MemoryType : 'fact';
}

export function terms(query: string): string[] {
  const asciiTerms = query.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [];
  const cjkTerms = Array.from(query.matchAll(/[\u3400-\u9fff]{2,}/g)).map((m) => m[0]);
  return Array.from(new Set([...asciiTerms, ...cjkTerms]));
}

export function scoreText(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    score += (lower.split(term.toLowerCase()).length - 1) * Math.min(10, term.length);
  }
  return score;
}

export function typeBoost(memoryType: string): number {
  if (memoryType === 'preference') return 3;
  if (memoryType === 'skill') return 2.5;
  if (memoryType === 'project') return 2;
  if (memoryType === 'fact') return 1.5;
  if (memoryType === 'summary') return 1.2;
  return 0;
}

export function recencyBoost(updatedAt: string, now: number): number {
  const timestamp = new Date(String(updatedAt).replace(' ', 'T')).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const days = Math.max(0, (now - timestamp) / 86400000);
  return Math.max(0, 2 - days / 30);
}

export function similarity(a: string, b: string): number {
  const aTerms = new Set(terms(a));
  const bTerms = new Set(terms(b));
  if (aTerms.size === 0 || bTerms.size === 0) return 0;
  let overlap = 0;
  for (const term of aTerms) {
    if (bTerms.has(term)) overlap++;
  }
  return overlap / Math.max(aTerms.size, bTerms.size);
}

export function mapMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    userId: row.userId,
    agentId: row.agentId || null,
    namespace: row.namespace,
    memoryType: normalizeMemoryType(row.memoryType),
    content: row.content,
    importance: Number(row.importance),
    metadata: row.metadata ?? '',
    provider: row.provider === 'langgraph' ? 'langgraph' : 'native',
    externalId: row.externalId || '',
    providerPayload: row.providerPayload || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
