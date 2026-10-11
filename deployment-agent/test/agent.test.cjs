const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {RequestVerifier,sign,inside}=require('../security.cjs');
const {validateDeployment}=require('../validation.cjs');
const {AgentStore}=require('../store.cjs');
const {DockerCpuRuntimeAdapter,NvidiaCudaRuntimeAdapter,AppleMetalRuntimeAdapter}=require('../runtime.cjs');
const {ModelDownloadService,HuggingFaceDownloadProvider,ModelScopeDownloadProvider}=require('../download.cjs');
const {DeploymentAgent}=require('../server.cjs');
const registry=require('../registry.json');
const config={modelId:'bge-m3',backend:'cpu',source:'auto',cpu:2,memoryMiB:6144};
test('Agent HMAC authenticates method, route, body, expiry and replay',()=>{
  const key='unit-test-only-credential-at-least-32-characters',v=new RequestVerifier(key),stamp=String(Date.now()),nonce=crypto.randomBytes(16).toString('hex');
  const h={'x-agent-time':stamp,'x-agent-nonce':nonce,'x-agent-signature':sign(key,'POST','/v1/tasks',stamp,nonce,'{}')};
  assert.throws(()=>v.verify('POST','/v1/tasks',h,'{"image":"evil"}'));
  v.verify('POST','/v1/tasks',h,'{}');assert.throws(()=>v.verify('POST','/v1/tasks',h,'{}'));
  assert.throws(()=>new RequestVerifier('short'));
});
test('configuration allowlist rejects commands, mounts, image injection and bad resources',()=>{
  assert.deepEqual(validateDeployment(config),config);
  for(const field of ['command','image','mount','privileged','port'])assert.throws(()=>validateDeployment({...config,[field]:'evil'}));
  assert.throws(()=>validateDeployment({...config,memoryMiB:1}));
  assert.throws(()=>validateDeployment({...config,backend:'apple',source:'modelscope'}));
});
test('managed path rejects traversal and symlinks',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'llmgather-path-'));
  assert.throws(()=>inside(root,'../escaped'));assert.throws(()=>inside(root,root));
  await fs.symlink(os.tmpdir(),path.join(root,'linked'),'junction');assert.throws(()=>inside(root,'linked','anything'));
  await fs.unlink(path.join(root,'linked'));await fs.rmdir(root);
});
test('Agent atomic state survives process reconstruction',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'llmgather-state-')),a=await new AgentStore(root).load();
  a.state.tasks.one={phase:'DOWNLOADING_MODEL',downloadedBytes:4};await Promise.all([a.save(),a.save()]);
  const b=await new AgentStore(root).load();assert.equal(b.state.tasks.one.downloadedBytes,4);
  await fs.unlink(b.file);await fs.rmdir(root);
});
test('CPU/RTX30/40/50 adapters select distinct immutable images and reject silent fallbacks',async()=>{
  const hw={docker:{os:'linux',arch:'amd64',nvidiaRuntime:true,memoryMiB:16384},gpus:[]};
  assert.match((await new DockerCpuRuntimeAdapter('.','.').checkCompatibility(config,hw)).image,/:cpu-1.8@sha256:/);
  await assert.rejects(new DockerCpuRuntimeAdapter('.','.').checkCompatibility(config,{docker:{os:'linux',arch:'arm64'}}),/amd64/);
  const a=new NvidiaCudaRuntimeAdapter('.','.'),uuid='GPU-'+crypto.randomUUID();
  await assert.rejects(a.checkCompatibility({...config,gpuUuid:uuid},hw),/selection/);
  for(const [cap,tag]of [['8.6','86'],['8.9','89'],['12.0','120']]){
    hw.gpus=[{uuid,capability:cap,freeMiB:8000,driver:'610.88',name:'test-device'}];
    if(cap==='12.0')await assert.rejects(a.checkCompatibility({...config,gpuUuid:uuid},hw),/acknowledgement/);
    assert.match((await a.checkCompatibility({...config,gpuUuid:uuid,allowExperimental:true},hw)).image,new RegExp(':'+tag+'-1.9@sha256:'));
  }
  hw.docker.nvidiaRuntime=false;await assert.rejects(a.checkCompatibility({...config,gpuUuid:uuid},hw),/Toolkit/);
});
test('Docker arguments enforce loopback, resources, managed labels and read-only verified cache',()=>{
  const root=path.resolve('cache'),a=new DockerCpuRuntimeAdapter('.',root),i={...config,id:crypto.randomUUID(),port:21000,image:registry.matrix[0].image,precision:'float32'};
  const args=a.arguments(i,{path:path.join(root,'a'.repeat(64))});
  assert(args.includes('127.0.0.1:21000:80'));assert(args.includes('--read-only'));assert(args.includes('--cap-drop'));
  assert(!args.includes('--privileged'));assert.throws(()=>a.arguments(i,{path:path.resolve('../unrelated')}));
});
test('unrelated container ownership is rejected',async()=>{
  const a=new DockerCpuRuntimeAdapter('.','.',async()=>JSON.stringify({Config:{Labels:{}}}));
  await assert.rejects(a.stop({id:crypto.randomUUID()}),/ownership/);
});
test('Apple requires a macOS Apple node, not Docker GPU capability',async()=>{
  const a=new AppleMetalRuntimeAdapter('.','.');
  await assert.rejects(a.checkCompatibility(config,{platform:'linux',arch:'arm64'}),/Apple Silicon/);
  const runtime=await a.checkCompatibility(config,{platform:'darwin',arch:'arm64',memoryMiB:16384,apple:{chip:'Apple M4',version:'15.4'}});
  assert.equal(runtime.precision,'float16');assert.equal(runtime.variant,'mlx');
});
test('download provider URLs use immutable, source-specific revisions',()=>{
  const v=registry.models[0].variants.tei,f=v.files.find(f=>f.sha256);
  assert(new HuggingFaceDownloadProvider().url(v,f).includes(v.revision));
  assert(new ModelScopeDownloadProvider().url(v,f).includes(f.modelscopeRevision));
  assert.throws(()=>new ModelScopeDownloadProvider().url(registry.models[0].variants.mlx,{}));
});
test('download fallback verifies canonical bytes, resumes and atomically publishes; cache reuse needs no network',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'llmgather-download-')),content=Buffer.from('verified-model-content');
  const variant={repository:'fixture/model',revision:'a'.repeat(40),sources:['modelscope','huggingface'],files:[{path:'model.bin',size:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex'),modelscopeRevision:'b'.repeat(40)}]};
  registry.models.push({id:'fixture',variants:{tei:variant}});
  let calls=0,resumed=false;const d=new ModelDownloadService(root,null,async(url,headers)=>{
    calls++;if(url.includes('modelscope'))throw Error('network fixture');
    const offset=Number(headers.Range?.match(/bytes=(\d+)/)?.[1]||0);resumed=offset===4;
    return new Response(content.subarray(offset),{status:offset?206:200,headers:offset?{'content-range':`bytes ${offset}-${content.length-1}/${content.length}`}:{}});
  });
  const key=d.key(variant);await fs.mkdir(path.join(root,key+'.partial'));await fs.writeFile(path.join(root,key+'.partial','model.bin'),content.subarray(0,4));
  const events=[];const cache=await d.prepare('fixture','tei','auto',async p=>events.push(p),new AbortController().signal);
  assert(resumed);assert.equal(cache.source,'huggingface');assert(events.some(e=>e.phase==='VERIFYING_MODEL'));
  const old=calls;await d.prepare('fixture','tei','auto',async()=>{},new AbortController().signal);assert.equal(calls,old);
  await fs.writeFile(path.join(cache.path,'model.bin'),'corrupt');await assert.rejects(d.prepare('fixture','tei','auto',async()=>{},new AbortController().signal),/integrity/);
  registry.models.pop();await fs.rm(root,{recursive:true});
});
test('task idempotency persists and rejects a changed payload',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'llmgather-task-')),a=new DeploymentAgent(root);await a.store.load();a.drain=async()=>{};
  const request={taskId:crypto.randomUUID(),instanceId:crypto.randomUUID(),action:'deploy',config};
  await a.submit(request);await a.submit(request);assert.equal(Object.keys(a.store.state.tasks).length,1);
  await assert.rejects(a.submit({...request,config:{...config,cpu:4}}),/idempotency/);
  await a.cancel(request.taskId);assert.equal(a.store.state.tasks[request.taskId].status,'CANCELLED');
  await fs.rm(root,{recursive:true});
});
