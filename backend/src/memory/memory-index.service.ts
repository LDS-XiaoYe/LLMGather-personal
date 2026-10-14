import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { EmbeddingDescriptor, EmbeddingService } from '../knowledge/retrieval/embedding.service';
import { MemoryVectorHit, QdrantService } from '../knowledge/retrieval/qdrant.service';
import { ManagedEmbeddingService } from '../model-services/managed-embedding.service';
import { mapMemory, MEMORY_COLUMNS, memoryIndexHash } from './memory-utils';
import { MemoryItem, MemoryRow } from './memory.types';

type IndexRow = MemoryRow & { indexRevision: string | number; indexAttempts: number; deletedAt?: string | null };
export function memorySemanticEnabled(): boolean { return process.env.MEMORY_SEMANTIC_INDEX_ENABLED === 'true'; }

/** Derived index only. Durable dirty rows, leases and version-fenced acknowledgments survive process restarts. */
@Injectable()
export class MemoryIndexService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MemoryIndexService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;
  private readyFingerprint = '';
  constructor(
    private readonly database: DatabaseService,
    private readonly embeddings: EmbeddingService,
    private readonly vectors: QdrantService,
    private readonly managed: ManagedEmbeddingService,
  ) {}

  onApplicationBootstrap(): void {
    if (!memorySemanticEnabled()) return;
    this.timer = setInterval(() => { void this.drain(); }, 5000);
    this.timer.unref();
    void this.drain();
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  private async descriptor(): Promise<EmbeddingDescriptor> {
    const instance = process.env.MEMORY_EMBEDDING_INSTANCE_ID?.trim();
    return instance ? this.managed.descriptor(instance) : this.embeddings.describe();
  }

  async search(userId: string, query: string, agentId: string | undefined, limit: number, memoryType?: string): Promise<MemoryItem[]> {
    if (!memorySemanticEnabled()) return [];
    const descriptor = await this.descriptor();
    const [vector] = await this.embeddings.embed([query], descriptor);
    const hits = await this.vectors.searchMemories(descriptor, vector, userId, agentId, Math.min(200, limit * 4), memoryType);
    return this.resolveHits(userId, hits, agentId, memoryType).then(items => items.slice(0, limit));
  }

  async resolveHits(userId: string, hits: MemoryVectorHit[], agentId?: string, memoryType?: string): Promise<MemoryItem[]> {
    if (!hits.length) return [];
    const ids = [...new Set(hits.map(hit => hit.id))];
    const rows = await this.database.connection.prepare(
      `SELECT ${MEMORY_COLUMNS}, index_revision AS indexRevision FROM memories
       WHERE user_id = ? AND deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})
         AND (? = '' OR agent_id = ? OR agent_id = '' OR agent_id IS NULL)
         AND (? = '' OR memory_type = ?)`,
    ).all(userId, ...ids, agentId || '', agentId || '', memoryType || '', memoryType || '') as unknown as IndexRow[];
    const current = new Map(rows.map(row => [row.id, row]));
    const seen = new Set<string>();
    return hits.flatMap(hit => {
      const row = current.get(hit.id);
      if (!row || seen.has(hit.id) || row.userId !== userId || row.deletedAt
        || (agentId && row.agentId && row.agentId !== agentId)
        || (memoryType && row.memoryType !== memoryType)
        || String(row.indexRevision) !== hit.revision || memoryIndexHash(row) !== hit.contentHash) return [];
      seen.add(hit.id);
      return [{ ...mapMemory(row), score: hit.score }];
    });
  }

  async rebuild(userId: string, agentId?: string): Promise<{ enabled: boolean; queued: number }> {
    const result = await this.database.connection.prepare(
      `UPDATE memories SET index_revision = index_revision + 1, index_pending = 1,
        index_attempts = 0, index_next_attempt_at = NULL
       WHERE user_id = ? AND (? = '' OR agent_id = ?)`,
    ).run(userId, agentId || '', agentId || '');
    return { enabled: memorySemanticEnabled(), queued: result.changes };
  }

  drain(): Promise<void> {
    if (this.stopped || !memorySemanticEnabled()) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.processBatch().catch(() => {
      this.readyFingerprint = '';
      this.logger.warn('Memory index unavailable; dirty rows retained for retry, MySQL remains authoritative');
    }).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async prepareSpace(descriptor: EmbeddingDescriptor): Promise<void> {
    const db = this.database.connection;
    // Record the collection before any vector is written so tombstones can clean every historical space.
    await db.prepare(`INSERT IGNORE INTO memory_index_spaces (fingerprint,collection_name,descriptor_json) VALUES (?,?,?)`)
      .run(descriptor.fingerprint, this.vectors.memoryCollection(descriptor), JSON.stringify(descriptor));
    if (this.readyFingerprint !== descriptor.fingerprint) {
      await this.vectors.ensureMemory(descriptor);
      this.readyFingerprint = descriptor.fingerprint;
    }
    const space = await db.prepare('SELECT backfill_cursor,backfill_complete FROM memory_index_spaces WHERE fingerprint=?').get(descriptor.fingerprint);
    if (!space || Number(space.backfill_complete)) return;
    const cursor = String(space.backfill_cursor || '');
    const batch = await db.prepare('SELECT id FROM memories WHERE id > ? ORDER BY id LIMIT 100').all(cursor);
    if (batch.length) {
      const ids = batch.map(row => String(row.id));
      // Same-row outbox; reprocessing after a crash is idempotent. Cursor never moves before durable dirty marks.
      await db.prepare(`UPDATE memories SET index_pending=1,index_next_attempt_at=NULL WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
      await db.prepare('UPDATE memory_index_spaces SET backfill_cursor=? WHERE fingerprint=? AND backfill_cursor=?')
        .run(ids[ids.length - 1], descriptor.fingerprint, cursor);
    } else {
      await db.prepare('UPDATE memory_index_spaces SET backfill_complete=1 WHERE fingerprint=? AND backfill_cursor=?').run(descriptor.fingerprint, cursor);
    }
  }
  private async processBatch(): Promise<void> {
    const descriptor = await this.descriptor();
    await this.prepareSpace(descriptor);
    const db = this.database.connection;
    const candidates = await db.prepare(`SELECT id FROM memories
      WHERE (index_pending=1 OR (deleted_at IS NULL AND index_fingerprint<>?))
      AND (index_next_attempt_at IS NULL OR index_next_attempt_at<=NOW(3))
      AND (index_owner IS NULL OR index_lease_until<NOW(3))
      ORDER BY index_attempts ASC, updated_at ASC, id ASC LIMIT 20`).all(descriptor.fingerprint);
    for (const candidate of candidates) {
      if (this.stopped) break;
      const id = String(candidate.id), owner = randomUUID();
      const claim = await db.prepare(`UPDATE memories SET index_pending=1,index_owner=?,index_lease_until=DATE_ADD(NOW(3),INTERVAL 180 SECOND)
        WHERE id=? AND (index_pending=1 OR (deleted_at IS NULL AND index_fingerprint<>?))
        AND (index_next_attempt_at IS NULL OR index_next_attempt_at<=NOW(3))
        AND (index_owner IS NULL OR index_lease_until<NOW(3))`).run(owner, id, descriptor.fingerprint);
      if (!claim.changes) continue;
      const heartbeat = setInterval(() => {
        void db.prepare('UPDATE memories SET index_lease_until=DATE_ADD(NOW(3),INTERVAL 180 SECOND) WHERE id=? AND index_owner=?')
          .run(id, owner).catch(() => {});
      }, 30000);
      heartbeat.unref();
      let revision: string | undefined;
      try {
        const row = await db.prepare(`SELECT ${MEMORY_COLUMNS},deleted_at AS deletedAt,
          index_revision AS indexRevision,index_attempts AS indexAttempts FROM memories WHERE id=? AND index_owner=?`).get(id, owner) as unknown as IndexRow | undefined;
        if (!row) continue;
        revision = String(row.indexRevision);
        if (row.deletedAt) {
          const spaces = await db.prepare('SELECT collection_name FROM memory_index_spaces').all();
          for (const space of spaces) await this.vectors.deleteMemory(String(space.collection_name), row.userId, id);
        } else {
          const [vector] = await this.embeddings.embed([row.content], descriptor);
          await this.vectors.upsertMemory(descriptor, {
            id, userId: row.userId, agentId: row.agentId, memoryType: row.memoryType,
            revision, contentHash: memoryIndexHash(row),
          }, vector);
        }
        // A concurrent update/delete cannot be acknowledged by this older job.
        const acknowledged = await db.prepare(`UPDATE memories SET index_pending=0,index_fingerprint=?,index_attempts=0,index_next_attempt_at=NULL
          WHERE id=? AND index_owner=? AND index_revision=?`).run(descriptor.fingerprint, id, owner, revision);
        // A lease-lost worker may have overwritten a newer point. Requeue even if the newer worker already finished.
        if (!acknowledged.changes) await db.prepare('UPDATE memories SET index_pending=1,index_next_attempt_at=NULL WHERE id=?').run(id);
      } catch {
        this.readyFingerprint = '';
        if (revision) await db.prepare(`UPDATE memories SET index_attempts=index_attempts+1,
          index_next_attempt_at=DATE_ADD(NOW(3),INTERVAL LEAST(300,5*POW(2,LEAST(index_attempts,6))) SECOND)
          WHERE id=? AND index_owner=? AND index_revision=?`).run(id, owner, revision);
        this.logger.warn('Memory index item retained for retry');
      } finally {
        clearInterval(heartbeat);
        await db.prepare('UPDATE memories SET index_owner=NULL,index_lease_until=NULL WHERE id=? AND index_owner=?').run(id, owner);
      }
    }
  }
}
