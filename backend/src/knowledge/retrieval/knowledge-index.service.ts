import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { boundedEnv } from '../../workflows/runtime/workflow-runtime.service';
import { EmbeddingDescriptor, EmbeddingService } from './embedding.service';
import { QdrantService, VectorChunk } from './qdrant.service';

interface Chunk extends VectorChunk {
  content: string;
}
@Injectable()
export class KnowledgeIndexService {
  constructor(
    private readonly database: DatabaseService,
    private readonly embeddings: EmbeddingService,
    private readonly vectors: QdrantService,
  ) {}
  private async locked<T>(user: string, kb: string, action: (guard: () => Promise<void>) => Promise<T>): Promise<T> {
    const owner = randomUUID();
    const db = this.database.connection;
    const claimed = await db
      .prepare(
        `UPDATE knowledge_bases SET rag_owner=?,rag_lease_until=DATE_ADD(NOW(3),INTERVAL 60 SECOND)
      WHERE id=? AND user_id=? AND deleted_at IS NULL AND provider='native'
      AND (rag_owner IS NULL OR rag_lease_until<NOW(3))`,
      )
      .run(owner, kb, user);
    if (!claimed.changes)
      throw new ConflictException('Knowledge base is missing or an index/write job already owns it');
    let lost = false;
    const guard = async () => {
      if (lost) throw new Error('Knowledge index lease lost');
      const row = await db
        .prepare('SELECT id FROM knowledge_bases WHERE id=? AND user_id=? AND rag_owner=? AND rag_lease_until>NOW(3)')
        .get(kb, user, owner);
      if (!row) throw new Error('Knowledge index lease lost');
    };
    const timer = setInterval(() => {
      void db
        .prepare(
          `UPDATE knowledge_bases SET rag_lease_until=DATE_ADD(NOW(3),INTERVAL 60 SECOND)
        WHERE id=? AND rag_owner=? AND rag_lease_until>NOW(3)`,
        )
        .run(kb, owner)
        .then((r) => {
          lost ||= !r.changes;
        })
        .catch(() => {
          lost = true;
        });
    }, 10000);
    try {
      return await action(guard);
    } finally {
      clearInterval(timer);
      await db
        .prepare('UPDATE knowledge_bases SET rag_owner=NULL,rag_lease_until=NULL WHERE id=? AND rag_owner=?')
        .run(kb, owner);
    }
  }
  async mutate<T>(user: string, kb: string, action: () => Promise<T>): Promise<T> {
    return this.locked(user, kb, async (guard) => {
      await guard();
      await this.database.connection
        .prepare("UPDATE knowledge_bases SET retrieval_backend='legacy' WHERE id=? AND user_id=?")
        .run(kb, user);
      await this.database.connection
        .prepare(
          "UPDATE knowledge_indexes SET status='pending',cursor_id='',indexed_count=0 WHERE kb_id=? AND user_id=?",
        )
        .run(kb, user);
      try {
        const result = await action();
        if (process.env.NATIVE_RAG_BACKEND !== 'legacy') {
          await this.build(user, kb, guard);
        }
        return result;
      } catch (error) {
        await guard();
        await this.database.connection
          .prepare("UPDATE knowledge_indexes SET status='failed',error='Document mutation or indexing failed; retry reindex' WHERE kb_id=? AND user_id=?")
          .run(kb, user);
        await this.database.connection
          .prepare(
            "UPDATE knowledge_documents SET vector_status='failed',failure_reason='Document mutation or semantic indexing failed; retry reindex' WHERE kb_id=? AND user_id=? AND deleted_at IS NULL",
          )
          .run(kb, user);
        throw error;
      }
    });
  }
  async migrate(user: string, kb: string, reset = false): Promise<{ status: string; indexedCount: number }> {
    return this.locked(user, kb, async (guard) => {
      if (reset) {
        await this.database.connection
          .prepare(
            "UPDATE knowledge_indexes SET status='pending',cursor_id='',indexed_count=0 WHERE kb_id=? AND user_id=?",
          )
          .run(kb, user);
        await this.database.connection
          .prepare("UPDATE knowledge_bases SET retrieval_backend='legacy' WHERE id=? AND user_id=?")
          .run(kb, user);
      }
      return this.build(user, kb, guard);
    });
  }
  async status(user: string, kb: string): Promise<unknown[]> {
    const exists = await this.database.connection
      .prepare('SELECT id FROM knowledge_bases WHERE id=? AND user_id=? AND deleted_at IS NULL')
      .get(kb, user);
    if (!exists) throw new NotFoundException('Knowledge base not found');
    return this.database.connection
      .prepare(
        `SELECT fingerprint,collection_name AS collectionName,model_json AS modelJson,status,
      cursor_id AS cursorId,indexed_count AS indexedCount,error,updated_at AS updatedAt FROM knowledge_indexes WHERE kb_id=? AND user_id=?`,
      )
      .all(kb, user);
  }
  private async build(
    user: string,
    kb: string,
    guard: () => Promise<void>,
  ): Promise<{ status: string; indexedCount: number }> {
    const descriptor = await this.embeddings.describe();
    const db = this.database.connection;
    const collection = this.vectors.collection(descriptor);
    await db
      .prepare(
        `INSERT INTO knowledge_indexes (kb_id,user_id,fingerprint,collection_name,model_json,status,updated_at)
      VALUES (?,?,?,?,?,'pending',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)`,
      )
      .run(kb, user, descriptor.fingerprint, collection, JSON.stringify(descriptor), this.database.now());
    const row = await db
      .prepare('SELECT cursor_id,indexed_count,status FROM knowledge_indexes WHERE kb_id=? AND fingerprint=?')
      .get(kb, descriptor.fingerprint);
    let cursor = String(row?.cursor_id || '');
    let count = Number(row?.indexed_count || 0);
    await db
      .prepare("UPDATE knowledge_indexes SET status='building',error='' WHERE kb_id=? AND fingerprint=?")
      .run(kb, descriptor.fingerprint);
    try {
      await guard();
      await this.vectors.ensure(descriptor);
      if (!cursor) {
        await this.vectors.clearKnowledgeBase(descriptor, user, kb);
        count = 0;
      }
      while (true) {
        await guard();
        const batch = (await db
          .prepare(
            `SELECT c.id,c.kb_id AS kbId,c.document_id AS documentId,c.user_id AS userId,c.content
          FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id
          WHERE c.kb_id=? AND c.user_id=? AND d.deleted_at IS NULL AND c.id>? ORDER BY c.id LIMIT ${boundedEnv('EMBEDDING_BATCH_SIZE', 32, 1, 256)}`,
          )
          .all(kb, user, cursor)) as unknown as Chunk[];
        if (!batch.length) break;
        const vectors = await this.embeddings.embed(
          batch.map((c) => c.content),
          descriptor,
        );
        await guard();
        await this.vectors.upsert(descriptor, batch, vectors);
        await guard();
        cursor = batch[batch.length - 1].id;
        count += batch.length;
        await db
          .prepare(
            `UPDATE knowledge_indexes SET cursor_id=?,indexed_count=?,updated_at=? WHERE kb_id=? AND fingerprint=?`,
          )
          .run(cursor, count, this.database.now(), kb, descriptor.fingerprint);
      }
      const expected = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id
        WHERE c.kb_id=? AND c.user_id=? AND d.deleted_at IS NULL`,
        )
        .get(kb, user);
      const actual = await this.vectors.count(descriptor, user, kb);
      if (actual !== Number(expected?.total) || actual !== count)
        throw new Error('Qdrant/MySQL chunk count mismatch; reset index and retry');
      if (count) {
        const probe = await db
          .prepare(
            `SELECT c.content FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id
          WHERE c.kb_id=? AND c.user_id=? AND d.deleted_at IS NULL LIMIT 1`,
          )
          .get(kb, user);
        const [vector] = await this.embeddings.embed([String(probe!.content)], descriptor);
        if (!(await this.vectors.search(descriptor, vector, user, [kb], 1)).length)
          throw new Error('Index query verification failed');
      }
      await guard();
      if ((await this.embeddings.describe()).fingerprint !== descriptor.fingerprint)
        throw new Error('Embedding configuration changed during indexing');
      await db
        .prepare("UPDATE knowledge_indexes SET status='ready',error='',updated_at=? WHERE kb_id=? AND fingerprint=?")
        .run(this.database.now(), kb, descriptor.fingerprint);
      await db.prepare("UPDATE knowledge_bases SET retrieval_backend='qdrant' WHERE id=? AND user_id=?").run(kb, user);
      await db
        .prepare(
          "UPDATE knowledge_documents SET vector_status='succeeded',failure_reason='' WHERE kb_id=? AND user_id=? AND deleted_at IS NULL",
        )
        .run(kb, user);
      return { status: 'ready', indexedCount: count };
    } catch (error) {
      // No keys, provider response bodies or source text in migration errors.
      await guard();
      await db
        .prepare(
          "UPDATE knowledge_indexes SET status='failed',error='Indexing or verification failed; retry this migration',updated_at=? WHERE kb_id=? AND fingerprint=?",
        )
        .run(this.database.now(), kb, descriptor.fingerprint);
      throw error;
    }
  }
  async requireReady(user: string, kbIds: string[], descriptor: EmbeddingDescriptor): Promise<void> {
    for (const kb of kbIds) {
      const row = await this.database.connection
        .prepare(
          `SELECT i.status,b.retrieval_backend FROM knowledge_indexes i
        JOIN knowledge_bases b ON b.id=i.kb_id WHERE i.kb_id=? AND i.user_id=? AND i.fingerprint=? AND b.deleted_at IS NULL`,
        )
        .get(kb, user, descriptor.fingerprint);
      if (row?.status !== 'ready' || row.retrieval_backend !== 'qdrant')
        throw new ConflictException('Knowledge base requires semantic reindex for the configured model');
    }
  }
  async deleteDocument(user: string, kb: string, document: string): Promise<void> {
    const rows = await this.database.connection
      .prepare('SELECT collection_name FROM knowledge_indexes WHERE kb_id=? AND user_id=?')
      .all(kb, user);
    for (const row of rows) await this.vectors.deleteDocument(String(row.collection_name), user, document);
  }
}
