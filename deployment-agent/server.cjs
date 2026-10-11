const http=require('node:http');
const https=require('node:https');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {AgentStore}=require('./store.cjs');
const {RequestVerifier,id,inside,safeError}=require('./security.cjs');
const {ModelDownloadService}=require('./download.cjs');
const {adapters,detect,sleep}=require('./runtime.cjs');
const registry=require('./registry.json');
const {validateDeployment}=require('./validation.cjs');
class DeploymentAgent {
  constructor(root){this.root=path.resolve(root);this.cacheRoot=path.join(this.root,'cache');this.store=new AgentStore(this.root);this.runtime=adapters(this.root,this.cacheRoot);this.downloads=new ModelDownloadService(this.cacheRoot,this.store);this.controllers=new Map();this.working=false;}
  async initialize(){
    await fs.mkdir(this.root,{recursive:true,mode:0o700});this.lockFile=path.join(this.root,'agent.lock');
    try{const previous=JSON.parse(await fs.readFile(this.lockFile,'utf8'));let alive=true;try{process.kill(previous.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
      if(alive)throw Error('Agent data directory is already owned by a live process');await fs.unlink(this.lockFile);
    }catch(e){if(e.code!=='ENOENT')throw e;}
    this.lock=await fs.open(this.lockFile,'wx',0o600);await this.lock.writeFile(JSON.stringify({pid:process.pid}));
    await this.store.load();await fs.mkdir(this.cacheRoot,{recursive:true});for(const task of Object.values(this.store.state.tasks))if(task.status==='RUNNING')task.status='PENDING';await this.store.save();this.timer=setInterval(()=>void this.reconcile().catch(()=>{}),30000);this.timer.unref();void this.drain();return this;
  }
  async progress(task,update){const now=new Date().toISOString();if(update.phase&&update.phase!==task.phase)(task.history||=[]).push({phase:update.phase,status:update.status||task.status,at:now});Object.assign(task,update,{updatedAt:now});if(update.totalBytes)this.store.state.downloads[task.taskId]={instanceId:task.instanceId,phase:task.phase,downloadedBytes:task.downloadedBytes,totalBytes:task.totalBytes,source:task.source,file:task.file,updatedAt:task.updatedAt};await this.store.save();}
  async submit(body){
    if(!body||Object.keys(body).some(k=>!['taskId','instanceId','action','config'].includes(k)))throw Error('Invalid managed task field');
    id(body.taskId);id(body.instanceId);
    if(!['deploy','start','stop','restart','remove','delete-cache'].includes(body.action))throw Error('Invalid managed action');
    const hash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const previous=this.store.state.tasks[body.taskId];if(previous){if(previous.requestHash!==hash)throw Error('Task idempotency payload mismatch');return previous;}
    if(Object.values(this.store.state.tasks).some(t=>t.instanceId===body.instanceId&&['PENDING','RUNNING'].includes(t.status)))throw Error('Managed instance operation is already pending');
    if(body.action==='deploy')validateDeployment(body.config);else if(!this.store.state.instances[body.instanceId])throw Error('Managed instance not found');
    const task={...body,requestHash:hash,status:'PENDING',phase:'CHECKING_ENVIRONMENT',createdAt:new Date().toISOString(),history:[{phase:'CHECKING_ENVIRONMENT',status:'PENDING',at:new Date().toISOString()}]};
    this.store.state.tasks[body.taskId]=task;await this.store.save();void this.drain();return task;
  }
  async drain(){
    if(this.working)return;this.working=true;
    try{for(const task of Object.values(this.store.state.tasks).filter(t=>t.status==='PENDING'))await this.execute(task);}finally{this.working=false;}
    if(Object.values(this.store.state.tasks).some(t=>t.status==='PENDING'))void this.drain();
  }
  async execute(task){
    const controller=new AbortController();this.controllers.set(task.taskId,controller);const signal=controller.signal;
    await this.progress(task,{status:'RUNNING'});let instance=this.store.state.instances[task.instanceId];
    try{
      if(task.cancelRequested)controller.abort();signal.throwIfAborted();
      if(task.action==='deploy'){
        const config=validateDeployment(task.config);const hardware=await detect(this.root,process.env.AGENT_PYTHON);
        const compatibility=await this.runtime[config.backend].checkCompatibility(config,hardware);signal.throwIfAborted();
        if(!instance){const occupied=new Set(Object.values(this.store.state.instances).filter(i=>i.actualState!=='REMOVED').map(i=>i.port));let port=21000;while(occupied.has(port)&&port<21100)port++;if(port>=21100)throw Error('Managed service port range exhausted');
          instance={...config,id:task.instanceId,port,image:compatibility.image,precision:compatibility.precision,gpuName:compatibility.gpuName,variant:config.backend==='apple'?'mlx':'tei',desiredState:'RUNNING',actualState:'PREPARING'};
          this.store.state.instances[instance.id]=instance;await this.store.save();
        }else if(JSON.stringify(task.config)!==JSON.stringify(instance.originalConfig||task.config)&&instance.originalConfig)throw Error('Managed deployment configuration is immutable');
        if(instance.actualState==='REMOVED'){
          const occupied=new Set(Object.values(this.store.state.instances).filter(i=>i.id!==instance.id&&i.actualState!=='REMOVED').map(i=>i.port));
          let port=21000;while(occupied.has(port)&&port<21100)port++;if(port>=21100)throw Error('Managed service port range exhausted');instance.port=port;
        }
        instance.originalConfig=task.config;
        instance.desiredState='RUNNING';instance.actualState='PREPARING';await this.store.save();
        const adapter=this.runtime[instance.backend];
        await this.progress(task,{phase:instance.backend==='apple'?'PREPARING_RUNTIME':'PULLING_IMAGE'});
        await adapter.prepare(instance);signal.throwIfAborted();
        const cache=await this.downloads.prepare(instance.modelId,instance.variant,instance.source,update=>this.progress(task,update),signal);
        Object.assign(instance,{cacheKey:cache.key,cachePath:cache.path,source:cache.source,revision:cache.variant.revision});
        const spec={modelId:instance.modelId,repository:cache.variant.repository,revision:instance.revision,dimensions:registry.models.find(m=>m.id===instance.modelId).dimensions,precision:instance.precision,pooling:cache.variant.pooling,runtime:instance.image||'mlx-embeddings@0.1.0+mlx@0.32.3',variant:instance.variant,maxInputTokens:instance.backend==='cpu'?1024:8192,truncation:instance.backend==='cpu'};
        instance.spec=spec;instance.fingerprint=crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex');await this.store.save();
        await this.progress(task,{phase:'CREATING_SERVICE'});await adapter.deploy(instance,cache);signal.throwIfAborted();
        await this.progress(task,{phase:'STARTING_SERVICE'});await adapter.start(instance);
        await this.waitHealthy(task,instance,signal);
      }else{
        const adapter=this.runtime[instance.backend];
        signal.throwIfAborted();
        if(task.action==='delete-cache'){
          if(Object.values(this.store.state.instances).some(i=>i.cacheKey===instance.cacheKey&&i.actualState!=='REMOVED'))throw Error('Cache is referenced by an installed instance; uninstall it first');
          const target=inside(this.cacheRoot,instance.cacheKey);await this.downloads.verify(target,registry.models.find(m=>m.id===instance.modelId).variants[instance.variant]);
          // Target comes only from a managed cache key, verified inside cacheRoot. No user path.
          await fs.rm(target,{recursive:true});instance.cacheDeleted=true;
        }else if(task.action==='remove'){
          instance.desiredState='REMOVED';await this.store.save();if((await adapter.inspect(instance)).status!=='MISSING')await adapter.remove(instance);instance.actualState='REMOVED';
        }else if(task.action==='stop'){
          instance.desiredState='STOPPED';await this.store.save();if((await adapter.inspect(instance)).status==='RUNNING')await adapter.stop(instance);instance.actualState='STOPPED';
        }else{
          instance.desiredState='RUNNING';await this.store.save();await this.progress(task,{phase:'STARTING_SERVICE'});
          if(task.action==='restart')await adapter.restart(instance);else await adapter.start(instance);await this.waitHealthy(task,instance,signal);
        }
      }
      await this.progress(task,{status:'SUCCEEDED',phase:'COMPLETED',result:{instanceId:instance.id}});
    }catch(error){
      if(instance){instance.actualState=signal.aborted?'STOPPED':'FAILED';if(signal.aborted||task.action==='deploy')instance.desiredState='STOPPED';if(task.action==='deploy')await this.runtime[instance.backend].stop(instance).catch(()=>{});}
      await this.progress(task,{status:signal.aborted?'CANCELLED':'FAILED',phase:signal.aborted?'CANCELLED':'FAILED',error:safeError(error)});
    }finally{this.controllers.delete(task.taskId);await this.store.save();}
  }
  async waitHealthy(task,instance,signal){
    await this.progress(task,{phase:'LOADING_MODEL'});let last;
    for(let attempt=0;attempt<180;attempt++){
      signal.throwIfAborted();try{await this.runtime[instance.backend].healthCheck(instance);await this.progress(task,{phase:'HEALTH_CHECKING'});instance.actualState='RUNNING';instance.lastHealthyAt=new Date().toISOString();return;}catch(error){last=error;await sleep(2000);}
    }
    throw Error('Health verification failed: '+safeError(last));
  }
  async cancel(taskId){const task=this.store.state.tasks[id(taskId)];if(!task)throw Error('Task not found');if(['SUCCEEDED','FAILED','CANCELLED'].includes(task.status))return task;task.cancelRequested=true;if(task.status==='PENDING')await this.progress(task,{status:'CANCELLED',phase:'CANCELLED'});this.controllers.get(taskId)?.abort();await this.store.save();return task;}
  async reconcile(){
    for(const instance of Object.values(this.store.state.instances)){
      if(instance.actualState==='REMOVED'||Object.values(this.store.state.tasks).some(t=>t.instanceId===instance.id&&['PENDING','RUNNING'].includes(t.status)))continue;
      const adapter=this.runtime[instance.backend],state=await adapter.inspect(instance);
      if(instance.desiredState==='RUNNING'){
        try{if(state.status!=='RUNNING')await adapter.start(instance);await adapter.healthCheck(instance);instance.actualState='RUNNING';instance.lastHealthyAt=new Date().toISOString();}catch{instance.actualState=state.status==='RUNNING'?'UNHEALTHY':state.status;}
      }else if(instance.desiredState==='STOPPED'){
        if(state.status==='RUNNING')await adapter.stop(instance);instance.actualState=state.status==='MISSING'?'MISSING':'STOPPED';
      }else if(instance.desiredState==='REMOVED'){
        if(state.status!=='MISSING')await adapter.remove(instance);instance.actualState='REMOVED';
      }else instance.actualState=state.status;
    }
    await this.store.save();
  }
  async metrics(instance){return{runtime:await this.runtime[instance.backend].getMetrics(instance),hardware:await detect(this.root,process.env.AGENT_PYTHON)};}
  async embed(instance,input){if(instance.actualState!=='RUNNING'||instance.desiredState!=='RUNNING')throw Error('Model service is not running');return this.runtime[instance.backend].embed(instance,input);}
  async close(){clearInterval(this.timer);for(const controller of this.controllers.values())controller.abort();await this.store.save();if(this.lock){await this.lock.close();await fs.unlink(this.lockFile);}}
}
async function start(){
  id(process.env.AGENT_ID);const verifier=new RequestVerifier(process.env.AGENT_TOKEN);const agent=await new DeploymentAgent(process.env.AGENT_DATA_DIR||path.resolve(__dirname,'.state')).initialize();
  const serve=async(req,res)=>{
    let bytes=0;const chunks=[];
    try{
      for await(const chunk of req){bytes+=chunk.length;if(bytes>1048576)throw Error('Invalid request size');chunks.push(chunk);}
      const raw=Buffer.concat(chunks).toString('utf8');
      if(req.headers['x-agent-id']!==process.env.AGENT_ID)throw Error('Agent identity mismatch');
      verifier.verify(req.method,req.url,req.headers,raw);const body=raw?JSON.parse(raw):{};
      let data;
      if(req.method==='GET'&&req.url==='/v1/node')data={id:process.env.AGENT_ID,hardware:await detect(agent.root,process.env.AGENT_PYTHON),registryVersion:1};
      else if(req.method==='GET'&&req.url==='/v1/state')data=agent.store.state;
      else if(req.method==='POST'&&req.url==='/v1/tasks')data=await agent.submit(body);
      else if(req.method==='POST'&&/^\/v1\/tasks\/[a-f0-9-]{36}\/cancel$/.test(req.url))data=await agent.cancel(req.url.split('/')[3]);
      else if(/^\/v1\/instances\/[a-f0-9-]{36}\/(logs|metrics|embeddings)$/.test(req.url)){
        const instance=agent.store.state.instances[id(req.url.split('/')[3])];if(!instance)throw Error('Managed instance not found');
        const action=req.url.split('/')[4];
        if(action==='embeddings'&&req.method==='POST'){
          const input=typeof body.input==='string'?[body.input]:body.input;
          if(body.model!==instance.modelId||!Array.isArray(input)||!input.length||input.length>32||input.some(t=>typeof t!=='string'||!t.trim()||t.length>32000))throw Error('Invalid embeddings input');
          data=await agent.embed(instance,input);
        }else if(action==='logs'&&req.method==='GET')data={logs:await agent.runtime[instance.backend].getLogs(instance)};
        else if(action==='metrics'&&req.method==='GET')data=await agent.metrics(instance);else throw Error('Invalid managed action');
      }else{res.writeHead(404);res.end('{}');return;}
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({data}));
    }catch(error){res.writeHead(/^Agent (authentication|identity)/.test(error.message)?401:400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:safeError(error)}));}
  };
  const server=process.env.AGENT_TLS_CERT&&process.env.AGENT_TLS_KEY?https.createServer({cert:await fs.readFile(process.env.AGENT_TLS_CERT),key:await fs.readFile(process.env.AGENT_TLS_KEY)},serve):http.createServer(serve);
  server.requestTimeout=30000;server.headersTimeout=10000;server.maxConnections=64;
  server.listen(Number(process.env.AGENT_PORT||19090),process.env.AGENT_HOST||'127.0.0.1',()=>console.log('Deployment Agent listening; authenticated API only'));
  const close=()=>{server.close();void agent.close().then(()=>process.exit(0));};process.on('SIGTERM',close);process.on('SIGINT',close);return{server,agent};
}
if(require.main===module)start().catch(()=>{console.error('Deployment Agent startup failed; check identity, key and state directory');process.exitCode=1;});
module.exports={DeploymentAgent,start};
