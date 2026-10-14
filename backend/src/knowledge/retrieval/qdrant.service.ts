import { Injectable } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddingDescriptor } from './embedding.service';
export interface VectorChunk {
  id: string;
  kbId: string;
  documentId: string;
  userId: string;
}
export interface MemoryVectorPoint {
  id: string;
  userId: string;
  agentId: string | null;
  memoryType: string;
  revision: string;
  contentHash: string;
}
export interface MemoryVectorHit {
  id: string;
  score: number;
  revision: string;
  contentHash: string;
}

@Injectable()
export class QdrantService {
  private client?: QdrantClient;
  private get api(): QdrantClient {
    const url = process.env.QDRANT_URL;
    if (!url) throw new Error('QDRANT_URL is required');
    return (this.client ??= new QdrantClient({
      url,
      apiKey: process.env.QDRANT_API_KEY || undefined,
      timeout: 15000,
      checkCompatibility: false,
    }));
  }
  collection(descriptor: EmbeddingDescriptor): string {
    return `llmgather_${descriptor.fingerprint.slice(0, 32)}`;
  }
  private async retry<T>(action: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await action();
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (attempt >= 2 || (status && status !== 429 && status < 500))
          throw new Error(`Qdrant request failed${status ? ': HTTP ' + status : ''}`);
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
  }
  async health(): Promise<{ status: string }> {
    await this.retry(() => this.api.getCollections());
    return { status: 'ok' };
  }
  async ensure(descriptor: EmbeddingDescriptor): Promise<string> {
    return this.ensureCollection(this.collection(descriptor), descriptor, ['user_id', 'kb_id', 'document_id']);
  }
  private async ensureCollection(collection: string, descriptor: EmbeddingDescriptor, fields: string[]): Promise<string> {
    try {
      await this.api.getCollection(collection);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw new Error('Qdrant collection inspection failed');
      try {
        await this.retry(() =>
          this.api.createCollection(collection, { vectors: { size: descriptor.dimensions, distance: 'Cosine' } }),
        );
      } catch {
        /* concurrent creation is accepted only after verifying actual configuration below */
      }
    }
    const info = await this.retry(() => this.api.getCollection(collection));
    const vectors = info.config.params.vectors;
    if (!vectors || !('size' in vectors) || vectors.size !== descriptor.dimensions || vectors.distance !== 'Cosine')
      throw new Error('Qdrant vector space mismatch');
    for (const field of fields)
      await this.retry(() =>
        this.api.createPayloadIndex(collection, { field_name: field, field_schema: 'keyword', wait: true }),
      );
    return collection;
  }
  memoryCollection(descriptor: EmbeddingDescriptor): string {
    return `llmgather_memory_${descriptor.fingerprint.slice(0, 32)}`;
  }
  async ensureMemory(descriptor: EmbeddingDescriptor): Promise<string> {
    return this.ensureCollection(this.memoryCollection(descriptor), descriptor, ['user_id', 'agent_id', 'memory_type', 'fingerprint']);
  }
  async upsertMemory(descriptor: EmbeddingDescriptor, memory: MemoryVectorPoint, vector: number[]): Promise<void> {
    if (vector.length !== descriptor.dimensions || !vector.every(Number.isFinite) || !vector.some(v => v !== 0))
      throw new Error('Memory vector dimensions or values mismatch');
    await this.retry(() => this.api.upsert(this.memoryCollection(descriptor), {
      wait: true,
      points: [{ id: memory.id, vector, payload: {
        user_id: memory.userId, agent_id: memory.agentId || '', memory_type: memory.memoryType,
        fingerprint: descriptor.fingerprint, revision: memory.revision, content_hash: memory.contentHash,
      } }],
    }));
  }
  async searchMemories(
    descriptor: EmbeddingDescriptor, vector: number[], userId: string,
    agentId: string | undefined, limit: number, memoryType?: string,
  ): Promise<MemoryVectorHit[]> {
    if (vector.length !== descriptor.dimensions || !vector.every(Number.isFinite))
      throw new Error('Memory query vector dimension mismatch');
    const must = [
      { key: 'user_id', match: { value: userId } },
      { key: 'fingerprint', match: { value: descriptor.fingerprint } },
      ...(agentId ? [{ key: 'agent_id', match: { any: ['', agentId] } }] : []),
      ...(memoryType ? [{ key: 'memory_type', match: { value: memoryType } }] : []),
    ];
    const hits = await this.retry(() => this.api.search(this.memoryCollection(descriptor), {
      vector, limit, filter: { must }, with_payload: ['revision', 'content_hash'],
    }));
    return hits.map(hit => ({
      id: String(hit.id), score: hit.score,
      revision: String(hit.payload?.revision ?? ''), contentHash: String(hit.payload?.content_hash ?? ''),
    }));
  }
  async deleteMemory(collection: string, userId: string, id: string): Promise<void> {
    try {
      await this.retry(() => this.api.delete(collection, {
        wait: true, filter: { must: [
          { has_id: [id] }, { key: 'user_id', match: { value: userId } },
        ] },
      }));
    } catch (error) {
      // A removed collection contains no stale points; other failures remain retryable by the outbox.
      if (!(error instanceof Error && error.message === 'Qdrant request failed: HTTP 404')) throw error;
    }
  }
  async upsert(descriptor: EmbeddingDescriptor, chunks: VectorChunk[], vectors: number[][]): Promise<void> {
    if (
      chunks.length !== vectors.length ||
      vectors.some((v) => v.length !== descriptor.dimensions || !v.every(Number.isFinite))
    )
      throw new Error('Vector batch dimensions mismatch');
    if (!chunks.length) return;
    await this.retry(() =>
      this.api.upsert(this.collection(descriptor), {
        wait: true,
        points: chunks.map((c, i) => ({
          id: c.id,
          vector: vectors[i],
          payload: { user_id: c.userId, kb_id: c.kbId, document_id: c.documentId, fingerprint: descriptor.fingerprint },
        })),
      }),
    );
  }
  async search(
    descriptor: EmbeddingDescriptor,
    vector: number[],
    user: string,
    kbIds: string[],
    limit: number,
    minScore?: number,
  ): Promise<Array<{ id: string; score: number }>> {
    if (!kbIds.length) return [];
    if (vector.length !== descriptor.dimensions) throw new Error('Query vector dimension mismatch');
    const results = await this.retry(() =>
      this.api.search(this.collection(descriptor), {
        vector,
        limit,
        with_payload: false,
        ...(minScore === undefined ? {} : { score_threshold: minScore }),
        filter: {
          must: [
            { key: 'user_id', match: { value: user } },
            { key: 'kb_id', match: { any: kbIds } },
            { key: 'fingerprint', match: { value: descriptor.fingerprint } },
          ],
        },
      }),
    );
    return results.map((item) => ({ id: String(item.id), score: item.score }));
  }
  async count(descriptor: EmbeddingDescriptor, user: string, kbId: string): Promise<number> {
    const result = await this.retry(() =>
      this.api.count(this.collection(descriptor), {
        exact: true,
        filter: {
          must: [
            { key: 'user_id', match: { value: user } },
            { key: 'kb_id', match: { value: kbId } },
          ],
        },
      }),
    );
    return result.count;
  }
  async deleteDocument(collection: string, user: string, document: string): Promise<void> {
    await this.retry(() =>
      this.api.delete(collection, {
        wait: true,
        filter: {
          must: [
            { key: 'user_id', match: { value: user } },
            { key: 'document_id', match: { value: document } },
          ],
        },
      }),
    );
  }
  async clearKnowledgeBase(descriptor: EmbeddingDescriptor, user: string, kbId: string): Promise<void> {
    await this.retry(() =>
      this.api.delete(this.collection(descriptor), {
        wait: true,
        filter: {
          must: [
            { key: 'user_id', match: { value: user } },
            { key: 'kb_id', match: { value: kbId } },
          ],
        },
      }),
    );
  }
}
