import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AddKnowledgeDocumentDto, CreateKnowledgeBaseDto, CreateUserLibraryFileDto } from './dto/knowledge.dto';

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

export interface UserLibraryFile {
  id: string;
  userId: string;
  filename: string;
  fileType: string;
  mimeType: string;
  source: string;
  kbStatus: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  knowledgeDocumentId?: string | null;
  preview?: string;
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

type UserLibraryFileRow = Omit<UserLibraryFile, 'fileSize'> & {
  fileSize?: number | string;
  fileBase64?: string;
  parsedContent?: string;
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
    const fileType = (dto.fileType || this.fileTypeFromName(dto.title) || 'text').slice(0, 32);
    await this.databaseService.connection.prepare(
      `INSERT INTO knowledge_documents (id, kb_id, user_id, title, file_type, parse_status, vector_status, failure_reason, source_file_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(docId, kbId, userId, dto.title.trim(), fileType, 'succeeded', 'succeeded', '', dto.sourceFileId ?? '', dto.content, now, now);

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

  async listDocuments(userId: string, kbId: string, query = '') {
    await this.get(userId, kbId);
    const whereSearch = query.trim() ? 'AND (d.title LIKE ? OR d.content LIKE ?)' : '';
    const searchParams = query.trim() ? [`%${query.trim()}%`, `%${query.trim()}%`] : [];
    const rows = await this.databaseService.connection.prepare(
      `SELECT d.id, d.kb_id as kbId, d.title, d.file_type as fileType,
              d.parse_status as parseStatus, d.vector_status as vectorStatus, d.failure_reason as failureReason,
              d.content, d.created_at as createdAt, d.updated_at as updatedAt,
              COALESCE(c.chunkCount, 0) as chunkCount
       FROM knowledge_documents d
       LEFT JOIN (
         SELECT document_id, COUNT(*) as chunkCount FROM knowledge_chunks GROUP BY document_id
       ) c ON c.document_id = d.id
       WHERE d.kb_id = ? AND d.user_id = ? AND d.deleted_at IS NULL ${whereSearch}
       ORDER BY d.created_at DESC`,
    ).all(kbId, userId, ...searchParams) as unknown as Array<{ id: string; kbId: string; title: string; fileType?: string; parseStatus?: string; vectorStatus?: string; failureReason?: string; content: string; createdAt: string; updatedAt: string; chunkCount: number | string }>;
    
    return rows.map(row => ({
      ...row,
      chunkCount: Number(row.chunkCount ?? 0),
      fileType: row.fileType || this.fileTypeFromName(row.title),
      parseStatus: row.parseStatus || 'succeeded',
      vectorStatus: row.vectorStatus || 'succeeded',
      failureReason: row.failureReason || '',
      preview: row.content.substring(0, 500) + (row.content.length > 500 ? '...' : ''),
      content: row.content,
    }));
  }

  async getDocumentDetail(userId: string, docId: string) {
    const row = await this.databaseService.connection.prepare(
      `SELECT d.id, d.kb_id as kbId, d.title, d.file_type as fileType,
              d.parse_status as parseStatus, d.vector_status as vectorStatus, d.failure_reason as failureReason,
              d.content, d.created_at as createdAt, d.updated_at as updatedAt,
              COALESCE(c.chunkCount, 0) as chunkCount
       FROM knowledge_documents d
       LEFT JOIN (
         SELECT document_id, COUNT(*) as chunkCount FROM knowledge_chunks GROUP BY document_id
       ) c ON c.document_id = d.id
       WHERE d.id = ? AND d.user_id = ? AND d.deleted_at IS NULL`,
    ).get(docId, userId) as unknown as { id: string; kbId: string; title: string; fileType?: string; parseStatus?: string; vectorStatus?: string; failureReason?: string; content: string; createdAt: string; updatedAt: string; chunkCount: number | string } | undefined;
    if (!row) throw new NotFoundException('知识库文档不存在');
    const chunks = await this.listDocumentChunks(userId, docId);
    return {
      ...row,
      chunkCount: Number(row.chunkCount ?? 0),
      fileType: row.fileType || this.fileTypeFromName(row.title),
      parseStatus: row.parseStatus || 'succeeded',
      vectorStatus: row.vectorStatus || 'succeeded',
      failureReason: row.failureReason || '',
      chunks,
    };
  }

  async listDocumentChunks(userId: string, docId: string) {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, kb_id as kbId, document_id as documentId, chunk_index as chunkIndex, content,
              embedding_json as embeddingJson, token_estimate as tokenEstimate, created_at as createdAt
       FROM knowledge_chunks
       WHERE document_id = ? AND user_id = ?
       ORDER BY chunk_index ASC`,
    ).all(docId, userId) as unknown as Array<{ id: string; kbId: string; documentId: string; chunkIndex: number | string; content: string; embeddingJson?: string; tokenEstimate: number | string; createdAt: string }>;
    return rows.map((row) => ({
      ...row,
      chunkIndex: Number(row.chunkIndex ?? 0),
      tokenEstimate: Number(row.tokenEstimate ?? 0),
      vectorStatus: row.embeddingJson ? 'succeeded' : 'pending',
    }));
  }

