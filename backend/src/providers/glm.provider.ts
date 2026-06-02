import {
  OpenAiCompatibleConfig,
  OpenAiCompatibleProvider,
  parseKeysFromEnv,
} from './openai-compatible.provider';

export class GlmProvider extends OpenAiCompatibleProvider {
  constructor() {
    // Priority: GLM_API_KEYS > GLM_API_KEY > DASHSCOPE_API_KEYS > DASHSCOPE_API_KEY > QWEN_API_KEY
    const primaryKeys = parseKeysFromEnv('GLM_API_KEYS');
    const fallbackKeys = parseKeysFromEnv('DASHSCOPE_API_KEYS');
    const singleKey =
      process.env.GLM_API_KEY ||
      process.env.DASHSCOPE_API_KEY ||
      process.env.QWEN_API_KEY ||
      '';

    const allKeys =
      primaryKeys.length > 0
        ? primaryKeys
        : fallbackKeys.length > 0
          ? fallbackKeys
          : singleKey
            ? [singleKey]
            : [];

    const config: OpenAiCompatibleConfig = {
      providerName: 'glm',
      baseUrl:
        process.env.GLM_BASE_URL ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKeys: allKeys,
      apiKey: singleKey,
      models: (process.env.GLM_MODELS || 'glm-5,glm-5.1')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      timeoutMs: Number(process.env.GLM_TIMEOUT_MS || 25000),
      retryCount: Number(process.env.GLM_RETRY_COUNT || 2),
    };

    super(config);
  }
}
