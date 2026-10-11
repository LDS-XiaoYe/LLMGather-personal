// Dedicated test DB only. Never run this script against a production database.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawnSync, fork } = require('node:child_process');
const { DatabaseService } = require('../dist/database/database.service');
const { MysqlCheckpointer } = require('../dist/workflows/runtime/mysql-checkpointer');
const { LangGraphWorkflowEngine } = require('../dist/workflows/runtime/workflow-engine');
const { WorkflowRuntimeService } = require('../dist/workflows/runtime/workflow-runtime.service');
const { QdrantService } = require('../dist/knowledge/retrieval/qdrant.service');
const { EmbeddingService } = require('../dist/knowledge/retrieval/embedding.service');
const { KnowledgeIndexService } = require('../dist/knowledge/retrieval/knowledge-index.service');
const { NativeRetrievalService } = require('../dist/knowledge/retrieval/native-retrieval.service');
if (!/^p0_test/.test(process.env.MYSQL_DATABASE || '')) throw Error('MYSQL_DATABASE must start with p0_test');
process.env.CHECKPOINT_ENCRYPTION_KEY ||= 'p0-integration-key-only-at-least-32-characters';
process.env.WORKFLOW_AUTO_RECOVER = 'false';
function n(id, nextIds = [], type = 'template_transform') { return { id, type, config: { nextIds } }; }
async function database() { const db = new DatabaseService(); await db.onModuleInit(); return db; }
async function checkpointPhase(phase, thread) {
  const db = await database();
  try {
    const saver = new MysqlCheckpointer(db);
    const engine = new LangGraphWorkflowEngine();
    const crash = phase.startsWith('crash');
    const definition = crash ? {schemaVersion:1,nodes:[n('a'),n('wait'),n('j',[],'end')]} : { schemaVersion: 2, nodes: [n('a',['j']),n('b',['j']),n('j',[],'end')] };
    const execute = async node => {
      await db.connection.prepare('INSERT INTO p0_calls (thread_id,node_id) VALUES (?,?)').run(thread,node.id);
      if (phase === 'crash-write' && node.id === 'wait') { process.send('ready-to-kill'); await new Promise(()=>{}); }
      if (phase === 'write' && node.id === 'b') { await new Promise(r=>setTimeout(r,50)); throw Error('process restart probe'); }
      return { output:node.id, next:node.config.nextIds };
    };
    if (phase === 'crash-write') await engine.execute(definition,{threadId:thread,input:'test',resume:false,signal:new AbortController().signal,checkpointer:saver,maxSteps:256,execute});
    else if (phase === 'write') await assert.rejects(engine.execute(definition,{threadId:thread,input:'test',resume:false,signal:new AbortController().signal,checkpointer:saver,maxSteps:256,execute}), /process restart probe/);
    else assert.equal(await engine.execute(definition,{threadId:thread,input:'test',resume:true,signal:new AbortController().signal,checkpointer:saver,maxSteps:256,execute}), 'j');
  } finally { await db.onModuleDestroy(); }
}
async function main() {
  const [phase, threadArgument] = process.argv.slice(2);
  if (phase) return checkpointPhase(phase,threadArgument);
  const db = await database();
  try {
    await db.connection.exec('CREATE TABLE IF NOT EXISTS p0_calls (thread_id VARCHAR(128),node_id VARCHAR(64))');
    const thread = randomUUID();
    for (const stage of ['write','resume']) {
      const child = spawnSync(process.execPath,[__filename,stage,thread],{env:process.env,encoding:'utf8'});
      if (child.status !== 0) throw Error(child.stdout + child.stderr);
    }
    const counts = await db.connection.prepare('SELECT node_id,COUNT(*) AS total FROM p0_calls WHERE thread_id=? GROUP BY node_id').all(thread);
    assert.equal(Number(counts.find(r=>r.node_id==='a').total),1);
    assert.equal(Number(counts.find(r=>r.node_id==='b').total),2);
    console.log('PASS checkpoint: independent Node processes resume from MySQL; completed sibling executed once');
    const crashThread=randomUUID();
    await new Promise((resolve,reject)=>{
      const child=fork(__filename,['crash-write',crashThread],{env:process.env,stdio:['ignore','pipe','pipe','ipc']});
      const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('crash checkpoint probe timed out'));},30000);
      let killed=false;
      child.on('message',message=>{if(message==='ready-to-kill'){killed=true;child.kill('SIGKILL');}});
      child.on('exit',()=>{clearTimeout(timer);killed ? resolve() : reject(Error('child exited before checkpoint kill point'));});
    });
    const crashResume=spawnSync(process.execPath,[__filename,'crash-resume',crashThread],{env:process.env,encoding:'utf8'});
    assert.equal(crashResume.status,0,crashResume.stderr);
    const crashCount=await db.connection.prepare("SELECT COUNT(*) AS total FROM p0_calls WHERE thread_id=? AND node_id='a'").get(crashThread);
    assert.equal(Number(crashCount.total),1);
    console.log('PASS checkpoint: SIGKILL at a node boundary, new process resumes without repeating the previous node');
    const saver = new MysqlCheckpointer(db);
    const tuple = await saver.getTuple({configurable:{thread_id:thread}});
    assert(tuple); assert(tuple.parentConfig);
    const history=[]; for await(const cp of saver.list({configurable:{thread_id:thread}},{limit:2})) history.push(cp);
    assert.equal(history.length,2);
    const raw=await db.connection.prepare('SELECT payload FROM workflow_checkpoints WHERE thread_id=? LIMIT 1').get(thread);
    assert(!raw.payload.includes('channel_values'));
    console.log('PASS checkpoint: encrypted records, parent links and history listing');

    const user=randomUUID(); const workflow=randomUUID();
    await db.connection.prepare("INSERT INTO workflows (id,user_id,name,description,definition_json,status,created_at,updated_at) VALUES (?,?,'p0','',?,'active',?,?)")
      .run(workflow,user,'{}',db.now(),db.now());
    let pureFail=true; let sideEffects=0; let release;
    const handler=async (_user,node,input)=>{
      if(node.id==='effect') { sideEffects++; return 'paid-once'; }
      if(node.id==='failure' && pureFail) throw Error('recoverable test failure');
      if(node.id==='failure') await new Promise(r=>setTimeout(r,50));
      if(node.id==='wait') await new Promise(r=>{release=r;});
      return input+'!';
    };
    const runtime=new WorkflowRuntimeService(db,saver); runtime.register(handler);
    const run=await runtime.start(user,workflow,{schemaVersion:1,nodes:[n('effect',[],'tool'),n('failure')]},'input',{});
    let row=await db.connection.prepare('SELECT status FROM workflow_runs WHERE id=?').get(run); assert.equal(row.status,'failed');
    await db.connection.prepare('UPDATE workflows SET definition_json=? WHERE id=?').run(JSON.stringify({nodes:[n('different-definition')]}),workflow);
    pureFail=false;
    const competing=new WorkflowRuntimeService(db,new MysqlCheckpointer(db)); competing.register(handler);
    const outcomes=await Promise.allSettled([runtime.resume(run,user),competing.resume(run,user)]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1); assert.equal(sideEffects,1);
    await runtime.resume(run,user); assert.equal(sideEffects,1);
    row=await db.connection.prepare('SELECT status FROM workflow_runs WHERE id=?').get(run); assert.equal(row.status,'succeeded');
    const steps=await db.connection.prepare("SELECT COUNT(*) AS total FROM workflow_run_steps WHERE run_id=? AND node_id='effect' AND status='succeeded'").get(run);
    assert.equal(Number(steps.total),1);
    console.log('PASS runtime: concurrent resume CAS, duplicate resume, side-effect ledger and trace consistency');
    await assert.rejects(saver.put({configurable:{...tuple.config.configurable,execution_owner:'expired-worker',execution_run_id:run}},tuple.checkpoint,tuple.metadata,{}),/lease lost/);
    pureFail=true;
    const scanRun=await runtime.start(user,workflow,{schemaVersion:1,nodes:[n('failure')]},'scanner-probe',{});
    await db.connection.prepare("UPDATE workflow_runs SET status='running',lease_owner='dead-worker',lease_until=DATE_SUB(NOW(3),INTERVAL 10 SECOND) WHERE id=?").run(scanRun);
    pureFail=false; process.env.WORKFLOW_AUTO_RECOVER='true'; await runtime.recover();
    for(let i=0;i<100;i++){
      row=await db.connection.prepare('SELECT status FROM workflow_runs WHERE id=?').get(scanRun);
      if(row.status==='succeeded') break; await new Promise(r=>setTimeout(r,20));
    }
    process.env.WORKFLOW_AUTO_RECOVER='false'; assert.equal(row.status,'succeeded');
    console.log('PASS runtime: expired-worker fencing and automatic stale-running scan');
    const dangerous=new WorkflowRuntimeService(db,saver);
    dangerous.register(async()=>{throw Error('external effect outcome unknown');});
    const ambiguous=await dangerous.start(user,workflow,{schemaVersion:1,nodes:[n('effect',[],'tool')]},'input',{});
    await dangerous.resume(ambiguous,user);
    row=await db.connection.prepare('SELECT status,error FROM workflow_runs WHERE id=?').get(ambiguous);
    assert.equal(row.status,'interrupted'); assert(row.error.includes('Ambiguous side effect'));
    console.log('PASS runtime: ambiguous external effect is blocked rather than replayed');
    const cancelPromise=runtime.start(user,workflow,{schemaVersion:1,nodes:[n('wait',[],'tool')]},'cancel-probe',{});
    while(!release) await new Promise(r=>setTimeout(r,10));
    const cancelRow=await db.connection.prepare("SELECT id FROM workflow_runs WHERE workflow_id=? AND input='cancel-probe' ORDER BY created_at DESC LIMIT 1").get(workflow);
    await runtime.cancel(cancelRow.id,user); release(); await cancelPromise;
    assert.equal((await db.connection.prepare('SELECT status FROM workflow_runs WHERE id=?').get(cancelRow.id)).status,'cancelled');
    console.log('PASS runtime: durable cancellation prevents successful completion');
    const hanging=new WorkflowRuntimeService(db,saver);
    hanging.register(async()=>new Promise(()=>{}));
    const started=Date.now();
    const timed=await hanging.start(user,workflow,{schemaVersion:1,nodes:[{...n('hang'),config:{timeoutMs:100}}]},'timeout-probe',{});
    assert(Date.now()-started<3000);
    assert.equal((await db.connection.prepare('SELECT status FROM workflow_runs WHERE id=?').get(timed)).status,'failed');
    await db.connection.prepare("UPDATE workflow_runs SET status='running',lease_owner='dead-worker',lease_until=DATE_SUB(NOW(3),INTERVAL 10 SECOND) WHERE id=?").run(timed);
    await hanging.cancel(timed,user);
    const cancelled=await db.connection.prepare('SELECT status,completed_at FROM workflow_runs WHERE id=?').get(timed);
    assert.equal(cancelled.status,'cancelled'); assert(cancelled.completed_at);
    console.log('PASS runtime: fixed definition snapshot, non-cooperative node timeout and cancellation of an expired worker');

    const qdrant=new QdrantService(); await qdrant.health();
    const descriptor={fingerprint:randomUUID().replaceAll('-','').padEnd(64,'0'),dimensions:3,model:'synthetic-fixture',endpoint:'test-only',revision:'1'};
    const collection=await qdrant.ensure(descriptor);
    const kb=randomUUID(); const doc=randomUUID(); const point=randomUUID();
    await qdrant.upsert(descriptor,[{id:point,kbId:kb,documentId:doc,userId:user}],[ [1,0,0] ]);
    assert.equal((await qdrant.search(descriptor,[1,0,0],user,[kb],5))[0].id,point);
    assert.equal((await qdrant.search(descriptor,[1,0,0],randomUUID(),[kb],5)).length,0);
    assert.equal((await qdrant.search(descriptor,[1,0,0],user,[randomUUID()],5)).length,0);
    await assert.rejects(qdrant.ensure({...descriptor,dimensions:4}),/mismatch/);
    await qdrant.deleteDocument(collection,user,doc);
    assert.equal(await qdrant.count(descriptor,user,kb),0);
    console.log('PASS Qdrant: real upsert/search, user/KB isolation, dimension mismatch and deletion (synthetic test vectors)');

    if(process.env.EMBEDDING_BASE_URL && process.env.EMBEDDING_MODEL && process.env.EMBEDDING_DIMENSIONS) {
      const embeddings=new EmbeddingService({}); const semantic=await embeddings.describe();
      const generated=await embeddings.embed(['reset password','forgot my login credentials']);
      assert.equal(generated.length,2); assert.equal(generated[0].length,semantic.dimensions);
      const semanticKb=randomUUID(); const semanticDoc=randomUUID();
      await db.connection.prepare("INSERT INTO knowledge_bases (id,user_id,name,description,provider,created_at,updated_at) VALUES (?,?,'p0 semantic','','native',?,?)")
        .run(semanticKb,user,db.now(),db.now());
      await db.connection.prepare("INSERT INTO knowledge_documents (id,kb_id,user_id,title,content,created_at,updated_at) VALUES (?,?,?,'manual','reset your password',?,?)")
        .run(semanticDoc,semanticKb,user,db.now(),db.now());
      const first=randomUUID();
      await db.connection.prepare('INSERT INTO knowledge_chunks (id,kb_id,document_id,user_id,chunk_index,content,embedding_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(first,semanticKb,semanticDoc,user,0,'reset your password using the account settings','[0.1,0.2]', '2020-01-01 00:00:00.000');
      for(let i=0;i<301;i++) await db.connection.prepare('INSERT INTO knowledge_chunks (id,kb_id,document_id,user_id,chunk_index,content,embedding_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(randomUUID(),semanticKb,semanticDoc,user,i+1,'The weather forecast describes sunshine and rainfall.','[0.1,0.2]',db.now());
      const indexes=new KnowledgeIndexService(db,embeddings,qdrant);
      const unavailable=Object.create(qdrant);
      unavailable.ensure=async()=>{throw Error('injected unavailable Qdrant');};
      await assert.rejects(new KnowledgeIndexService(db,embeddings,unavailable).migrate(user,semanticKb),/injected unavailable/);
      assert.equal((await db.connection.prepare('SELECT status FROM knowledge_indexes WHERE kb_id=? AND fingerprint=?').get(semanticKb,semantic.fingerprint)).status,'failed');
      let batch=0;
      const flaky=Object.create(qdrant);
      flaky.upsert=async(...args)=>{if(++batch===2)throw Error('injected batch failure');return qdrant.upsert(...args);};
      await assert.rejects(new KnowledgeIndexService(db,embeddings,flaky).migrate(user,semanticKb),/injected batch failure/);
      const failedIndex=await db.connection.prepare('SELECT status,cursor_id FROM knowledge_indexes WHERE kb_id=? AND fingerprint=?').get(semanticKb,semantic.fingerprint);
      assert.equal(failedIndex.status,'failed'); assert(failedIndex.cursor_id);
      const migration=await indexes.migrate(user,semanticKb); assert.equal(migration.indexedCount,302);
      assert.equal((await indexes.migrate(user,semanticKb)).indexedCount,302);
      const retrieval=new NativeRetrievalService(db,embeddings,qdrant,indexes);
      assert((await retrieval.search(user,[semanticKb],'forgot my login credentials',5,'vector')).some(r=>r.id===first));
      assert((await retrieval.search(user,[semanticKb],'password',5,'hybrid')).some(r=>r.id===first));
      assert((await retrieval.search(user,[semanticKb],'password',5,'keyword')).some(r=>r.id===first));
      const old=await db.connection.prepare('SELECT embedding_json FROM knowledge_chunks WHERE id=?').get(first); assert.equal(old.embedding_json,'[0.1,0.2]');
      const oldModel=process.env.EMBEDDING_MODEL; process.env.EMBEDDING_MODEL='changed-model';
      await assert.rejects(retrieval.search(user,[semanticKb],'password',5,'vector'),/reindex/); process.env.EMBEDDING_MODEL=oldModel;
      console.log('PASS real embedding + failed-batch resume + migration: 302 chunks, old data retained, idempotent rerun, older-than-300 semantic hit, hybrid/keyword and model mismatch');
    } else console.log('SKIP real embedding/migration E2E: configure EMBEDDING_BASE_URL, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS');
  } finally { await db.onModuleDestroy(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
