import { KnowledgeService } from './knowledge.service';
describe('RAGFlow compatibility and provider rank fusion', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  function service() {
    const config = { baseUrl: 'http://ragflow.test', apiKey: 'unit-secret', datasetId: 'dataset' };
    const db = {
      connection: {
        prepare: jest.fn(() => ({
          all: jest.fn(async () => [
            { id: 'native', userId: 'u', provider: 'native', name: 'native' },
            {
              id: 'rag',
              userId: 'u',
              provider: 'ragflow',
              name: 'rag',
              externalId: 'dataset',
              engineConfigJson: JSON.stringify(config),
            },
          ]),
          get: jest.fn(async () => ({ engineConfigJson: JSON.stringify(config), externalId: 'dataset' })),
        })),
      },
    };
    const native = {
      searchDetailed: jest.fn(async () => ({ data: [
        { id: 'n', kbId: 'native', documentId: 'd', title: 'native', content: 'native content', score: 10000 },
      ], meta: { requestedMode: 'hybrid', effectiveMode: 'hybrid', degraded: false, warnings: [] } })),
    };
    return new KnowledgeService(db as never, native as never, {} as never, {} as never, {} as never);
  }
  it('awaits asynchronous MySQL configuration and preserves retrieval contract', async () => {
    const request = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: 0,
          data: {
            chunks: [
              { id: 'r', document_id: 'doc', document_name: 'rag title', content: 'rag content', similarity: 0.01 },
            ],
          },
        }),
    }));
    global.fetch = request as unknown as typeof fetch;
    const result = await service().search('u', ['native', 'rag'], 'query', 5, { mode: 'hybrid' });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 'n')!.score).toBeCloseTo(result.find((r) => r.id === 'r')!.score);
    expect(request.mock.calls[0][0]).toBe('http://ragflow.test/api/v1/retrieval');
    const init = request.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).dataset_ids).toEqual(['dataset']);
    expect(JSON.parse(String(init.body)).vector_similarity_weight).toBe(0.3);
    expect(JSON.parse(String(init.body)).keywords_similarity_weight).toBe(0.7);
    expect(result.find(r => r.id === 'r')!.externalScore).toBe(0.01);
  });
  it('propagates external failures rather than returning fake success', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => '' })) as unknown as typeof fetch;
    await expect(service().search('u', ['native', 'rag'], 'query')).rejects.toThrow('503');
  });
  it('retains native results and original scores when external engine is down in production', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => '' })) as unknown as typeof fetch;
    const result = await service().searchDetailed('u', ['native', 'rag'], 'query', 5, { failurePolicy: 'degrade' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].score).toBe(10000);
    expect(result.meta).toMatchObject({ degraded: true, warnings: [{ kbId: 'rag', stage: 'external' }] });
  });
  it.each([['keyword', 0], ['vector', 1]] as const)('forwards %s mode to external API', async (mode, weight) => {
    const request = jest.fn(async () => ({ ok: true, text: async () => JSON.stringify({ code: 0, data: { chunks: [] } }) }));
    global.fetch = request as unknown as typeof fetch;
    await service().search('u', ['native', 'rag'], 'query', 5, { mode });
    const payload = JSON.parse(String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(payload.vector_similarity_weight).toBe(weight);
    expect(payload.keywords_similarity_weight).toBe(1-weight);
  });
});
