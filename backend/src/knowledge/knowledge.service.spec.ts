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
      search: jest.fn(async () => [
        { id: 'n', kbId: 'native', documentId: 'd', title: 'native', content: 'native content', score: 10000 },
      ]),
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
  });
  it('propagates external failures rather than returning fake success', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => '' })) as unknown as typeof fetch;
    await expect(service().search('u', ['native', 'rag'], 'query')).rejects.toThrow('503');
  });
});
