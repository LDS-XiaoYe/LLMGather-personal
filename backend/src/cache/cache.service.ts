import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import {
  similarityScore,
  queryHash,
  CacheEntry,
  SIMILARITY_THRESHOLD,
} from './semantic-cache.store';

@Injectable()
export class CacheService {
  constructor(private readonly db: DatabaseService) {}

  /** Look up cached response by semantic similarity */
  async lookup(query: string, model: string): Promise<CacheEntry | null> {
    const hash = queryHash(query);
    const conn = this.db.connection;

    // First try exact hash match
    const exactRow = await conn
      .prepare('SELECT * FROM semantic_cache WHERE query_hash = ? AND model = ? ORDER BY last_hit_at DESC LIMIT 1')
      .get(hash, model);
    const exact = exactRow ? this.mapEntry(exactRow) : undefined;

    if (exact) {
      // Verify similarity still meets threshold
      const sim = similarityScore(query, exact.queryText);
      if (sim >= SIMILARITY_THRESHOLD) {
        // Bump hit count
        await conn
          .prepare('UPDATE semantic_cache SET hit_count = hit_count + 1, last_hit_at = CURRENT_TIMESTAMP(3) WHERE id = ?')
          .run(exact.id);
        return exact;
      }
    }

    // Fuzzy lookup: check recent entries for the same model
    const recentRows = await conn
      .prepare('SELECT * FROM semantic_cache WHERE model = ? ORDER BY last_hit_at DESC LIMIT 50')
      .all(model);
    const recent = (recentRows as unknown[]).map((row) => this.mapEntry(row));

    for (const entry of recent) {
      const sim = similarityScore(query, entry.queryText);
      if (sim >= SIMILARITY_THRESHOLD) {
        // Update hit count
        await conn
          .prepare('UPDATE semantic_cache SET hit_count = hit_count + 1, last_hit_at = CURRENT_TIMESTAMP(3) WHERE id = ?')
          .run(entry.id);
        return entry;
      }
    }

    return null;
  }

  /** Store a new response in cache */
  async store(
    query: string,
    model: string,
    response: string,
    tokensSaved: number,
    costSaved: number,
  ): Promise<void> {
    const hash = queryHash(query);
    await this.db.connection
      .prepare(
        `INSERT INTO semantic_cache (id, query_hash, query_text, model, response, tokens_saved, cost_saved, hit_count, created_at, last_hit_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      )
      .run(randomUUID(), hash, query, model, response, tokensSaved, costSaved);
  }

  /** Get cache statistics */
  async stats(): Promise<{ totalEntries: number; totalHits: number; totalTokensSaved: number; totalCostSaved: number }> {
    const conn = this.db.connection;
    const row = await conn
      .prepare('SELECT COUNT(*) as totalEntries, COALESCE(SUM(hit_count),0) as totalHits, COALESCE(SUM(tokens_saved),0) as totalTokensSaved, COALESCE(SUM(cost_saved),0) as totalCostSaved FROM semantic_cache')
      .get() as any;
    return {
      totalEntries: Number(row?.totalEntries ?? 0),
      totalHits: Number(row?.totalHits ?? 0),
      totalTokensSaved: Number(row?.totalTokensSaved ?? 0),
      totalCostSaved: Number(row?.totalCostSaved ?? 0),
    };
  }

  private mapEntry(row: any): CacheEntry {
    return {
      id: row.id,
      queryHash: row.query_hash,
      queryText: row.query_text,
      model: row.model,
      response: row.response,
      tokensSaved: Number(row.tokens_saved ?? 0),
      costSaved: Number(row.cost_saved ?? 0),
      hitCount: Number(row.hit_count ?? 1),
      createdAt: row.created_at,
      lastHitAt: row.last_hit_at,
    };
  }
}
