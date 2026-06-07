import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProviderAdapter } from './provider.types';
import { ProviderApiKeyStore } from './provider-api-key.store';
import {
  OpenAiCompatibleProvider,
  OpenAiCompatibleConfig,
} from './openai-compatible.provider';
import { GeminiProvider } from './gemini.provider';
import { QwenProvider } from './qwen.provider';
import { ApiKeyPool } from './api-key-pool';

type ProviderWithKeyPool = ProviderAdapter & {
  setKeyPool?: (pool: ApiKeyPool) => void;
};

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private providers: ProviderAdapter[] = [];

  constructor(private readonly apiKeyStore: ProviderApiKeyStore) {}

  async onModuleInit(): Promise<void> {
    // Wait for the key store to finish loading all pools
    await this.apiKeyStore.ready;

    // Load provider configs from DB (seeded on first run)
    const configs = await this.apiKeyStore.listConfigs();

    // If DB has configs, use them. Otherwise fall back to built-in defaults
    // (the 4 hardcoded providers are guaranteed by seed data)
    const enabledConfigs = configs.filter((c) => c.enabled);

    if (enabledConfigs.length === 0) {
      console.warn(
        '[ProviderRegistry] No enabled provider configs found. Run seed or add configs in admin panel.',
      );
      return;
    }

    for (const cfg of enabledConfigs) {
      const models = cfg.models
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      // Build key pool for this provider (DB keys + .env fallback)
      let pool;
      try {
        pool = this.apiKeyStore.getPool(cfg.providerName);
      } catch {
        console.warn(
          `[ProviderRegistry] No keys for "${cfg.providerName}", skipping.`,
        );
        continue;
      }

      if (pool.size() === 0) {
        console.warn(
          `[ProviderRegistry] Empty key pool for "${cfg.providerName}", skipping.`,
        );
        continue;
      }

      const providerConfig: OpenAiCompatibleConfig = {
        providerName: cfg.providerName,
        modelPrefix: cfg.modelPrefix || undefined,
        baseUrl: cfg.baseUrl,
        apiKeys: [],
        apiKey: undefined,
        models,
        timeoutMs: cfg.timeoutMs,
        retryCount: cfg.retryCount,
        authHeader: cfg.authHeader,
        authPrefix: cfg.authPrefix,
      };

      const provider = this.createProvider(providerConfig, cfg.baseUrl);
      (provider as ProviderWithKeyPool).setKeyPool?.(pool);
      this.providers.push(provider);

      console.log(
        `[ProviderRegistry] Registered "${cfg.displayName}" (${cfg.providerName}): ${models.length} models, ${pool.size()} keys @ ${cfg.baseUrl}`,
      );
    }

    console.log(
      `[ProviderRegistry] ${this.providers.length} providers ready: ${this.providers.map((p) => p.providerName).join(', ')}`,
    );
  }

  resolveProvider(model: string): ProviderAdapter {
    const provider = this.providers.find((candidate) =>
      candidate.isModelSupported(model),
    );

    if (!provider) {
      throw new NotFoundException(`No provider found for model: ${model}`);
    }

    return provider;
  }

  listModels() {
    return this.providers.flatMap((provider) => provider.listModels());
  }

  /** Hot-reload a single provider at runtime (called after admin CRUD). */
  async reloadProvider(providerName: string): Promise<void> {
    // Remove old instance
    this.providers = this.providers.filter((p) => p.providerName !== providerName);

    const cfg = await this.apiKeyStore.getConfig(providerName);
    if (!cfg || !cfg.enabled) return;

    const models = cfg.models.split(',').map((m) => m.trim()).filter(Boolean);
    if (models.length === 0) return;

    let pool;
    try {
      pool = this.apiKeyStore.getPool(providerName);
    } catch {
      console.warn(`[ProviderRegistry] reload: no keys for "${providerName}", skipping.`);
      return;
    }
    if (pool.size() === 0) {
      console.warn(`[ProviderRegistry] reload: empty key pool for "${providerName}", skipping.`);
      return;
    }

    const providerConfig: OpenAiCompatibleConfig = {
      providerName: cfg.providerName,
      modelPrefix: cfg.modelPrefix || undefined,
      baseUrl: cfg.baseUrl,
      apiKeys: [],
      apiKey: undefined,
      models,
      timeoutMs: cfg.timeoutMs,
      retryCount: cfg.retryCount,
      authHeader: cfg.authHeader,
      authPrefix: cfg.authPrefix,
    };

    const provider = this.createProvider(providerConfig, cfg.baseUrl);
    (provider as ProviderWithKeyPool).setKeyPool?.(pool);
    this.providers.push(provider);

    console.log(
      `[ProviderRegistry] Reloaded "${cfg.displayName}" (${cfg.providerName}): ${models.length} models, ${pool.size()} keys`,
    );
  }

  private createProvider(config: OpenAiCompatibleConfig, baseUrl: string): ProviderAdapter {
    const normalizedName = config.providerName.toLowerCase();
    const normalizedBaseUrl = baseUrl.toLowerCase();
    if (normalizedName === 'gemini' || normalizedName === 'google-gemini' || normalizedBaseUrl.includes('generativelanguage.googleapis.com')) {
      return new GeminiProvider({
        providerName: config.providerName,
        baseUrl: config.baseUrl,
        models: config.models,
        timeoutMs: config.timeoutMs,
        retryCount: config.retryCount,
      });
    }
    if (normalizedName === 'qwen' || normalizedName === 'dashscope' || normalizedBaseUrl.includes('dashscope.aliyuncs.com')) {
      return new QwenProvider(config);
    }
    return new OpenAiCompatibleProvider(config);
  }
}
