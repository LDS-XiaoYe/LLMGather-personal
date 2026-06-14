import { NotFoundException } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { NativeMemoryProvider } from './providers/native-memory.provider';
import { LangGraphMemoryProvider } from './providers/langgraph-memory.provider';

type MemoryRow = Record<string, any>;

function makeMemoryDb() {
  const rows: MemoryRow[] = [];
  const now = jest.fn(() => '2026-06-06 12:00:00.000');
  const prepare = jest.fn((sql: string) => ({
    all: jest.fn(async (userId: string, agentFilter = '', agentFilter2 = '') => rows
      .filter((row) => row.user_id === userId && !row.deleted_at)
      .filter((row) => !agentFilter || row.agent_id === agentFilter2 || row.agent_id === '')
      .sort((a, b) => b.importance - a.importance || String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 100)
      .map(toSelectRow)),
    get: jest.fn(async (id: string, userId: string) => {
      const row = rows.find((item) => item.id === id && item.user_id === userId && !item.deleted_at);
      return row ? toSelectRow(row) : undefined;
    }),
    run: jest.fn(async (...args: any[]) => {
      if (sql.includes('INSERT INTO memories')) {
        const [id, userId, agentId, namespace, memoryType, content, importance, metadata, provider, externalId, providerPayload, createdAt, updatedAt] = args;
        rows.push({
          id,
          user_id: userId,
          agent_id: agentId,
          namespace,
          memory_type: memoryType,
          content,
          importance,
          metadata,
          provider,
          external_id: externalId,
          provider_payload: providerPayload,
          created_at: createdAt,
          updated_at: updatedAt,
          deleted_at: null,
        });
      } else if (sql.includes('SET namespace = ?')) {
        const [namespace, memoryType, content, importance, metadata, updatedAt, id, userId] = args;
        const row = rows.find((item) => item.id === id && item.user_id === userId && !item.deleted_at);
        if (row) Object.assign(row, { namespace, memory_type: memoryType, content, importance, metadata, updated_at: updatedAt });
      } else if (sql.includes('SET deleted_at = ?')) {
        const [deletedAt, updatedAt, id, userId] = args;
        const row = rows.find((item) => item.id === id && item.user_id === userId && !item.deleted_at);
        if (row) Object.assign(row, { deleted_at: deletedAt, updated_at: updatedAt });
      }
    }),
  }));
  return {
    rows,
    db: {
      now,
      connection: { prepare },
    },
  };
}

function toSelectRow(row: MemoryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    namespace: row.namespace,
    memoryType: row.memory_type,
    content: row.content,
    importance: row.importance,
    metadata: row.metadata,
    provider: row.provider ?? 'native',
    externalId: row.external_id ?? '',
    providerPayload: row.provider_payload ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function makeService(db: any) {
  const native = new NativeMemoryProvider(db);
  const langgraph = new LangGraphMemoryProvider(native);
  return new MemoryService(native, langgraph);
}

describe('MemoryService', () => {
  it('creates, lists and searches user-scoped memories', async () => {
    const { db } = makeMemoryDb();
    const service = makeService(db as any);

    const item = await service.create('user-1', {
      agentId: 'agent-1',
      namespace: 'manual',
      memoryType: 'preference',
      content: '用户喜欢自动驾驶仿真使用夜雨场景。',
      importance: 5,
    });

    expect(item.content).toContain('夜雨');
    await service.create('user-2', {
      agentId: 'agent-1',
      content: '其他用户的记忆不可见',
      importance: 5,
    });

    const list = await service.list('user-1', 'agent-1');
    expect(list).toHaveLength(1);
    const search = await service.search('user-1', '夜雨 自动驾驶', 'agent-1');
    expect(search[0].id).toBe(item.id);
    expect(search[0].score).toBeGreaterThan(item.importance);
  });

  it('updates and soft-deletes memories by owner', async () => {
    const { db } = makeMemoryDb();
    const service = makeService(db as any);
    const item = await service.create('user-1', {
      agentId: 'agent-1',
      content: '旧偏好',
      importance: 2,
    });

    const updated = await service.update('user-1', item.id, {
      content: '用户偏好 OpenPilot 风格的 FCW 测试。',
      memoryType: 'preference',
      importance: 4,
    });

    expect(updated.memoryType).toBe('preference');
    expect(updated.importance).toBe(4);
    expect(updated.content).toContain('FCW');

    await expect(service.update('user-2', item.id, { content: '越权' })).rejects.toBeInstanceOf(NotFoundException);
    await service.remove('user-1', item.id);
    await expect(service.update('user-1', item.id, { content: '删除后不可更新' })).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.search('user-1', 'FCW', 'agent-1')).toHaveLength(0);
  });

  it('auto-remembers useful agent episodes', async () => {
    const { db } = makeMemoryDb();
    const service = makeService(db as any);

    const memory = await service.autoRemember(
      'user-1',
      'agent-1',
      '请记住我喜欢保守驾驶策略',
      '已记录，后续会优先选择保守策略。',
    );

    expect(memory?.memoryType).toBe('messages');
    expect(memory?.namespace).toBe('conversation');
    expect(memory?.content).toContain('保守驾驶策略');
  });
});