  async reparseDocument(userId: string, docId: string) {
    const detail = await this.getDocumentDetail(userId, docId);
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `DELETE FROM knowledge_chunks WHERE document_id = ? AND user_id = ?`,
    ).run(docId, userId);
    const chunks = this.chunkText(detail.content);
    const stmt = this.databaseService.connection.prepare(
      `INSERT INTO knowledge_chunks (id, kb_id, document_id, user_id, chunk_index, content, embedding_json, token_estimate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < chunks.length; i++) {
      await stmt.run(randomUUID(), detail.kbId, docId, userId, i, chunks[i], JSON.stringify(this.embed(chunks[i])), this.estimateTokens(chunks[i]), now);
    }
    await this.databaseService.connection.prepare(
      `UPDATE knowledge_documents SET parse_status = ?, vector_status = ?, failure_reason = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run('succeeded', 'succeeded', '', now, docId, userId);
    return { id: docId, kbId: detail.kbId, title: detail.title, chunkCount: chunks.length };
  }

  async deleteDocument(userId: string, docId: string) {
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE knowledge_documents SET deleted_at = ? WHERE id = ? AND user_id = ?`,
    ).run(now, docId, userId);
    await this.databaseService.connection.prepare(
      `DELETE FROM knowledge_chunks WHERE document_id = ? AND user_id = ?`,
    ).run(docId, userId);
    return { success: true };
  }

  async listUserLibraryFiles(
    userId: string,
    filters: { query?: string; fileType?: string; source?: string; kbStatus?: string } = {},
  ): Promise<UserLibraryFile[]> {
    const clauses = ['user_id = ?', 'deleted_at IS NULL'];
    const params: unknown[] = [userId];
    if (filters.query?.trim()) {
      clauses.push('filename LIKE ?');
      params.push(`%${filters.query.trim()}%`);
    }
    if (filters.fileType?.trim()) {
      clauses.push('file_type = ?');
      params.push(filters.fileType.trim());
    }
    if (filters.source?.trim()) {
      clauses.push('source = ?');
      params.push(filters.source.trim());
    }
    if (filters.kbStatus?.trim()) {
      clauses.push('kb_status = ?');
      params.push(filters.kbStatus.trim());
    }
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, filename, file_type as fileType, mime_type as mimeType, source,
              kb_status as kbStatus, file_size as fileSize, knowledge_document_id as knowledgeDocumentId,
              parsed_content as parsedContent, created_at as createdAt, updated_at as updatedAt
       FROM user_library_files
       WHERE ${clauses.join(' AND ')}
       ORDER BY updated_at DESC`,
    ).all(...params) as unknown as UserLibraryFileRow[];
    return rows.map((row) => ({
      ...row,
      fileSize: Number(row.fileSize ?? 0),
      preview: (row.parsedContent || '').substring(0, 300),
    }));
  }

  async createUserLibraryFile(userId: string, dto: CreateUserLibraryFileDto): Promise<UserLibraryFile> {
    const id = randomUUID();
    const now = this.databaseService.now();
    const base64Data = dto.fileBase64.includes(',') ? dto.fileBase64.split(',')[1] : dto.fileBase64;
    const fileSize = Buffer.from(base64Data, 'base64').byteLength;
    const fileType = this.fileTypeFromName(dto.filename);
    let parsedContent = '';
    try {
      parsedContent = (await this.parseFile(dto.fileBase64, dto.filename)).content;
    } catch {
      parsedContent = this.plainTextPreview(dto.fileBase64, dto.filename);
    }
    await this.databaseService.connection.prepare(
      `INSERT INTO user_library_files (id, user_id, filename, file_type, mime_type, source, kb_status, file_size, file_base64, parsed_content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      dto.filename.trim(),
      fileType,
      dto.mimeType ?? '',
      dto.source ?? 'user_upload',
      'not_added',
      fileSize,
      dto.fileBase64,
      parsedContent,
      now,
      now,
    );
    return this.getUserLibraryFile(userId, id, false);
  }

  async getUserLibraryFile(userId: string, fileId: string, includeContent = true): Promise<UserLibraryFile & { fileBase64?: string; parsedContent?: string }> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, filename, file_type as fileType, mime_type as mimeType, source,
              kb_status as kbStatus, file_size as fileSize, file_base64 as fileBase64,
              parsed_content as parsedContent, knowledge_document_id as knowledgeDocumentId,
              created_at as createdAt, updated_at as updatedAt
       FROM user_library_files
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(fileId, userId) as unknown as UserLibraryFileRow | undefined;
    if (!row) throw new NotFoundException('用户库文件不存在');
    const file = {
      ...row,
      fileSize: Number(row.fileSize ?? 0),
      preview: (row.parsedContent || '').substring(0, 300),
    };
    if (!includeContent) {
      delete file.fileBase64;
      delete file.parsedContent;
    }
    return file;
  }

  async renameUserLibraryFile(userId: string, fileId: string, filename: string) {
    const now = this.databaseService.now();
    await this.getUserLibraryFile(userId, fileId, false);
    await this.databaseService.connection.prepare(
      `UPDATE user_library_files SET filename = ?, file_type = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run(filename.trim(), this.fileTypeFromName(filename), now, fileId, userId);
    return this.getUserLibraryFile(userId, fileId, false);
  }

  async deleteUserLibraryFile(userId: string, fileId: string) {
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE user_library_files SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run(now, now, fileId, userId);
    return { success: true };
  }

  async addUserLibraryFileToKnowledge(userId: string, fileId: string, kbId: string) {
    const file = await this.getUserLibraryFile(userId, fileId, true);
    let content = file.parsedContent || '';
    if (!content.trim() && file.fileBase64) {
      content = (await this.parseFile(file.fileBase64, file.filename)).content;
    }
    if (!content.trim()) throw new BadRequestException('该文件无法解析出可入库文本');
    const result = await this.addDocument(userId, kbId, {
      title: file.filename,
      content,
      sourceFileId: file.id,
      fileType: file.fileType,
    });
    await this.databaseService.connection.prepare(
      `UPDATE user_library_files SET kb_status = ?, parsed_content = ?, knowledge_document_id = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run('added', content, result.id, this.databaseService.now(), fileId, userId);
    return result;
  }

  async parseFile(fileBase64: string, filename: string): Promise<{ content: string }> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // 从base64提取内容
    const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    
    let content = '';
    
    switch (ext) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
        content = buffer.toString('utf-8');
        break;
        
      case 'pdf':
        content = await this.extractTextFromPdf(buffer);
        break;
        
      case 'docx':
        content = await this.extractTextFromWord(buffer);
        break;

      case 'doc':
        content = this.extractTextFromLegacyOffice(buffer, 'Word');
        break;
        
      case 'xls':
      case 'xlsx':
        content = await this.extractTextFromExcel(buffer);
        break;
        
      default:
        throw new BadRequestException(`不支持的文件格式: ${ext}`);
    }

    const normalized = this.normalizeExtractedText(content);
    if (!normalized) {
      throw new BadRequestException(`未能从 ${filename} 解析出可写入知识库的文本内容`);
    }

    return { content: normalized };
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    const { PDFParse } = await this.loadOptionalModule<{ PDFParse: new (options: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } }>('pdf-parse', 'PDF');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  private async extractTextFromWord(buffer: Buffer): Promise<string> {
    const mammoth = await this.loadOptionalModule<{ extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages?: Array<{ message?: string }> }> }>('mammoth', 'Word');
    const result = await mammoth.extractRawText({ buffer });
    const warnings = result.messages?.map((msg) => msg.message).filter(Boolean) ?? [];
    return [result.value, warnings.length ? `\n\n[Word解析提示]\n${warnings.join('\n')}` : ''].join('');
  }

  private async extractTextFromExcel(buffer: Buffer): Promise<string> {
    const XLSX = await this.loadOptionalModule<{
      read: (data: Buffer, options: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_csv: (sheet: unknown, options: Record<string, unknown>) => string };
    }>('xlsx', 'Excel');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: false });
    const sections: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n', blankrows: false });
      if (csv.trim()) {
        sections.push(`## Sheet: ${sheetName}\n${csv.trim()}`);
      }
    }
    return sections.join('\n\n');
  }

  private async loadOptionalModule<T>(moduleName: string, label: string): Promise<T> {
    try {
      return await import(moduleName) as T;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (
        err.code === 'MODULE_NOT_FOUND' ||
        err.code === 'ERR_MODULE_NOT_FOUND' ||
        err.message?.includes(`Cannot find package '${moduleName}'`) ||
        err.message?.includes(`Cannot find module '${moduleName}'`)
      ) {
        throw new BadRequestException(`${label} 文件解析依赖缺失：请在后端镜像中安装 ${moduleName}`);
      }
      throw error;
    }
  }

  private extractTextFromLegacyOffice(buffer: Buffer, label: string): string {
    const decoded = buffer.toString('latin1');
    const text = decoded
      .replace(/\0/g, ' ')
      .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!text || text.length < 20) {
      throw new BadRequestException(`${label} .doc 老二进制格式解析失败，请另存为 .docx 后上传`);
    }
    return text;
  }

  private normalizeExtractedText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\t/g, ' | ').replace(/[ \u00a0]{2,}/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 200000);
  }

  private fileTypeFromName(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (ext === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['txt', 'json'].includes(ext)) return 'text';
    return ext || 'unknown';
  }

  private plainTextPreview(fileBase64: string, filename: string): string {
    const type = this.fileTypeFromName(filename);
    if (!['text', 'markdown', 'excel'].includes(type)) return '';
    try {
      const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      return Buffer.from(base64Data, 'base64').toString('utf-8').slice(0, 200000);
    } catch {
      return '';
    }
  }

  async search(
    userId: string,
    kbIds: string[],
    query: string,
    limit = 5,
    options: { mode?: 'hybrid' | 'keyword' | 'vector' } = {},
  ): Promise<KnowledgeSearchResult[]> {
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
    const mode = options.mode ?? 'hybrid';
    return rows
      .map((row) => {
        const keywordScore = mode === 'vector' ? 0 : this.score(row.content + '\n' + row.title, terms);
        const vectorScore = mode === 'keyword' ? 0 : this.cosine(queryVector, this.parseVector(row.embeddingJson));
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
