export type MemoryProviderName = 'native' | 'langgraph';

export type MemoryType =
  | 'messages'
  | 'summary'
  | 'preference'
  | 'fact'
  | 'project'
  | 'skill';

export const MEMORY_TYPES: MemoryType[] = [
  'messages',
  'summary',
  'preference',
  'fact',
  'project',
  'skill',
];

export interface MemoryItem {
  id: string;
  userId: string;
  agentId: string | null;
  namespace: string;
  memoryType: string;
  content: string;
  importance: number;
  metadata: string;
  provider: MemoryProviderName;
  externalId: string;
  providerPayload: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

export type MemoryRow = {
  id: string;
  userId: string;
  agentId: string | null;
  namespace: string;
  memoryType: string;
  content: string;
  importance: number | string;
  metadata: string;
  provider?: MemoryProviderName | string;
  externalId?: string | null;
  providerPayload?: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface MemoryProviderCapabilities {
  provider: MemoryProviderName;
  displayName: string;
  configured: boolean;
  writable: boolean;
  searchable: boolean;
  supportedTypes: MemoryType[];
  note?: string;
}
