// Real HTTP/Admin/Agent/MySQL/Qdrant/BGE-M3 acceptance against isolated test resources.
require('reflect-metadata');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto');
const {once}=require('node:events');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {AppModule}=require('../dist/app.module');
const {JwtService}=require('../dist/auth/jwt.service');
const {DatabaseService}=require('../dist/database/database.service');
const {ModelServicesService}=require('../dist/model-services/model-services.service');
const {AgentClient}=require('../dist/model-services/agent.client');
const {EmbeddingService}=require('../dist/knowledge/retrieval/embedding.service');
const {start}=require('../../deployment-agent/server.cjs');
async function main(){
  if(!/^p0_test/.test(process.env.MYSQL_DATABASE||''))throw Error('Use a dedicated p0_test database');
  process.env.CHECKPOINT_ENCRYPTION_KEY||='model-integration-key-only-32-or-more-characters';process.env.JWT_SECRET='model-integration-jwt-only';
  process.env.WORKFLOW_AUTO_RECOVER='false';process.env.NATIVE_RAG_BACKEND='qdrant';
  process.env.AGENT_ID=randomUUID();process.env.AGENT_TOKEN=randomBytes(48).toString('hex');process.env.AGENT_PORT='19091';process.env.AGENT_HOST='127.0.0.1';
  const root=path.resolve('.p0-artifacts/bge-m3/integration-agent-state');process.env.AGENT_DATA_DIR=root;
  await fs.mkdir(root,{recursive:true});
  // Reuse canonical, hash-verified weights from the separately accepted hardware run.
  await fs.cp(path.resolve('.p0-artifacts/bge-m3/agent-state/cache'),path.join(root,'cache'),{recursive:true,force:false,errorOnExist:false});
  let {server,agent}=await start();if(!server.listening)await once(server,'listening');
  let app=await NestFactory.create(AppModule,{logger:['error','log']});app.setGlobalPrefix('v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.listen(13390,'127.0.0.1');
  let db=app.get(DatabaseService),services=app.get(ModelServicesService);const jwt=app.get(JwtService),user=randomUUID(),admin=randomUUID();
  const userToken=jwt.sign(user,'integration-user','user'),adminToken=jwt.sign(admin,'integration-admin','admin');
  const endpoint='http://127.0.0.1:13390/v1';
  const evidence=[];function pass(text){evidence.push(text);console.log('PASS '+text);}
  async function request(route,body,token=adminToken,status=200){
    const res=await fetch(endpoint+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await res.json();assert.equal(res.status,status===200&&body!==undefined?201:status,JSON.stringify(value));return value.data;
  }
  async function finished(id){for(let i=0;i<360;i++){const row=await db.connection.prepare('SELECT * FROM model_tasks WHERE id=?').get(id);if(['SUCCEEDED','FAILED','CANCELLED'].includes(row.status)){assert.equal(row.status,'SUCCEEDED',row.error);return row;}await new Promise(r=>setTimeout(r,1000));}throw Error('Task timed out');}
  const instanceId=randomUUID();let stream;
  try{
    await request('/admin/model-services',undefined,'',401);await request('/admin/model-services',undefined,userToken,403);
    const unauth=await fetch('http://127.0.0.1:19091/v1/state');assert.equal(unauth.status,401);pass('HTTP administrator guards and Agent authentication');
    await request('/admin/model-services/nodes',{id:process.env.AGENT_ID,name:'Real CPU acceptance',baseUrl:'http://127.0.0.1:19091',token:process.env.AGENT_TOKEN});
    const config={modelId:'bge-m3',backend:'cpu',source:'auto',cpu:4,memoryMiB:8192};
    await request('/admin/model-services/tasks',{taskId:randomUUID(),instanceId:randomUUID(),nodeId:process.env.AGENT_ID,action:'deploy',config:{...config,image:'evil'}},adminToken,400);
    const taskId=randomUUID(),body={taskId,instanceId,nodeId:process.env.AGENT_ID,action:'deploy',config};
    await request('/admin/model-services/tasks',body);await request('/admin/model-services/tasks',body);
    await finished(taskId);assert.equal(Object.values(agent.store.state.instances).filter(i=>i.id===instanceId).length,1);
    const ready=await services.readyInstance(instanceId);assert.equal(ready.provider_registered,1);pass('durable idempotent deployment, real health probe and automatic Provider registration');
    const raw=await db.connection.prepare('SELECT token_cipher FROM model_nodes WHERE id=?').get(process.env.AGENT_ID);assert(!raw.token_cipher.includes(process.env.AGENT_TOKEN));
    const providers=await request('/knowledge/embedding-providers',undefined,userToken);assert(providers.some(p=>p.id===instanceId));
    await request(`/admin/model-services/instances/${instanceId}/default`,{});
    const kb=await request('/knowledge/bases',{name:'BGE-M3 中文验收',provider:'native'},userToken);
    const binding=await db.connection.prepare('SELECT embedding_instance_id,embedding_spec_json FROM knowledge_bases WHERE id=?').get(kb.id);assert.equal(binding.embedding_instance_id,instanceId);
    const embeddings=app.get(EmbeddingService),descriptor=await embeddings.describe(kb.id),batch=await embeddings.embed(['中文检索','semantic search'],descriptor);assert.equal(batch.length,2);assert.equal(batch[0].length,1024);
    await request(`/knowledge/bases/${kb.id}/documents`,{title:'账户恢复',content:'忘记登录密码时，可在账号设置中通过邮箱验证码重置密码。'},userToken);
    const hits=await request(`/knowledge/bases/${kb.id}/search`,{query:'忘了登录凭据该怎么办',mode:'vector',limit:5},userToken);assert(hits.some(h=>h.title==='账户恢复'));
    pass('new-KB default binding, real 2x1024 batch and Qdrant semantic retrieval');
    const otherKb=await request('/knowledge/bases',{name:'显式旧配置',provider:'native',embeddingInstanceId:''},userToken);
    assert.equal((await db.connection.prepare('SELECT embedding_instance_id FROM knowledge_bases WHERE id=?').get(otherKb.id)).embedding_instance_id,null);
    await request(`/knowledge/bases/${kb.id}/embedding`,{instanceId:''},jwt.sign(randomUUID(),'other','user'),409);
    await request(`/admin/model-services/instances/${instanceId}/dependencies`,undefined,adminToken);
    await request('/admin/model-services/tasks',{taskId:randomUUID(),instanceId,action:'stop'},adminToken,409);
    const stop=randomUUID();await request('/admin/model-services/tasks',{taskId:stop,instanceId,action:'stop',confirm:true});await finished(stop);
    await assert.rejects(embeddings.describe(kb.id),/stopped|offline|unhealthy/);
    const resume=randomUUID();await request('/admin/model-services/tasks',{taskId:resume,instanceId,action:'start'});await finished(resume);
    pass('ownership-enforced KB binding, destructive dependency confirmation and stopped-provider failure');
    // Reconstruct a business worker from the same DB; task/instance registration survives.
    const reconstructed=new ModelServicesService(db,new AgentClient());await reconstructed.tick();assert.equal((await reconstructed.readyInstance(instanceId)).fingerprint,descriptor.fingerprint);
    await assert.rejects(embeddings.embed(['version probe'],{...descriptor,fingerprint:'wrong'}),/space changed/);
    const sse=await fetch(endpoint+'/admin/model-services/events?after=0',{headers:{Authorization:'Bearer '+adminToken},signal:AbortSignal.timeout(10000)});stream=sse.body.getReader();const frame=await stream.read();assert(Buffer.from(frame.value).toString().includes('data:'));await stream.cancel();stream=null;
    assert((await db.connection.prepare('SELECT id FROM model_events WHERE task_id=?').all(taskId)).length>0);assert((await db.connection.prepare('SELECT id FROM model_audit WHERE target_id=?').all(instanceId)).length>0);
    pass('worker reconstruction, fingerprint mismatch rejection, authenticated SSE and SQL audit/events');
    await app.close();
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(13390,'127.0.0.1');
    db=app.get(DatabaseService);services=app.get(ModelServicesService);await services.tick();assert.equal((await services.readyInstance(instanceId)).fingerprint,descriptor.fingerprint);
    pass('complete Nest application shutdown/reinitialization preserves running service and frozen KB fingerprint');
    await new Promise(r=>server.close(r));await agent.close();
    ({server,agent}=await start());if(!server.listening)await once(server,'listening');await agent.reconcile();await services.tick();
    assert.equal((await services.readyInstance(instanceId)).fingerprint,descriptor.fingerprint);
    pass('Agent shutdown/reinitialization adopts owned running container and preserves cache/model identity');
    const remove=randomUUID();await request('/admin/model-services/tasks',{taskId:remove,instanceId,action:'remove',confirm:true});await finished(remove);
    server.close();await agent.close();await services.tick();assert.equal((await services.node(process.env.AGENT_ID)).status,'OFFLINE');
    pass('node disconnection reports OFFLINE, never successful deployment');
    await fs.writeFile(path.join(root,'integration-result.json'),JSON.stringify({results:evidence,dimensions:1024,batch:2},null,2));
  }finally{
    if(stream)await stream.cancel().catch(()=>{});
    for(const i of Object.values(agent.store.state.instances))if(i.actualState!=='REMOVED'){await agent.runtime[i.backend].remove(i).catch(()=>{});i.desiredState='REMOVED';i.actualState='REMOVED';}
    server.close();if(agent.lock)await agent.close().catch(()=>{});await app.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
