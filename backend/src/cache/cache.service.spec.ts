import { CacheService } from './cache.service';
import { IDatabaseAdapter } from '../database/database.adapter.interface';

function makeDb(row: Record<string, unknown>): { connection: IDatabaseAdapter } {
  const run = jest.fn().mockResolvedValue({ changes: 1 });
  const get = jest.fn().mockResolvedValue(row);
  const all = jest.fn().mockResolvedValue([]);
  const prepare = jest.fn().mockReturnValue({ run, get, all });

  return {
    connection: {
      exec: jest.fn(),
      prepare,
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn(),
    },
  } as unknown as { connection: IDatabaseAdapter };
}

describe('CacheService', () => {
  it('maps snake_case SQL rows before semantic similarity checks', async () => {
    const entry = await new CacheService(makeDb({
      id: 'cache-1',
      query_hash: 'hash',
      query_text: 'Explain how AI works in a few words',
      model: 'gemini-3.5-flash',
      response: 'AI learns patterns and predicts useful outputs.',
      tokens_saved: 12,
      cost_saved: 0,
      hit_count: 1,
      created_at: '2026-06-04 00:00:00.000',
      last_hit_at: '2026-06-04 00:00:00.000',
    }) as any).lookup('Explain how AI works in a few words', 'gemini-3.5-flash');

    expect(entry?.queryText).toBe('Explain how AI works in a few words');
    expect(entry?.response).toBe('AI learns patterns and predicts useful outputs.');
  });
});
