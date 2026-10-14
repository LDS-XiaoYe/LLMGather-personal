import { MemoryIndexService } from './memory-index.service';
import { memoryIndexHash } from './memory-utils';
import { MemoryRow } from './memory.types';

describe('memory index validation and durable worker', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const descriptor = {model:'test',dimensions:2,endpoint:'http://test/v1',revision:'1',fingerprint:'a'.repeat(64)};
  const row = {id:'id',userId:'user',agentId:'agent',content:'MySQL text',namespace:'facts',memoryType:'fact',importance:3,
    metadata:'',createdAt:'2026-10-12',updatedAt:'2026-10-12',indexRevision:'7',indexAttempts:0} as MemoryRow & {indexRevision:string; indexAttempts:number};
  function fixture(rows: object[] = [row]) {
    const run = jest.fn(async () => ({changes:1}));
    const get = jest.fn(async () => row);
    const all = jest.fn(async () => rows);
    const prepare = jest.fn((sql:string) => ({run, get, all}));
    const embeddings = {describe:jest.fn(async () => descriptor),embed:jest.fn(async () => [[1,2]])};
    const vectors = {memoryCollection:jest.fn(() => 'llmgather_memory_test'),ensureMemory:jest.fn(),upsertMemory:jest.fn(),deleteMemory:jest.fn(),
      searchMemories:jest.fn(async () => [{id:'id',score:0.9,revision:'7',contentHash:memoryIndexHash(row)}])};
    const managed = {descriptor:jest.fn(async () => descriptor)};
    const service = new MemoryIndexService({connection:{prepare}} as never,embeddings as never,vectors as never,managed as never);
    return {service,run,get,all,prepare,embeddings,vectors,managed};
  }
  it('hydrates authoritative MySQL content and rejects stale, deleted, foreign and duplicate hits', async () => {
    const f=fixture([row, {...row,id:'foreign',userId:'other'}, {...row,id:'deleted',deletedAt:'now'}, {...row,id:'agent2',agentId:'other-agent'}]);
    const hits=[
      {id:'id',score:0.9,revision:'7',contentHash:memoryIndexHash(row)},
      {id:'id',score:0.8,revision:'7',contentHash:memoryIndexHash(row)},
      ...['foreign','deleted','agent2','missing'].map(id=>({id,score:1,revision:'7',contentHash:memoryIndexHash(row)})),
    ];
    expect(await f.service.resolveHits('user',hits,'agent','fact')).toEqual([expect.objectContaining({id:'id',content:'MySQL text',provider:'native'})]);
    expect(await f.service.resolveHits('user',[{...hits[0],revision:'6'}])).toEqual([]);
    expect(await f.service.resolveHits('user',[{...hits[0],contentHash:'stale'}])).toEqual([]);
    expect(await f.service.resolveHits('user',hits,'agent','skill')).toEqual([]);
    expect(f.prepare.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(f.prepare.mock.calls[0][0]).toContain('user_id = ?');
  });
  it('does no work when disabled', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='false';
    const f=fixture();
    await f.service.drain();
    expect(await f.service.search('user','query',undefined,5)).toEqual([]);
    expect(f.embeddings.describe).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('uses a selected managed BGE instance instead of the remote descriptor', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='true';process.env.MEMORY_EMBEDDING_INSTANCE_ID='instance';
    const f=fixture();
    expect(await f.service.search('user','query','agent',5)).toHaveLength(1);
    expect(f.managed.descriptor).toHaveBeenCalledWith('instance');
    expect(f.embeddings.describe).not.toHaveBeenCalled();
    expect(f.embeddings.embed).toHaveBeenCalledWith(['query'],descriptor);
  });
  it('acknowledges only the leased revision and repairs lost acknowledgments', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='true';delete process.env.MEMORY_EMBEDDING_INSTANCE_ID;
    const f=fixture();
    f.get.mockImplementation(async () => ({...row,backfill_complete:1}));
    f.prepare.mockImplementation((sql:string) => ({
      get:f.get,all:f.all,
      run:jest.fn(async () => ({changes:sql.includes('index_pending=0')?0:1})),
    }));
    await f.service.drain();
    expect(f.vectors.upsertMemory).toHaveBeenCalledWith(descriptor,expect.objectContaining({revision:'7',contentHash:memoryIndexHash(row)}),[1,2]);
    const sql=f.prepare.mock.calls.map(call=>call[0]).join('\n');
    expect(sql).toContain('AND index_revision=?');
    expect(sql).toContain('UPDATE memories SET index_pending=1,index_next_attempt_at=NULL WHERE id=?');
    expect(sql).toContain('index_owner=NULL');
  });
  it('keeps failed items dirty and schedules retry; tombstones delete every recorded space', async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='true';delete process.env.MEMORY_EMBEDDING_INSTANCE_ID;
    const f=fixture();f.get.mockImplementation(async () => ({...row,backfill_complete:1}));
    f.vectors.upsertMemory.mockRejectedValueOnce(new Error('offline') as never);
    await f.service.drain();
    expect(f.prepare.mock.calls.map(c=>c[0]).join('\n')).toContain('index_attempts=index_attempts+1');
    f.get.mockImplementation(async () => ({...row,backfill_complete:1,deletedAt:'now'}));
    f.all.mockImplementation(async () => [{id:'id',collection_name:'space1'},{id:'id',collection_name:'space2'}]);
    await f.service.drain();
    expect(f.vectors.deleteMemory).toHaveBeenCalledWith('space1','user','id');
    expect(f.vectors.deleteMemory).toHaveBeenCalledWith('space2','user','id');
  });
});
