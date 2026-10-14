import { ConflictException, ForbiddenException } from '@nestjs/common';
import { analyzeLexicalQuery, rankLexicalRows } from './lexical-query';
import { NativeRetrievalService } from './native-retrieval.service';
import { QdrantService } from './qdrant.service';
import { diversifyKnowledgeResults, fuseKnowledgeResults } from './retrieval-results';

const row = (id: string, content: string, title = '说明', kbId = 'good') => ({ id, kbId, documentId: id, title, content, score: 1 });
describe('lexical query and score provenance', () => {
  it('segments Chinese questions, removes stopwords and prioritizes tail technical entities', () => {
    expect(analyzeLexicalQuery('如何申请退款').terms).toEqual(expect.arrayContaining(['申请', '退款']));
    expect(analyzeLexicalQuery('how do I').terms).toEqual([]);
    expect(analyzeLexicalQuery('AI GPU').entities).toEqual(['ai', 'gpu']);
    const long = '退款 '.repeat(60) + 'E104';
    expect(analyzeLexicalQuery(long).terms[0]).toBe('e104');
  });
  it('preserves C++/C#, exact codes and comparison alternatives', () => {
    const records = [row('cpp', 'C++ 连接 MySQL'), row('cs', 'C# 连接 MySQL'), row('other', 'C 连接 MySQL')];
    expect(rankLexicalRows(records, analyzeLexicalQuery('C++ vs C#')).map(r => r.id).sort()).toEqual(['cpp', 'cs']);
    expect(rankLexicalRows([row('a', '104'), row('b', '1040')], analyzeLexicalQuery('104')).map(r => r.id)).toEqual(['a']);
  });
  it('ranks body evidence above title-only matches and keeps best duplicate fulltext score', () => {
    const a = row('a', '团建安排', '退款流程'), b = row('b', '退款需要订单号', '退款流程');
    const results = rankLexicalRows([{ ...b, fulltextScore: 8 }, { ...a, fulltextScore: 0 }, { ...b, fulltextScore: 0 }], analyzeLexicalQuery('退款'));
    expect(results[0].id).toBe('b'); expect(results[0].fulltextScore).toBe(8);
    expect(results[0].lexicalScore).toBeGreaterThan(results[1].lexicalScore);
  });
  it('fuses ranks without erasing cosine/lexical evidence or filling results with one document', () => {
    const a = row('a', '退款');
    const result = fuseKnowledgeResults([[{ ...a, denseScore: 0.91, sources: ['dense'], ranks: { dense: 1 } }],
      [{ ...a, lexicalScore: 8, sources: ['lexical'], ranks: { lexical: 2 } }]], 5, [1, 0.7])[0];
    expect(result).toMatchObject({ denseScore: 0.91, lexicalScore: 8, scoreType: 'rrf', ranks: { dense: 1, lexical: 2 } });
    expect(result.fusionScore).toBeCloseTo(1/61 + 0.7/61);
    const rows = Array.from({ length: 6 }, (_, i) => ({ ...row(String(i), 'x'), documentId: i < 5 ? 'one' : 'two' }));
    expect(diversifyKnowledgeResults(rows, 5)).toHaveLength(4);
  });
});

describe('native retrieval strict/degraded routes', () => {
  it('sends the optional cosine gate to Qdrant without changing authorization filters', async () => {
    const service = new QdrantService(), search = jest.fn(async (_collection: string, _request: unknown) => []);
    Object.defineProperty(service, 'api', { get: () => ({ search }) });
    await service.search({ fingerprint: 'space', dimensions: 1 } as never, [1], 'u', ['good'], 20, 0.2);
    expect(search.mock.calls[0][1]).toMatchObject({ score_threshold: 0.2, filter: { must: [
      { key: 'user_id', match: { value: 'u' } }, { key: 'kb_id', match: { any: ['good'] } },
      { key: 'fingerprint', match: { value: 'space' } },
    ] } });
    await service.search({ fingerprint: 'space', dimensions: 1 } as never, [1], 'u', ['good'], 20);
    expect(search.mock.calls[1][1]).not.toHaveProperty('score_threshold');
  });
  function fixture(fail: Error = new ConflictException('not ready')) {
    const embeddings = { describe: jest.fn(async (kb: string) => ({ fingerprint: kb })), embed: jest.fn(async () => [[1]]) };
    const vectors = { search: jest.fn(async () => [{ id: 'a', score: 0.91 }, { id: 'b', score: 0.002 }]) };
    const indexes = { requireReady: jest.fn(async (_u: string, ids: string[]) => { if (ids.includes('bad')) throw fail; }) };
    const service = new NativeRetrievalService({ connection: { prepare: () => ({ all: async () => [row('a', '退款'), row('b', '其他')] }) } } as never,
      embeddings as never, vectors as never, indexes as never);
    jest.spyOn(service, 'keyword').mockResolvedValue([{ ...row('a', '退款'), lexicalScore: 4, sources: ['lexical'], ranks: { lexical: 1 } }]);
    return { service, embeddings, vectors, indexes };
  }
  it('keyword mode does not depend on embedding or semantic index readiness', async () => {
    const f = fixture(); await f.service.search('u', ['bad'], '退款', 5, 'keyword');
    expect(f.embeddings.describe).not.toHaveBeenCalled(); expect(f.vectors.search).not.toHaveBeenCalled();
  });
  it('strict laboratory fails, production retains good KB and records failed KB', async () => {
    const f = fixture();
    await expect(f.service.search('u', ['good', 'bad'], '退款', 5, 'hybrid')).rejects.toThrow('not ready');
    const result = await f.service.searchDetailed('u', ['good', 'bad'], '退款', 5, { failurePolicy: 'degrade', minDenseScore: 0.2 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ denseScore: 0.91, lexicalScore: 4 });
    expect(result.meta).toMatchObject({ degraded: true, effectiveMode: 'hybrid', warnings: [{ kbId: 'bad', stage: 'vector' }] });
  });
  it('falls back explicitly to keyword but never masks authorization failures', async () => {
    const result = await fixture().service.searchDetailed('u', ['bad'], '退款', 5, { failurePolicy: 'degrade' });
    expect(result.meta).toMatchObject({ effectiveMode: 'keyword', degraded: true });
    await expect(fixture(new ForbiddenException()).service.searchDetailed('u', ['bad'], '退款', 5, { failurePolicy: 'degrade' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('keeps raw cosine when there is only one nonempty route and gates only when requested', async () => {
    const f = fixture();
    const open = await f.service.search('u', ['good'], '退款', 5, 'vector');
    expect(open.map(r => r.score)).toEqual([0.91, 0.002]);
    const gated = await f.service.searchDetailed('u', ['good'], '退款', 5, { mode: 'vector', minDenseScore: 0.2 });
    expect(gated.data.map(r => r.id)).toEqual(['a']);
    expect(gated.data[0].scoreType).toBe('cosine');
  });
});
