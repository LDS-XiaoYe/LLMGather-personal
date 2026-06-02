import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelDescriptor,
  ProviderAdapter,
} from './provider.types';
import { ApiKeyPool } from './api-key-pool';

export interface OpenAiCompatibleConfig {
  providerName: string;
  modelPrefix?: string;
  baseUrl: string;
  /** Multi-key array (primary).  Takes precedence over `apiKey`. */
  apiKeys: string[];
  /** Single key (legacy, backward-compatible).  Used only when `apiKeys` is empty. */
  apiKey?: string;
  models: string[];
  timeoutMs?: number;
  retryCount?: number;
  /** 429 cooldown duration in ms (default 30 s). */
  rateLimitCooldownMs?: number;
  /** Custom auth header name (default 'Authorization'). */
  authHeader?: string;
  /** Custom auth header prefix (default 'Bearer'). */
  authPrefix?: string;
}

/** Parse a comma-separated env var into a trimmed, deduped key list. */
export function parseKeysFromEnv(envVar: string): string[] {
  return (process.env[envVar] || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export class OpenAiCompatibleProvider implements ProviderAdapter {
  public readonly providerName: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly authHeader: string;
  private readonly authPrefix: string;
  private keyPool: ApiKeyPool;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.providerName = config.providerName;
    this.timeoutMs = config.timeoutMs ?? 25000;
    this.retryCount = config.retryCount ?? 2;
    this.authHeader = config.authHeader || 'Authorization';
    this.authPrefix = config.authPrefix || 'Bearer';

    const keys =
      config.apiKeys.length > 0
        ? config.apiKeys
        : config.apiKey
          ? [config.apiKey]
          : [];
    // Only create an internal pool when keys are provided.
    // Providers created by the registry pass apiKeys=[] and call setKeyPool() right after.
    this.keyPool =
      keys.length > 0
        ? new ApiKeyPool(keys, config.rateLimitCooldownMs ?? 30_000)
        : (null as unknown as ApiKeyPool);
  }

  isModelSupported(model: string): boolean {
    if (this.config.modelPrefix && model.startsWith(`${this.config.modelPrefix}/`)) {
      return true;
    }
    return this.config.models.includes(model);
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { response } = await this.fetchWithRetry({
      ...request,
      model: this.normalizeModel(request.model),
      stream: false,
    });

    if (!response.ok) {
      throw await this.buildProviderException(response);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data;
  }

  async chatCompletionStream(request: ChatCompletionRequest): Promise<Response> {
    const { response } = await this.fetchWithRetry({
      ...request,
      model: this.normalizeModel(request.model),
      stream: true,
    });

    if (!response.ok) {
      throw await this.buildProviderException(response);
    }

    if (!response.body) {
      throw new ServiceUnavailableException(`${this.providerName} stream unavailable`);
    }

    return response;
  }

  listModels(): ModelDescriptor[] {
    return this.config.models.map((model) => ({
      id: model,
      object: 'model',
      owned_by: this.providerName,
    }));
  }

  /** Replace the active key pool at runtime (hot-reload after admin CRUD). */
  setKeyPool(pool: ApiKeyPool): void {
    this.keyPool = pool;
  }

  /* ──────── private ──────── */

  private normalizeModel(model: string): string {
    if (this.config.modelPrefix && model.startsWith(`${this.config.modelPrefix}/`)) {
      return model.slice(this.config.modelPrefix.length + 1);
    }
    return model;
  }

  private buildHeaders(key?: string): Record<string, string> {
    const apiKey = key ?? this.keyPool.getRandomKey();
    return {
      'Content-Type': 'application/json',
      [this.authHeader]: `${this.authPrefix} ${apiKey}`,
    };
  }

  private async buildProviderException(response: Response): Promise<BadGatewayException> {
    let detail = response.statusText;

    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) {
        detail = data.error.message;
      }
    } catch {
      // Ignore parse failures and use status text as fallback.
    }

    return new BadGatewayException(
      `${this.providerName} request failed (${response.status}): ${detail}`,
    );
  }

  /**
   * Fetch with retry and automatic API-key rotation.
   *
   * Strategy:
   *  - 429 Too Many Requests → mark key as rate-limited (cooldown), rotate key, retry
   *  - 5xx Server Error      → rotate key (no cooldown), retry
   *  - Network/timeout error  → rotate key (no cooldown), retry
   *  - All keys exhausted     → fall back to the earliest-expiring key and retry anyway
   */
  private async fetchWithRetry(
    payload: ChatCompletionRequest,
  ): Promise<{ response: Response }> {
    let lastError = 'unknown error';
    let currentKey = this.keyPool.getRandomKey();

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.buildHeaders(currentKey),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 429 — rate limit: cooldown this key, rotate, retry
        if (response.status === 429 && attempt < this.retryCount) {
          this.keyPool.markRateLimited(currentKey);
          console.warn(
            JSON.stringify({
              event: 'provider_rate_limited',
              provider: this.providerName,
              key_prefix: maskKey(currentKey),
              attempt: attempt + 1,
            }),
          );
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        // 5xx — server error: rotate key without cooldown, retry
        if (response.status >= 500 && attempt < this.retryCount) {
          this.keyPool.markRetryableFailure(currentKey);
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        // 4xx (non-429) or final attempt — don't retry
        return { response };
      } catch (error) {
        clearTimeout(timeoutId);
        const reason =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : String(error);
        lastError =
          error instanceof DOMException && error.name === 'AbortError'
            ? `request timeout (${this.timeoutMs}ms)`
            : reason;

        console.warn(
          JSON.stringify({
            event: 'provider_retry',
            provider: this.providerName,
            key_prefix: maskKey(currentKey),
            attempt: attempt + 1,
            max_attempts: this.retryCount + 1,
            reason: lastError,
          }),
        );

        if (attempt === this.retryCount) {
          throw new ServiceUnavailableException(
            `${this.providerName} request failed after retries: ${lastError}`,
          );
        }

        // Network error — rotate key (no cooldown), retry
        this.keyPool.markRetryableFailure(currentKey);
        currentKey = this.keyPool.getRandomKey();
      }
    }

    throw new ServiceUnavailableException(`${this.providerName} request failed: ${lastError}`);
  }
}

/** Safe logging helper — only reveals last 4 characters of an API key. */
function maskKey(key: string): string {
  if (!key || key.length <= 4) return '***';
  return `***${key.slice(-4)}`;
}
