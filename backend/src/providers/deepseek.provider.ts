import {
  OpenAiCompatibleConfig,
  OpenAiCompatibleProvider,
  parseKeysFromEnv,
} from './openai-compatible.provider';

export class DeepseekProvider extends OpenAiCompatibleProvider {
  constructor() {
    // Priority: DEEPSEEK_API_KEYS > DEEPSEEK_API_KEY > DASHSCOPE_API_KEYS > DASHSCOPE_API_KEY > QWEN_API_KEY
    const primaryKeys = parseKeysFromEnv('DEEPSEEK_API_KEYS');
    const fallbackKeys = parseKeysFromEnv('DASHSCOPE_API_KEYS');
    const singleKey =
      process.env.DEEPSEEK_API_KEY ||
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
      providerName: 'deepseek',
      baseUrl:
        process.env.DEEPSEEK_BASE_URL ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKeys: allKeys,
      apiKey: singleKey,
      models: (
        process.env.DEEPSEEK_MODELS ||
        'deepseek-r1-distill-qwen-7b,deepseek-v3.2,deepseek-r1'
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 25000),
      retryCount: Number(process.env.DEEPSEEK_RETRY_COUNT || 2),
    };

    super(config);
  }
}
