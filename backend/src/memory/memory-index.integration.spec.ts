import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { MysqlDatabaseAdapter } from '../database/adapters/mysql.adapter';
import { dbNow, DatabaseService } from '../database/database.service';
import { migrateMemoryIndex } from '../database/migrations/memory-index';
import { EmbeddingService } from '../knowledge/retrieval/embedding.service';
import { QdrantService } from '../knowledge/retrieval/qdrant.service';
import { MemoryIndexService } from './memory-index.service';
import { MemoryService } from './memory.service';
import { NativeMemoryProvider } from './providers/native-memory.provider';

// Opt-in; use an isolated database and Qdrant instance, never the application .env.
const integration = process.env.MEMORY_TEST_INTEGRATION === 'true' ? describe : describe.skip;
integration('memory: real MySQL + Qdrant + embedding integration', () => {
  jest.setTimeout(120000);
  const originalEnv = {...process.env};
  let adapter: MysqlDatabaseAdapter, database: DatabaseService;
  let embeddings: EmbeddingService, vectors: QdrantService, native: NativeMemoryProvider;
  let index: MemoryIndexService, memory: MemoryService, client: QdrantClient;
  const user=randomUUID(), agent=randomUUID(), otherUser=randomUUID(), otherAgent=randomUUID();
  beforeAll(async () => {
    if (!/^memory_test_/.test(process.env.MYSQL_DATABASE || '')) throw new Error('Use a dedicated memory_test_ database');
    adapter=new MysqlDatabaseAdapter({host:process.env.MYSQL_HOST || '127.0.0.1',port:Number(process.env.MYSQL_PORT),
      user:process.env.MYSQL_USER || 'root',password:process.env.MYSQL_PASSWORD || '',database:process.env.MYSQL_DATABASE!});
    await adapter.init();
    await adapter.exec(`CREATE TABLE IF NOT EXISTS memories (
      id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,agent_id VARCHAR(36),namespace VARCHAR(64) NOT NULL,
      memory_type VARCHAR(32) NOT NULL,content TEXT NOT NULL,importance INT NOT NULL,metadata TEXT,provider VARCHAR(32),
      external_id VARCHAR(191) NOT NULL DEFAULT '',provider_payload LONGTEXT,created_at DATETIME(3),updated_at DATETIME(3),deleted_at DATETIME(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await migrateMemoryIndex(adapter);await migrateMemoryIndex(adapter);
    database={connection:adapter,now:()=>dbNow()} as unknown as DatabaseService;
    embeddings=new EmbeddingService({} as never);
    vectors=new QdrantService();native=new NativeMemoryProvider(database);
    client=new QdrantClient({url:process.env.QDRANT_URL!,apiKey:process.env.QDRANT_API_KEY,checkCompatibility:false});
    expect(await embeddings.health()).toEqual({status:'ok',dimensions:Number(process.env.EMBEDDING_DIMENSIONS)});
  });
  beforeEach(async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='true';process.env.EMBEDDING_REVISION=randomUUID();
    delete process.env.MEMORY_EMBEDDING_INSTANCE_ID;delete process.env.EMBEDDING_PROVIDER_NAME;
    await adapter.exec('DELETE FROM memories');await adapter.exec('DELETE FROM memory_index_spaces');
    index=new MemoryIndexService(database,embeddings,vectors,{} as never);memory=new MemoryService(native,index);
  });
  afterEach(async () => {await index?.onModuleDestroy();});
  afterAll(async () => {await adapter?.close();process.env={...originalEnv};});
  async function drainAll(worker=index) {
    for(let i=0;i<25;i++) {
      await worker.drain();
      const descriptor=await embeddings.describe();
      const jobs=await adapter.prepare('SELECT COUNT(*) AS count FROM memories WHERE index_pending=1 OR (deleted_at IS NULL AND index_fingerprint<>?)').get(descriptor.fingerprint);
      const spaces=await adapter.prepare('SELECT COUNT(*) AS count FROM memory_index_spaces WHERE backfill_complete=0').get();
      if (!Number(jobs?.count) && !Number(spaces?.count)) return;
    }
    throw new Error('Memory index did not drain');
  }
  it('keeps legacy mirrored UUIDs and metadata, and works without the independent server or embedding',async () => {
    process.env.MEMORY_PROVIDER='langgraph';process.env.MEMORY_SEMANTIC_INDEX_ENABLED='false';
    const spy=jest.spyOn(embeddings,'embed');
    const old=await native.createMirror(user,{content:'legacy memory',memoryType:'preference'},'langgraph','remote-key','old-payload');
    const loaded=(await memory.list(user))[0];
    expect(loaded).toMatchObject({id:old.id,provider:'native',externalId:'remote-key',providerPayload:'old-payload'});
    expect(memory.getProviderName()).toBe('native');
    await memory.create(user,{content:'no embedding required'});
    expect((await memory.search(user,'legacy'))[0].id).toBe(old.id);
    await index.drain();expect(spy).not.toHaveBeenCalled();spy.mockRestore();
  });
  it('finds matching memories older than the first 100 list records and filters type before Top-K',async () => {
    process.env.MEMORY_SEMANTIC_INDEX_ENABLED='false';
    const old=await memory.create(user,{content:'ancientneedle',importance:1,memoryType:'skill',agentId:agent});
    await adapter.prepare("UPDATE memories SET updated_at='2020-01-01',created_at='2020-01-01' WHERE id=?").run(old.id);
    for(let i=0;i<105;i++) await memory.create(user,{content:'unrelated high importance item '+i,importance:5,memoryType:'fact',agentId:agent});
    expect((await memory.list(user,agent)).some(m=>m.id===old.id)).toBe(false);
    expect((await memory.search(user,'ancientneedle',agent,1,'skill'))[0].id).toBe(old.id);
    expect((await native.search(user,'ancientneedle',agent,1))[0].id).toBe(old.id);
  });
  it('runs actual semantic retrieval and enforces tenant, agent/global and type boundaries',async () => {
    const target=await memory.create(user,{content:'I prefer replies with short sentences and no filler.',memoryType:'preference',agentId:agent});
    const global=await memory.create(user,{content:'Keep answers concise and brief.',memoryType:'preference'});
    const foreign=await memory.create(otherUser,{content:target.content,memoryType:'preference',agentId:agent});
    const foreignAgent=await memory.create(user,{content:target.content,memoryType:'preference',agentId:otherAgent});
    const fact=await memory.create(user,{content:'I work in a software company.',memoryType:'fact',agentId:agent});
    await drainAll();
    const results=await index.search(user,'concise responses',agent,5,'preference');
    expect(new Set(results.map(r=>r.id))).toEqual(new Set([target.id,global.id]));
    expect(results.some(r=>[foreign.id,foreignAgent.id,fact.id].includes(r.id))).toBe(false);
    expect(await memory.search(user,'concise responses',agent,5,'preference')).toHaveLength(2);
    const descriptor=await embeddings.describe();
    const raw=await client.retrieve(vectors.memoryCollection(descriptor),{ids:[target.id],with_payload:true});
    expect(raw[0].payload).not.toHaveProperty('content');
    expect(raw[0].payload).toHaveProperty('revision','1');
  });
  it('rejects old update/delete vectors immediately and physically deletes all recorded model spaces',async () => {
    const item=await memory.create(user,{content:'Prefer concise answers.',agentId:agent});await drainAll();
    const firstRevision=process.env.EMBEDDING_REVISION!;
    const first=await embeddings.describe();
    await memory.update(user,item.id,{content:'Prefer detailed explanations.'});
    expect(await index.search(user,'concise answers',agent,5)).toHaveLength(0);
    await drainAll();
    expect((await index.search(user,'detailed explanations',agent,5))[0].content).toBe('Prefer detailed explanations.');
    process.env.EMBEDDING_REVISION=randomUUID();await drainAll();
    const second=await embeddings.describe();expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(await client.retrieve(vectors.memoryCollection(second),{ids:[item.id]})).toHaveLength(1);
    await memory.update(user,item.id,{content:'Prefer examples with explanations.'});await drainAll();
    process.env.EMBEDDING_REVISION=firstRevision;await drainAll();
    expect((await index.search(user,'examples',agent,5))[0].content).toBe('Prefer examples with explanations.');
    expect(await memory.removeAll(user,agent)).toBe(1);
    expect(await client.retrieve(vectors.memoryCollection(first),{ids:[item.id]})).toHaveLength(1);
    expect(await index.search(user,'explanations',agent,5)).toHaveLength(0);
    expect(await memory.search(user,'explanations',agent,5)).toHaveLength(0);
    await drainAll();
    for(const descriptor of [first,second]) expect(await client.retrieve(vectors.memoryCollection(descriptor),{ids:[item.id]})).toHaveLength(0);
  });
  it('persists failed jobs and a new Node process recovers expired leases',async () => {
    const item=await memory.create(user,{content:'durable restart memory'});
    const spy=jest.spyOn(vectors,'upsertMemory').mockRejectedValueOnce(new Error('temporary outage'));
    await index.drain();spy.mockRestore();
    const failed=await adapter.prepare('SELECT index_pending,index_attempts,index_next_attempt_at FROM memories WHERE id=?').get(item.id);
    expect(Number(failed?.index_pending)).toBe(1);expect(Number(failed?.index_attempts)).toBeGreaterThan(0);expect(failed?.index_next_attempt_at).toBeTruthy();
    await adapter.prepare("UPDATE memories SET index_owner='dead-process',index_lease_until=DATE_SUB(NOW(3),INTERVAL 10 SECOND),index_next_attempt_at=NULL WHERE id=?").run(item.id);
    const code=`require('ts-node/register');require('reflect-metadata');
      const {MysqlDatabaseAdapter}=require('./backend/src/database/adapters/mysql.adapter.ts');
      const {EmbeddingService}=require('./backend/src/knowledge/retrieval/embedding.service.ts');
      const {QdrantService}=require('./backend/src/knowledge/retrieval/qdrant.service.ts');
      const {MemoryIndexService}=require('./backend/src/memory/memory-index.service.ts');
      (async()=>{const db=new MysqlDatabaseAdapter({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT),user:'root',password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE});
      await db.init();try{const index=new MemoryIndexService({connection:db},new EmbeddingService({}),new QdrantService(),{});await index.drain();console.log('PASS independent process: persisted memory job recovered');}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;
    const result=spawnSync(process.execPath,['-e',code],{cwd:resolve(__dirname,'../../..'),env:{...process.env,TS_NODE_PROJECT:'backend/tsconfig.json'},encoding:'utf8',timeout:60000});
    expect(result.status).toBe(0);expect(result.stdout).toContain('PASS independent process');
    const recovered=await adapter.prepare('SELECT index_pending,index_owner FROM memories WHERE id=?').get(item.id);
    expect(Number(recovered?.index_pending)).toBe(0);expect(recovered?.index_owner).toBeNull();
    expect((await index.search(user,'restart memory',undefined,5))[0].id).toBe(item.id);
  });
  it('repairs a late write by a lease-lost worker after a newer worker already acknowledged',async () => {
    const item=await memory.create(user,{content:'old content'});
    const original=vectors.upsertMemory.bind(vectors);
    const secondVectors=new QdrantService();
    const secondWorker=new MemoryIndexService(database,embeddings,secondVectors,{} as never);
    const spy=jest.spyOn(vectors,'upsertMemory').mockImplementationOnce(async (...args) => {
      await memory.update(user,item.id,{content:'new content'});
      await adapter.prepare('UPDATE memories SET index_owner=NULL,index_lease_until=NULL WHERE id=?').run(item.id);
      await secondWorker.drain();
      await original(...args);
    });
    await index.drain();spy.mockRestore();
    const dirty=await adapter.prepare('SELECT index_pending FROM memories WHERE id=?').get(item.id);
    expect(Number(dirty?.index_pending)).toBe(1);
    expect(await index.search(user,'content',undefined,5)).toHaveLength(0);
    await drainAll();
    expect((await index.search(user,'content',undefined,5))[0].content).toBe('new content');
    await secondWorker.onModuleDestroy();
  });
  it('recreates a lost collection and rebuilds its derived index from MySQL',async () => {
    const item=await memory.create(user,{content:'rebuild after index loss'});await drainAll();
    const descriptor=await embeddings.describe(),collection=vectors.memoryCollection(descriptor);
    await client.deleteCollection(collection);
    expect(await memory.rebuildIndex(user)).toEqual({enabled:true,queued:1});
    await index.drain(); // first failure clears the cached collection readiness and retains the job
    await adapter.prepare('UPDATE memories SET index_next_attempt_at=NULL WHERE id=?').run(item.id);
    await drainAll();
    expect((await index.search(user,'index loss',undefined,5))[0].id).toBe(item.id);
  });
});
