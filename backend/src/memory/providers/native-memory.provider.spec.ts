import { NativeMemoryProvider } from './native-memory.provider';
import { MemoryService } from '../memory.service';

describe('MySQL primary memory and optional semantic retrieval', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const memory = { id: 'id', content: 'database text', memoryType: 'fact', importance: 3, score: 1 };
  function fixture() {
    const native = { search: jest.fn(async () => [memory]), create: jest.fn(async () => memory), capabilities: jest.fn(() => ({provider: 'native'})) };
    const index = { search: jest.fn(async () => [memory]), rebuild: jest.fn() };
    return { native, index, service: new MemoryService(native as never, index as never) };
  }
  it('always uses MySQL even when obsolete environment selects LangGraph', async () => {
    process.env.MEMORY_PROVIDER = 'langgraph';
    const { service, native, index } = fixture();
    expect(service.getProviderName()).toBe('native');
    expect(service.capabilities()).toEqual([{provider: 'native'}]);
    await service.create('user', {content: 'text'});
    expect(native.create).toHaveBeenCalled();
    expect(index.search).not.toHaveBeenCalled();
  });
  it('disabled index never calls embedding/vector search', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED = 'false';
    const { service, index } = fixture();
    expect(await service.search('u','q','a',5,'episode')).toEqual([memory]);
    expect(index.search).not.toHaveBeenCalled();
    expect(service.retrievalCapabilities().searchMode).toBe('keyword');
  });
  it('enabled hybrid fuses by UUID and passes type into both searches before limiting', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED = 'true';
    const { service, native, index } = fixture();
    const results = await service.search('u','q','a',5,'episode');
    expect(results).toHaveLength(1);
    expect(native.search).toHaveBeenCalledWith('u','q','a',10,'messages');
    expect(index.search).toHaveBeenCalledWith('u','q','a',10,'messages');
  });
  it('unavailable or empty semantic retrieval falls back without breaking memory CRUD', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED = 'true';
    const { service, index } = fixture();
    index.search.mockRejectedValueOnce(new Error('offline'));
    expect(await service.search('u','q')).toEqual([memory]);
    index.search.mockResolvedValueOnce([]);
    expect(await service.search('u','q')).toEqual([memory]);
    expect(await service.create('u',{content:'saved while index offline'})).toEqual(memory);
  });
  it('keyword matches are ranked in SQL rather than read from the first 100 UI records', async () => {
    const all = jest.fn(async (..._args: unknown[]) => []), prepare = jest.fn((_sql: string) => ({all}));
    const native = new NativeMemoryProvider({connection:{prepare}} as never);
    await native.search('u','oldneedle','a',5,'skill');
    expect(prepare.mock.calls[0][0]).toContain('ORDER BY keywordMatches DESC');
    expect(prepare.mock.calls[0][0]).toContain('memory_type = ?');
    expect(prepare.mock.calls[0][0]).not.toContain('LIMIT 100');
    expect(all).toHaveBeenCalledWith('oldneedle','u','a','a','skill','skill');
  });
});
