import { Injectable } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddingDescriptor } from './embedding.service';
export interface VectorChunk {
  id: string;
  kbId: string;
  documentId: string;
  userId: string;
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
    const collection = this.collection(descriptor);
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
    for (const field of ['user_id', 'kb_id', 'document_id'])
      await this.retry(() =>
        this.api.createPayloadIndex(collection, { field_name: field, field_schema: 'keyword', wait: true }),
      );
    return collection;
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
  ): Promise<Array<{ id: string; score: number }>> {
    if (!kbIds.length) return [];
    if (vector.length !== descriptor.dimensions) throw new Error('Query vector dimension mismatch');
    const results = await this.retry(() =>
      this.api.search(this.collection(descriptor), {
        vector,
        limit,
        with_payload: false,
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
