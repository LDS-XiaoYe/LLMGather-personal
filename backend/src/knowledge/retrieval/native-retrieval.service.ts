import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { KnowledgeSearchResult } from '../knowledge.service';
import { EmbeddingDescriptor, EmbeddingService } from './embedding.service';
import { KnowledgeIndexService } from './knowledge-index.service';
import { QdrantService } from './qdrant.service';
import { analyzeLexicalQuery, rankLexicalRows } from './lexical-query';
import { diversifyKnowledgeResults, fuseKnowledgeResults, mayDegrade } from './retrieval-results';
import type { RetrievalMode, RetrievalOptions, RetrievalMeta } from './retrieval.types';
export type { RetrievalMode } from './retrieval.types';
export interface RetrievalProvider {
  search(user: string, kbIds: string[], query: string, limit: number, mode: RetrievalMode): Promise<KnowledgeSearchResult[]>;
}
@Injectable()
export class NativeRetrievalService implements RetrievalProvider {
  constructor(private readonly database: DatabaseService, private readonly embeddings: EmbeddingService,
    private readonly vectors: QdrantService, private readonly indexes: KnowledgeIndexService) {}

  async search(user: string, kbIds: string[], query: string, limit: number, mode: RetrievalMode): Promise<KnowledgeSearchResult[]> {
    return (await this.searchDetailed(user, kbIds, query, limit, { mode })).data;
  }

  async searchDetailed(user: string, kbIds: string[], query: string, limit: number, options: RetrievalOptions = {}) {
    const mode = options.mode || 'hybrid';
    const meta: RetrievalMeta = { requestedMode: mode, effectiveMode: mode, degraded: false, warnings: [],
      queryTerms: mode === 'vector' ? [] : analyzeLexicalQuery(query).terms, minDenseScore: options.minDenseScore };
    if (!kbIds.length || !query.trim()) return { data: [] as KnowledgeSearchResult[], meta };
    const candidates = Math.min(200, Math.max(options.candidates ?? limit * 4, limit, 20));
    let keyword: KnowledgeSearchResult[] = [], lexicalReady = false, denseReady = false, firstError: unknown;
    const failed = (error: unknown, stage: 'keyword' | 'vector', ids: string[]) => {
      if (options.failurePolicy !== 'degrade' || !mayDegrade(error)) throw error;
      firstError ??= error;
      meta.degraded = true;
      meta.warnings.push(...ids.map(kbId => ({ kbId, stage, code: stage === 'vector' ? 'SEMANTIC_UNAVAILABLE' : 'LEXICAL_UNAVAILABLE' })));
    };
    if (mode !== 'vector') {
      try { keyword = await this.keyword(user, kbIds, query, candidates); lexicalReady = true; }
      catch (error) { failed(error, 'keyword', kbIds); }
    }
    if (mode === 'keyword') {
      if (!lexicalReady) throw firstError;
      return { data: diversifyKnowledgeResults(keyword, limit), meta };
    }
    const groups = new Map<string, { descriptor: EmbeddingDescriptor; ids: string[] }>();
    for (const kb of kbIds) {
      try {
        const descriptor = await this.embeddings.describe(kb);
        await this.indexes.requireReady(user, [kb], descriptor);
        const group = groups.get(descriptor.fingerprint) || { descriptor, ids: [] };
        group.ids.push(kb); groups.set(descriptor.fingerprint, group);
      } catch (error) { failed(error, 'vector', [kb]); }
    }
    const ranked: KnowledgeSearchResult[][] = [];
    for (const group of groups.values()) {
      try {
        ranked.push(await this.dense(user, group.ids, query, candidates, group.descriptor, options.minDenseScore));
        denseReady = true;
      } catch (error) { failed(error, 'vector', group.ids); }
    }
    const weights = ranked.map(() => 1);
    if (mode === 'hybrid' && lexicalReady) { ranked.push(keyword); weights.push(0.7); }
    if (!denseReady && !lexicalReady) throw firstError || new Error('No retrieval route is available');
    meta.effectiveMode = denseReady ? (mode === 'hybrid' && lexicalReady ? 'hybrid' : 'vector') : 'keyword';
    const nonempty = ranked.map((rows, index) => ({ rows, weight: weights[index] })).filter(group => group.rows.length);
    const rows = nonempty.length === 1 ? nonempty[0].rows : fuseKnowledgeResults(nonempty.map(g => g.rows), candidates, nonempty.map(g => g.weight));
    return { data: diversifyKnowledgeResults(rows, limit), meta };
  }

