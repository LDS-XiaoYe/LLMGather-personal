import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AddKnowledgeDocumentDto, CreateKnowledgeBaseDto } from './dto/knowledge.dto';

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSearchResult {
  id: string;
  kbId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
}

type KnowledgeBaseRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  documentCount?: number | string;
  chunkCount?: number | string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class KnowledgeService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(userId: string): Promise<KnowledgeBase[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT kb.id, kb.user_id as userId, kb.name, kb.description, kb.created_at as createdAt, kb.updated_at as updatedAt,
              COALESCE(docs.documentCount, 0) as documentCount,
              COALESCE(chunks.chunkCount, 0) as chunkCount
       FROM knowledge_bases kb
       LEFT JOIN (
         SELECT kb_id, COUNT(*) as documentCount FROM knowledge_documents
         WHERE deleted_at IS NULL GROUP BY kb_id
       ) docs ON docs.kb_id = kb.id
       LEFT JOIN (
         SELECT kb_id, COUNT(*) as chunkCount FROM knowledge_chunks GROUP BY kb_id
       ) chunks ON chunks.kb_id = kb.id
       WHERE kb.user_id = ? AND kb.deleted_at IS NULL
       ORDER BY kb.updated_at DESC`,
    ).all(userId) as unknown as KnowledgeBaseRow[];
    return rows.map((row) => ({
      ...row,
      documentCount: Number(row.documentCount ?? 0),
      chunkCount: Number(row.chunkCount ?? 0),
    }));
  }

  async create(userId: string, dto: CreateKnowledgeBaseDto): Promise<KnowledgeBase> {
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO knowledge_bases (id, user_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, dto.name.trim(), dto.description?.trim() ?? '', now, now);
    const kb = (await this.list(userId)).find((item) => item.id === id);
    if (!kb) throw new NotFoundException('知识库创建失败');
    return kb;
  }

  async get(userId: string, kbId: string): Promise<KnowledgeBase> {
    const kb = (await this.list(userId)).find((item) => item.id === kbId);
    if (!kb) throw new NotFoundException('知识库不存在');
    return kb;
  }

  async addDocument(userId: string, kbId: string, dto: AddKnowledgeDocumentDto) {
    await this.get(userId, kbId);
    const docId = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO knowledge_documents (id, kb_id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(docId, kbId, userId, dto.title.trim(), dto.content, now, now);

    const chunks = this.chunkText(dto.content);
    const stmt = this.databaseService.connection.prepare(
      `INSERT INTO knowledge_chunks (id, kb_id, document_id, user_id, chunk_index, content, embedding_json, token_estimate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < chunks.length; i++) {
      await stmt.run(
        randomUUID(),
        kbId,
        docId,
        userId,
        i,
        chunks[i],
        JSON.stringify(this.embed(chunks[i])),
        this.estimateTokens(chunks[i]),
        now,
      );
    }

    return { id: docId, kbId, title: dto.title.trim(), chunkCount: chunks.length };
  }

  async search(userId: string, kbIds: string[], query: string, limit = 5): Promise<KnowledgeSearchResult[]> {
    const uniqueKbIds = Array.from(new Set(kbIds.filter(Boolean)));
    if (uniqueKbIds.length === 0 || !query.trim()) return [];

    for (const kbId of uniqueKbIds) {
      await this.get(userId, kbId);
    }

    const placeholders = uniqueKbIds.map(() => '?').join(',');
    const rows = await this.databaseService.connection.prepare(
      `SELECT c.id, c.kb_id as kbId, c.document_id as documentId, d.title, c.content, c.embedding_json as embeddingJson
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.document_id
       WHERE c.user_id = ? AND c.kb_id IN (${placeholders}) AND d.deleted_at IS NULL
       ORDER BY c.created_at DESC
       LIMIT 300`,
    ).all(userId, ...uniqueKbIds) as unknown as Array<Omit<KnowledgeSearchResult, 'score'> & { embeddingJson?: string }>;

    const terms = this.terms(query);
    const queryVector = this.embed(query);
    return rows
      .map((row) => {
        const keywordScore = this.score(row.content + '\n' + row.title, terms);
        const vectorScore = this.cosine(queryVector, this.parseVector(row.embeddingJson));
        return {
          id: row.id,
          kbId: row.kbId,
          documentId: row.documentId,
          title: row.title,
          content: row.content,
          score: Number((keywordScore + vectorScore * 100).toFixed(4)),
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getAgentKnowledgeBases(userId: string, agentId: string): Promise<KnowledgeBase[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT kb.id, kb.user_id as userId, kb.name, kb.description, kb.created_at as createdAt, kb.updated_at as updatedAt,
              0 as documentCount, 0 as chunkCount
       FROM agent_knowledge_bases akb
       JOIN knowledge_bases kb ON kb.id = akb.kb_id
       WHERE akb.user_id = ? AND akb.agent_id = ? AND kb.deleted_at IS NULL
       ORDER BY kb.name ASC`,
    ).all(userId, agentId) as unknown as KnowledgeBaseRow[];
    return rows.map((row) => ({
      ...row,
      documentCount: Number(row.documentCount ?? 0),
      chunkCount: Number(row.chunkCount ?? 0),
    }));
  }

  async setAgentKnowledgeBases(userId: string, agentId: string, kbIds: string[]): Promise<void> {
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_knowledge_bases WHERE user_id = ? AND agent_id = ?',
    ).run(userId, agentId);

    const uniqueIds = Array.from(new Set(kbIds.filter(Boolean)));
    for (const kbId of uniqueIds) {
      await this.get(userId, kbId);
      await this.databaseService.connection.prepare(
        'INSERT INTO agent_knowledge_bases (agent_id, kb_id, user_id, created_at) VALUES (?, ?, ?, ?)',
      ).run(agentId, kbId, userId, this.databaseService.now());
    }
  }

  private chunkText(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    const chunks: string[] = [];
    const size = 1200;
    const overlap = 160;
    for (let start = 0; start < normalized.length; start += size - overlap) {
      const chunk = normalized.slice(start, start + size).trim();
      if (chunk) chunks.push(chunk);
    }
    return chunks.length > 0 ? chunks : [normalized];
  }

  private estimateTokens(text: string): number {
    let ascii = 0;
    let cjk = 0;
    for (const ch of text) {
      if (/[\u3400-\u9fff]/.test(ch)) cjk++;
      else ascii++;
    }
    return Math.max(1, Math.ceil(cjk / 1.5 + ascii / 4));
  }

  private terms(query: string): string[] {
    const asciiTerms = query.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [];
    const cjkTerms = Array.from(query.matchAll(/[\u3400-\u9fff]{2,}/g)).map((m) => m[0]);
    return Array.from(new Set([...asciiTerms, ...cjkTerms]));
  }

  private score(text: string, terms: string[]): number {
    if (terms.length === 0) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const count = lower.split(term.toLowerCase()).length - 1;
      score += count * Math.min(10, term.length);
    }
    return score;
  }

  private embed(text: string): number[] {
    const vector = Array.from({ length: 64 }, () => 0);
    const terms = this.terms(text);
    const chars = Array.from(text.replace(/\s+/g, '').slice(0, 2000));
    for (const term of terms) {
      const idx = this.hash(term) % vector.length;
      vector[idx] += Math.min(4, term.length);
    }
    for (let i = 0; i < chars.length - 1; i++) {
      const gram = chars[i] + chars[i + 1];
      const idx = this.hash(gram) % vector.length;
      vector[idx] += 0.25;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / norm).toFixed(6)));
  }

  private parseVector(raw?: string): number[] {
    try {
      const parsed = JSON.parse(raw || '[]') as unknown;
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }

  private cosine(left: number[], right: number[]): number {
    if (!left.length || !right.length) return 0;
    const size = Math.min(left.length, right.length);
    let sum = 0;
    for (let i = 0; i < size; i++) sum += left[i] * right[i];
    return Math.max(0, sum);
  }

  private hash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }
}
