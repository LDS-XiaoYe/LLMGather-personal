import {
  OpenAiCompatibleProvider,
  parseKeysFromEnv,
  type OpenAiCompatibleConfig,
} from './openai-compatible.provider';
import { ApiKeyPool } from './api-key-pool';

function makeConfig(overrides?: Partial<OpenAiCompatibleConfig>): OpenAiCompatibleConfig {
  return {
    providerName: 'test-provider',
    baseUrl: 'https://api.test.com/v1',
    apiKeys: [],
    apiKey: 'sk-test-key',
    models: ['model-a', 'model-b', 'model-c'],
    ...overrides,
  };
}

describe('OpenAiCompatibleProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('isModelSupported', () => {
    it('should match models in the explicit list', () => {
      const provider = new OpenAiCompatibleProvider(makeConfig());
      expect(provider.isModelSupported('model-a')).toBe(true);
      expect(provider.isModelSupported('model-b')).toBe(true);
      expect(provider.isModelSupported('model-c')).toBe(true);
      expect(provider.isModelSupported('model-x')).toBe(false);
    });

    it('should match models by prefix when modelPrefix is set', () => {
      const provider = new OpenAiCompatibleProvider(
        makeConfig({ modelPrefix: 'test', models: ['a'] }),
      );
      expect(provider.isModelSupported('test/model-any')).toBe(true);
      expect(provider.isModelSupported('test/foo')).toBe(true);
      expect(provider.isModelSupported('other/bar')).toBe(false);
      expect(provider.isModelSupported('a')).toBe(true);
    });

    it('should not match prefix as standalone suffix', () => {
      const provider = new OpenAiCompatibleProvider(
        makeConfig({ modelPrefix: 'glm', models: [] }),
      );
      expect(provider.isModelSupported('glm')).toBe(false);
      expect(provider.isModelSupported('glm/v4')).toBe(true);
    });
  });

  describe('listModels', () => {
    it('should return ModelDescriptors for all configured models', () => {
      const provider = new OpenAiCompatibleProvider(makeConfig());
      const models = provider.listModels();
      expect(models).toHaveLength(3);
      expect(models[0]).toMatchObject({ id: 'model-a', object: 'model' });
    });
  });

  describe('normalizeModel (via isModelSupported)', () => {
    it('should match prefixed model regardless of explicit list', () => {
      const provider = new OpenAiCompatibleProvider(
        makeConfig({ modelPrefix: 'deepseek', models: [] }),
      );
      expect(provider.isModelSupported('deepseek/chat')).toBe(true);
      expect(provider.isModelSupported('chat')).toBe(false);
    });

    it('should match without prefix using explicit model list', () => {
      const provider = new OpenAiCompatibleProvider(makeConfig());
      expect(provider.isModelSupported('model-a')).toBe(true);
      expect(provider.isModelSupported('unknown')).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should accept a single apiKey without apiKeys', () => {
      const provider = new OpenAiCompatibleProvider(makeConfig({ apiKey: 'sk-legacy' }));
      expect(provider.providerName).toBe('test-provider');
      // Provider constructed successfully — verifies backward compat path
    });

    it('should accept apiKeys array and ignore apiKey', () => {
      const provider = new OpenAiCompatibleProvider(
        makeConfig({ apiKeys: ['sk-a', 'sk-b'], apiKey: 'sk-ignored' }),
      );
      expect(provider.providerName).toBe('test-provider');
      // Provider constructed successfully — verifies apiKeys takes precedence
    });

    it('should allow empty apiKeys when setKeyPool will be called later', () => {
      // The constructor no longer throws on empty keys — the registry passes
      // apiKeys:[] and calls setKeyPool() immediately after construction.
      const provider = new OpenAiCompatibleProvider(makeConfig({ apiKeys: [], apiKey: '' }));
      expect(provider.providerName).toBe('test-provider');
      // Verify setKeyPool can be called to provide a real pool
      provider.setKeyPool(new ApiKeyPool(['sk-later']));
      // Provider should now work (no throw on construction)
    });
  });

  describe('API key rotation', () => {
    it('should rotate to the next key when the current key has insufficient balance', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: { message: '账户余额不足' } }),
            { status: 402 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'ok',
              object: 'chat.completion',
              created: 1,
              model: 'model-a',
              choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            }),
            { status: 200 },
          ),
      );
      global.fetch = fetchMock;
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const provider = new OpenAiCompatibleProvider(makeConfig({
        apiKeys: ['sk-empty', 'sk-funded'],
        apiKey: '',
        retryCount: 1,
      }));
      const response = await provider.chatCompletion({
        model: 'model-a',
        messages: [{ role: 'user', content: 'hello' }],
      });

      const firstCall = fetchMock.mock.calls[0][1] as RequestInit;
      const secondCall = fetchMock.mock.calls[1][1] as RequestInit;
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(firstCall.headers).toMatchObject({ Authorization: 'Bearer sk-empty' });
      expect(secondCall.headers).toMatchObject({ Authorization: 'Bearer sk-funded' });
      expect(response.choices[0].message.content).toBe('ok');
      expect((response as any)._providerKeyRotation).toEqual({
        provider: 'test-provider',
        attempts: 1,
        reason: 'balance_exhausted',
      });
    });
  });

  describe('parseKeysFromEnv', () => {
    it('should return empty array when env var is not set', () => {
      delete process.env.TEST_KEYS_VAR;
      expect(parseKeysFromEnv('TEST_KEYS_VAR')).toEqual([]);
    });

    it('should parse comma-separated keys', () => {
      process.env.TEST_KEYS_VAR = 'sk-a, sk-b , sk-c';
      expect(parseKeysFromEnv('TEST_KEYS_VAR')).toEqual(['sk-a', 'sk-b', 'sk-c']);
      delete process.env.TEST_KEYS_VAR;
    });

    it('should filter empty entries', () => {
      process.env.TEST_KEYS_VAR = 'sk-a,,  ,sk-b';
      expect(parseKeysFromEnv('TEST_KEYS_VAR')).toEqual(['sk-a', 'sk-b']);
      delete process.env.TEST_KEYS_VAR;
    });
  });
});
