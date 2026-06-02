import {
  OpenAiCompatibleConfig,
  OpenAiCompatibleProvider,
  parseKeysFromEnv,
} from './openai-compatible.provider';

export class XiaomiProvider extends OpenAiCompatibleProvider {
  constructor() {
    // Priority: XIAOMI_API_KEYS > XIAOMI_API_KEY > DASHSCOPE_API_KEYS > DASHSCOPE_API_KEY > QWEN_API_KEY
    const primaryKeys = parseKeysFromEnv('XIAOMI_API_KEYS');
    const fallbackKeys = parseKeysFromEnv('DASHSCOPE_API_KEYS');
    const singleKey =
      process.env.XIAOMI_API_KEY ||
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
      providerName: 'xiaomi-mimo',
      modelPrefix: 'mimo',
      baseUrl:
        process.env.XIAOMI_BASE_URL || 'https://api.xiaomi.example/v1',
      apiKeys: allKeys,
      apiKey: singleKey,
      models: (process.env.XIAOMI_MODELS || 'mimo-latest')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      timeoutMs: Number(process.env.XIAOMI_TIMEOUT_MS || 25000),
      retryCount: Number(process.env.XIAOMI_RETRY_COUNT || 2),
    };

    super(config);
  }
}