describe('LangGraphMemoryProvider', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LANGGRAPH_MEMORY_URL;
  const originalAssistantId = process.env.LANGGRAPH_MEMORY_ASSISTANT_ID;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.LANGGRAPH_MEMORY_URL;
    } else {
      process.env.LANGGRAPH_MEMORY_URL = originalUrl;
    }
    if (originalAssistantId === undefined) {
      delete process.env.LANGGRAPH_MEMORY_ASSISTANT_ID;
    } else {
      process.env.LANGGRAPH_MEMORY_ASSISTANT_ID = originalAssistantId;
    }
  });

  it('writes memory through the real LangGraph memory graph before mirroring locally', async () => {
    const { db } = makeMemoryDb();
    const native = new NativeMemoryProvider(db as any);
    const provider = new LangGraphMemoryProvider(native);
    process.env.LANGGRAPH_MEMORY_URL = 'http://langgraph-memory:2024';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'succeeded',
        result: {
          key: 'remote-key-1',
          namespace: ['llmgather', 'user-1', 'global', 'default'],
          value: {
            content: '用户喜欢简洁回答',
            memoryType: 'preference',
            importance: 4,
            userId: 'user-1',
            agentId: null,
            namespace: 'default',
          },
        },
      }),
    }));
    global.fetch = fetchMock as any;

    const item = await provider.create('user-1', {
      content: '用户喜欢简洁回答',
      memoryType: 'preference',
      importance: 4,
    });

    expect(item.provider).toBe('langgraph');
    expect(item.externalId).toBe('remote-key-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://langgraph-memory:2024/runs/wait');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.assistant_id).toBe('memory');
    expect(body.input.operation).toBe('put');
    expect(body.input.value.content).toBe('用户喜欢简洁回答');
  });

  it('reads graph search results without marking global memory as agent-specific', async () => {
    const { db } = makeMemoryDb();
    const native = new NativeMemoryProvider(db as any);
    const provider = new LangGraphMemoryProvider(native);
    process.env.LANGGRAPH_MEMORY_URL = 'http://langgraph-memory:2024';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'succeeded',
        results: [
          {
            key: 'global-pref-1',
            namespace: ['llmgather', 'user-1', 'global', 'default'],
            value: {
              content: '用户喜欢 Markdown 表格',
              memoryType: 'preference',
              importance: 5,
            },
            score: 0.9,
          },
        ],
      }),
    }));
    global.fetch = fetchMock as any;

    const results = await provider.search('user-1', '表格', 'agent-1', 5);

    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBeNull();
    expect(results[0].content).toContain('Markdown 表格');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.input.operation).toBe('search');
    expect(body.input.includeGlobal).toBe(true);
  });
});
