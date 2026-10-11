import { EmbeddingService } from './embedding.service';
describe('OpenAI compatible embedding adapter', () => {
  const env = { ...process.env };
  const fetchOriginal = global.fetch;
  beforeEach(() => {
    process.env.EMBEDDING_BASE_URL = 'http://embedding.test/v1';
    process.env.EMBEDDING_MODEL = 'test-model';
    process.env.EMBEDDING_DIMENSIONS = '3';
    process.env.EMBEDDING_BATCH_SIZE = '2';
    process.env.EMBEDDING_RETRIES = '0';
    delete process.env.EMBEDDING_PROVIDER_NAME;
  });
  afterEach(() => {
    process.env = { ...env };
    global.fetch = fetchOriginal;
  });
  it('batches real API contracts and reorders response indices', async () => {
    const mock = jest.fn(async (_url, init) => {
      const inputs = JSON.parse(init.body).input;
      return {
        ok: true,
        json: async () => ({ data: inputs.map((_, index) => ({ index, embedding: [1, 2, 3] })).reverse() }),
      };
    });
    global.fetch = mock as unknown as typeof fetch;
    expect(await new EmbeddingService({} as never).embed(['a', 'b', 'c'])).toEqual([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('rejects output dimensions, missing/duplicate indices, and non-finite values', async () => {
    for (const data of [
      [{ index: 0, embedding: [1, 2] }],
      [{ index: 1, embedding: [1, 2, 3] }],
      [{ index: 0, embedding: [NaN, 2, 3] }],
    ]) {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data }) })) as unknown as typeof fetch;
      await expect(new EmbeddingService({} as never).embed(['a'])).rejects.toThrow('mismatch');
    }
  });
  it('rejects incompatible fingerprints before sending a request', async () => {
    const provider = new EmbeddingService({} as never);
    const descriptor = await provider.describe();
    process.env.EMBEDDING_MODEL = 'different-model';
    global.fetch = jest.fn();
    await expect(provider.embed(['a'], descriptor)).rejects.toThrow('vector space changed');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('does not expose response bodies or keys on API errors', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'secret-key',
    })) as unknown as typeof fetch;
    await expect(new EmbeddingService({} as never).embed(['a'])).rejects.toThrow('Embedding API HTTP 401');
  });
  it('reuses managed provider authentication without consuming a key for describe', async () => {
    process.env.EMBEDDING_PROVIDER_NAME = 'managed';
    delete process.env.EMBEDDING_BASE_URL;
    const pool = { getKey: jest.fn(() => 'unit-key'), markSuccess: jest.fn() };
    const providers = {
      getConfig: jest.fn(async () => ({
        enabled: true,
        baseUrl: 'https://embedding.test/v1',
        authHeader: 'Authorization',
        authPrefix: 'Bearer',
      })),
      getPool: jest.fn(() => pool),
    };
    const provider = new EmbeddingService(providers as never);
    await provider.describe();
    expect(pool.getKey).not.toHaveBeenCalled();
    const request = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
    }));
    global.fetch = request as unknown as typeof fetch;
    await provider.embed(['a']);
    expect(request.mock.calls[0][1]!.headers).toMatchObject({ Authorization: 'Bearer unit-key' });
    expect(pool.markSuccess).toHaveBeenCalledWith('unit-key');
  });
});
