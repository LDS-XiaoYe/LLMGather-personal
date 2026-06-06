import { NotFoundException } from '@nestjs/common';
import { MemoryService } from './memory.service';

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
        const [id, userId, agentId, namespace, memoryType, content, importance, metadata, createdAt, updatedAt] = args;
        rows.push({
          id,
          user_id: userId,
          agent_id: agentId,
          namespace,
          memory_type: memoryType,
          content,
          importance,
          metadata,
          created_at: createdAt,
          updated_at: updatedAt,
          deleted_at: null,
        });
      } else if (sql.includes('SET namespace = ?')) {
        const [namespace, memoryType, content, importance, updatedAt, id, userId] = args;
        const row = rows.find((item) => item.id === id && item.user_id === userId && !item.deleted_at);
        if (row) Object.assign(row, { namespace, memory_type: memoryType, content, importance, updated_at: updatedAt });
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

describe('MemoryService', () => {
  it('creates, lists and searches user-scoped memories', async () => {
    const { db } = makeMemoryDb();
    const service = new MemoryService(db as any);

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
    const service = new MemoryService(db as any);
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
    const service = new MemoryService(db as any);

    const memory = await service.autoRemember(
      'user-1',
      'agent-1',
      '请记住我喜欢保守驾驶策略',
      '已记录，后续会优先选择保守策略。',
    );

    expect(memory?.memoryType).toBe('episode');
    expect(memory?.namespace).toBe('agent_runs');
    expect(memory?.content).toContain('保守驾驶策略');
  });
});