  private async dense(user: string, kbIds: string[], query: string, candidates: number, descriptor: EmbeddingDescriptor, minScore?: number): Promise<KnowledgeSearchResult[]> {
    const [embedding] = await this.embeddings.embed([query], descriptor);
    const points = (await this.vectors.search(descriptor, embedding, user, kbIds, candidates, minScore))
      .filter(point => Number.isFinite(point.score) && (minScore === undefined || point.score >= minScore));
    if (!points.length) return [];
    const rows = await this.database.connection.prepare(
      'SELECT c.id,c.kb_id AS kbId,c.document_id AS documentId,d.title,c.content ' +
      'FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id AND d.kb_id=c.kb_id ' +
      'JOIN knowledge_bases b ON b.id=c.kb_id WHERE c.user_id=? AND d.user_id=? AND b.user_id=? ' +
      'AND c.kb_id IN (' + kbIds.map(() => '?').join(',') + ') AND c.id IN (' + points.map(() => '?').join(',') + ') ' +
      'AND d.deleted_at IS NULL AND b.deleted_at IS NULL',
    ).all(user, user, user, ...kbIds, ...points.map(point => point.id)) as unknown as KnowledgeSearchResult[];
    const byId = new Map(rows.map(row => [row.id, row]));
    return points.flatMap((point, index) => byId.has(point.id) ? [{ ...byId.get(point.id)!, score: point.score,
      denseScore: point.score, scoreType: 'cosine' as const, sources: ['dense' as const], ranks: { dense: index + 1 } }] : []);
  }

  async keyword(user: string, kbIds: string[], query: string, limit: number): Promise<KnowledgeSearchResult[]> {
    if (!kbIds.length || !query.trim()) return [];
    const analysis = analyzeLexicalQuery(query);
    if (!analysis.terms.length) return [];
    const bound = Math.max(1, Math.min(200, Math.floor(limit)));
    const scope = 'c.user_id=? AND d.user_id=? AND b.user_id=? AND c.kb_id IN (' + kbIds.map(() => '?').join(',') + ')' +
      ' AND d.deleted_at IS NULL AND b.deleted_at IS NULL';
    const from = 'FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id AND d.kb_id=c.kb_id ' +
      'JOIN knowledge_bases b ON b.id=c.kb_id';
    const fields = 'c.id,c.kb_id AS kbId,c.document_id AS documentId,d.title,c.content';
    const parameters = [user, user, user, ...kbIds];
    const execute = (sql: string, args: unknown[]) => this.database.connection.prepare(sql).all(...args) as unknown as Promise<KnowledgeSearchResult[]>;
    const routes: Promise<KnowledgeSearchResult[]>[] = [execute(
      'SELECT ' + fields + ',MATCH(c.content) AGAINST(? IN BOOLEAN MODE) AS fulltextScore ' + from +
      ' WHERE MATCH(c.content) AGAINST(? IN BOOLEAN MODE)>0 AND ' + scope +
      ' ORDER BY fulltextScore DESC,c.id ASC LIMIT ' + bound,
      [analysis.booleanQuery, analysis.booleanQuery, ...parameters]), execute(
      'SELECT id,kbId,documentId,title,content,fulltextScore FROM (' +
      'SELECT ' + fields + ',MATCH(d.title) AGAINST(? IN BOOLEAN MODE) AS fulltextScore,' +
      'ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY MATCH(c.content) AGAINST(? IN BOOLEAN MODE) DESC,c.chunk_index,c.id) AS docRank ' +
      from + ' WHERE MATCH(d.title) AGAINST(? IN BOOLEAN MODE)>0 AND ' + scope +
      ') matched WHERE docRank<=3 ORDER BY fulltextScore DESC,id ASC LIMIT ' + bound,
      [analysis.booleanQuery, analysis.booleanQuery, analysis.booleanQuery, ...parameters])];
    // Rare technical entity route enforces boundaries/punctuation that ngram cannot represent.
    if (analysis.entityPattern) routes.push(execute(
      'SELECT ' + fields + ',0 AS fulltextScore ' + from + ' WHERE ' + scope +
      ' AND REGEXP_LIKE(LOWER(CONCAT(d.title,\' \',c.content)),?)' +
      ' ORDER BY REGEXP_LIKE(LOWER(c.content),?) DESC,c.id ASC LIMIT ' + bound,
      [...parameters, analysis.entityPattern, analysis.entityPattern]));
    return diversifyKnowledgeResults(rankLexicalRows((await Promise.all(routes)).flat(), analysis), bound);
  }
}
