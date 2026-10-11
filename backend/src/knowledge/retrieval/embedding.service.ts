import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ProviderApiKeyStore } from '../../providers/provider-api-key.store';
import { ApiKeyPool } from '../../providers/api-key-pool';
import { boundedEnv } from '../../workflows/runtime/workflow-runtime.service';

export interface EmbeddingDescriptor {
  model: string;
  dimensions: number;
  fingerprint: string;
  endpoint: string;
  revision: string;
}
export interface EmbeddingProvider {
  describe(): Promise<EmbeddingDescriptor>;
  embed(texts: string[], expected?: EmbeddingDescriptor): Promise<number[][]>;
}
interface Configuration {
  descriptor: EmbeddingDescriptor;
  apiKey: string;
  authHeader: string;
  authPrefix: string;
  pool?: ApiKeyPool;
}

/** OpenAI-compatible API works with remote providers and local TEI/vLLM embedding servers. */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private active = 0;
  constructor(private readonly providers: ProviderApiKeyStore) {}
  private async configuration(withKey = true): Promise<Configuration> {
    const name = process.env.EMBEDDING_PROVIDER_NAME || '';
    const provider = name ? await this.providers.getConfig(name) : null;
    if (name && (!provider || !provider.enabled)) throw new Error('Embedding provider is missing or disabled');
    const endpoint = (process.env.EMBEDDING_BASE_URL || provider?.baseUrl || '').replace(/\/+$/, '');
    const model = (process.env.EMBEDDING_MODEL || '').trim();
    const dimensions = boundedEnv('EMBEDDING_DIMENSIONS', 0, 1, 65536);
    if (!/^https?:\/\//.test(endpoint) || !model) throw new Error('Embedding endpoint and model must be configured');
    const url = new URL(endpoint);
    if (url.username || url.password || url.search || url.hash)
      throw new Error('Embedding endpoint must not contain credentials or query parameters');
    const revision = process.env.EMBEDDING_REVISION || '1';
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ name, endpoint, model, dimensions, revision }))
      .digest('hex');
    const pool = name && withKey ? this.providers.getPool(name) : undefined;
    const prefix = (provider?.authPrefix ?? 'Bearer').trim();
    return {
      descriptor: { endpoint, model, dimensions, revision, fingerprint },
      pool,
      apiKey: pool ? pool.getKey() : withKey ? process.env.EMBEDDING_API_KEY || '' : '',
      authHeader: provider?.authHeader || 'Authorization',
      authPrefix: prefix ? prefix + ' ' : '',
    };
  }
  async describe(): Promise<EmbeddingDescriptor> {
    return (await this.configuration(false)).descriptor;
  }
  async health(): Promise<{ status: string; dimensions: number }> {
    const [probe] = await this.embed(['embedding health probe']);
    return { status: 'ok', dimensions: probe.length };
  }
  async embed(texts: string[], expected?: EmbeddingDescriptor): Promise<number[][]> {
    if (!texts.length) return [];
    const config = await this.configuration();
    if (expected && expected.fingerprint !== config.descriptor.fingerprint)
      throw new Error('Embedding vector space changed; reindex before retrieval');
    const batchSize = boundedEnv('EMBEDDING_BATCH_SIZE', 32, 1, 256);
    const output: number[][] = [];
    for (let start = 0; start < texts.length; start += batchSize) {
      while (this.active >= boundedEnv('EMBEDDING_CONCURRENCY', 2, 1, 32))
        await new Promise((resolve) => setTimeout(resolve, 20));
      this.active++;
      try {
        output.push(...(await this.request(texts.slice(start, start + batchSize), config)));
      } finally {
        this.active--;
      }
    }
    return output;
  }
  private async request(input: string[], config: Configuration): Promise<number[][]> {
    const retries = boundedEnv('EMBEDDING_RETRIES', 2, 0, 5);
    for (let attempt = 0; ; attempt++) {
      let retry = false;
      try {
        const response = await fetch(`${config.descriptor.endpoint}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { [config.authHeader]: config.authPrefix + config.apiKey } : {}),
          },
          body: JSON.stringify({ model: config.descriptor.model, input, encoding_format: 'float' }),
          signal: AbortSignal.timeout(boundedEnv('EMBEDDING_TIMEOUT_MS', 30000, 100, 300000)),
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) config.pool?.markAuthenticationFailure(config.apiKey);
          else if (response.status === 429) config.pool?.markRateLimited(config.apiKey);
          else if (response.status >= 500) config.pool?.markRetryableFailure(config.apiKey);
          retry = response.status === 429 || response.status >= 500;
          throw new Error(`Embedding API HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { data?: { index: number; embedding: number[] }[] };
        if (!Array.isArray(payload.data) || payload.data.length !== input.length)
          throw new Error('Embedding response count mismatch');
        const rows = [...payload.data].sort((a, b) => a.index - b.index);
        for (let i = 0; i < rows.length; i++) {
          if (
            rows[i].index !== i ||
            !Array.isArray(rows[i].embedding) ||
            rows[i].embedding.length !== config.descriptor.dimensions ||
            !rows[i].embedding.every((v) => typeof v === 'number' && Number.isFinite(v)) ||
            !rows[i].embedding.some((v) => v !== 0)
          ) {
            throw new Error('Embedding response index, dimension or values mismatch');
          }
        }
        config.pool?.markSuccess(config.apiKey);
        return rows.map((row) => row.embedding);
      } catch (error) {
        retry =
          retry ||
          error instanceof TypeError ||
          (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
        if (!retry || attempt >= retries)
          throw new Error(
            error instanceof Error && error.message.startsWith('Embedding')
              ? error.message
              : 'Embedding transport failed',
          );
        if (config.pool) config.apiKey = config.pool.getKey();
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
      }
    }
  }
}
