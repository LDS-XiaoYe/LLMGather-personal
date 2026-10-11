import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { KnowledgeSearchResult } from '../knowledge.service';
import { EmbeddingDescriptor, EmbeddingService } from './embedding.service';
import { KnowledgeIndexService } from './knowledge-index.service';
import { QdrantService } from './qdrant.service';
import { reciprocalRankFusion } from './rrf';

export type RetrievalMode = 'keyword' | 'vector' | 'hybrid';
export interface RetrievalProvider {
  search(
    user: string,
    kbIds: string[],
    query: string,
    limit: number,
    mode: RetrievalMode,
  ): Promise<KnowledgeSearchResult[]>;
}
@Injectable()
export class NativeRetrievalService implements RetrievalProvider {
  constructor(
    private readonly database: DatabaseService,
    private readonly embeddings: EmbeddingService,
    private readonly vectors: QdrantService,
    private readonly indexes: KnowledgeIndexService,
  ) {}
  async search(
    user: string,
    kbIds: string[],
    query: string,
    limit: number,
    mode: RetrievalMode,
  ): Promise<KnowledgeSearchResult[]> {
    if (!kbIds.length) return [];
    const candidates = Math.min(200, Math.max(limit * 4, 20));
    const keyword = mode === 'vector' ? [] : await this.keyword(user, kbIds, query, candidates);
    if (mode === 'keyword') return keyword.slice(0, limit);
    const groups=new Map<string,{descriptor:EmbeddingDescriptor;ids:string[]}>();
    for(const kb of kbIds){const descriptor=await this.embeddings.describe(kb);const group=groups.get(descriptor.fingerprint)||{descriptor,ids:[]};group.ids.push(kb);groups.set(descriptor.fingerprint,group);}
    const ranked:KnowledgeSearchResult[][]=[];
    for(const group of groups.values())ranked.push(await this.dense(user,group.ids,query,candidates,group.descriptor));
    if(mode==='hybrid')ranked.push(keyword);
    return ranked.length===1?ranked[0].slice(0,limit):reciprocalRankFusion(ranked,limit);
  }
  private async dense(user:string,kbIds:string[],query:string,candidates:number,descriptor:EmbeddingDescriptor):Promise<KnowledgeSearchResult[]>{
    await this.indexes.requireReady(user, kbIds, descriptor);
    const [embedding] = await this.embeddings.embed([query], descriptor);
    const points = await this.vectors.search(descriptor, embedding, user, kbIds, candidates);
    if (!points.length) return [];
    // Never trust vector payloads for content or authorization; hydrate only authorized/live MySQL chunks.
    const rows = (await this.database.connection
      .prepare(
        `SELECT c.id,c.kb_id AS kbId,c.document_id AS documentId,d.title,c.content
      FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id
      JOIN knowledge_bases b ON b.id=c.kb_id WHERE c.user_id=? AND d.user_id=? AND b.user_id=?
      AND c.kb_id IN (${kbIds.map(() => '?').join(',')}) AND c.id IN (${points.map(() => '?').join(',')})
      AND d.deleted_at IS NULL AND b.deleted_at IS NULL`,
      )
      .all(user, user, user, ...kbIds, ...points.map((p) => p.id))) as Omit<KnowledgeSearchResult, 'score'>[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const dense = points.flatMap((point) =>
      byId.has(point.id) ? [{ ...byId.get(point.id)!, score: point.score }] : [],
    );
    return dense;
  }
  async keyword(user: string, kbIds: string[], query: string, limit: number): Promise<KnowledgeSearchResult[]> {
    const terms = [
      ...new Set(query.toLowerCase().match(/[a-z0-9_]{2,}|[\u3400-\u9fff]{2,}/g) || [query.toLowerCase()]),
    ].slice(0, 16);
    if (!terms.length || !query.trim()) return [];
    const score = terms.map(() => "(LOCATE(?,LOWER(CONCAT(d.title,' ',c.content)))>0)").join('+');
    const bound = Math.max(1, Math.min(200, Math.floor(limit)));
    // MySQL computes and ranks matching candidates over ALL live chunks, not the newest 300.
    return this.database.connection
      .prepare(
        `SELECT c.id,c.kb_id AS kbId,c.document_id AS documentId,d.title,c.content,(${score}) AS score
      FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id JOIN knowledge_bases b ON b.id=c.kb_id
      WHERE c.user_id=? AND d.user_id=? AND b.user_id=? AND c.kb_id IN (${kbIds.map(() => '?').join(',')})
      AND d.deleted_at IS NULL AND b.deleted_at IS NULL HAVING score>0 ORDER BY score DESC,c.id ASC LIMIT ${bound}`,
      )
      .all(...terms, user, user, user, ...kbIds) as unknown as Promise<KnowledgeSearchResult[]>;
  }
}
