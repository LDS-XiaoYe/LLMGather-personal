import {
  OpenAiCompatibleConfig,
  OpenAiCompatibleProvider,
  parseKeysFromEnv,
} from './openai-compatible.provider';

export class QwenProvider extends OpenAiCompatibleProvider {
  constructor() {
    // Priority: QWEN_API_KEYS > QWEN_API_KEY > DASHSCOPE_API_KEYS > DASHSCOPE_API_KEY
    const primaryKeys = parseKeysFromEnv('QWEN_API_KEYS');
    const fallbackKeys = parseKeysFromEnv('DASHSCOPE_API_KEYS');
    const singleKey =
      process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';

    const allKeys =
      primaryKeys.length > 0
        ? primaryKeys
        : fallbackKeys.length > 0
          ? fallbackKeys
          : singleKey
            ? [singleKey]
            : [];

    const config: OpenAiCompatibleConfig = {
      providerName: 'qwen',
      baseUrl:
        process.env.QWEN_BASE_URL ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKeys: allKeys,
      apiKey: singleKey,
      models: (
        process.env.QWEN_MODELS ||
        [
          'qwen-turbo',
          'qwen-plus',
          'qwen-max',
          'qwen-vl-plus-latest',
          'qwen2.5-14b-instruct',
          'qwen2.5-7b-instruct',
          'qwen3.6-plus',
        ].join(',')
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      timeoutMs: Number(process.env.QWEN_TIMEOUT_MS || 25000),
      retryCount: Number(process.env.QWEN_RETRY_COUNT || 2),
    };

    super(config);
  }
}
