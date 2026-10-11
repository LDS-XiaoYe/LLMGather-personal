const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const registry=require('./registry.json');
const {command,detect}=require('./hardware.cjs');
const {id,inside}=require('./security.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class ModelRuntimeAdapter {
  async checkCompatibility(){throw Error('Unsupported runtime');}
  async healthCheck(instance){
    const response=await fetch(`http://127.0.0.1:${instance.port}/health`,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Health check failed');
    const result=await this.embed(instance,['模型健康检查','embedding health probe']);
    const dimensions=registry.models.find(m=>m.id===instance.modelId).dimensions;
    if(result.data?.length!==2||result.data.some(r=>r.embedding.length!==dimensions||!r.embedding.every(Number.isFinite)||!r.embedding.some(v=>v!==0)))throw Error('Health embedding dimension/value check failed');
    return true;
  }
  async embed(instance,input){
    const route=instance.backend==='apple'?'/v1/embeddings':'/v1/embeddings';
    const response=await fetch(`http://127.0.0.1:${instance.port}${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:instance.modelId,input,encoding_format:'float'}),signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('Model inference HTTP '+response.status);
    return response.json();
  }
}
class DockerRuntimeAdapter extends ModelRuntimeAdapter {
  constructor(root,cacheRoot,run=command){super();this.root=root;this.cacheRoot=cacheRoot;this.run=run;}
  name(instance){return 'llmgather-model-'+id(instance.id);}
  async owned(instance){
    const result=JSON.parse(await this.run('docker',['inspect',this.name(instance),'--format','{{json .}}']));
    if(result.Config.Labels?.['io.llmgather.managed']!==instance.id||result.Config.Labels?.['io.llmgather.agent']!==process.env.AGENT_ID)throw Error('Managed container ownership mismatch');
    return result;
  }
  async prepare(instance){await this.run('docker',['pull',instance.image],{timeout:20*60*1000});}
  arguments(instance,cache){
    const relative=path.relative(this.cacheRoot,cache.path);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid model cache mount');
    const volume=process.env.AGENT_CACHE_VOLUME;
    if(volume&&!/^[a-zA-Z0-9_-]+$/.test(volume))throw Error('Invalid model cache volume');
    if(cache.path.includes(','))throw Error('Invalid model cache path');
    const mount=volume?`type=volume,src=${volume},dst=/model-cache,readonly`:`type=bind,src=${cache.path},dst=/model,readonly`;
    const modelPath=volume?'/model-cache/'+relative.split(path.sep).join('/'):'/model';
    const args=['create','--name',this.name(instance),'--label','io.llmgather.managed='+instance.id,'--label','io.llmgather.agent='+process.env.AGENT_ID,
      '--restart','unless-stopped','--cpus',String(instance.cpu),'--memory',instance.memoryMiB+'m','--memory-swap',instance.memoryMiB+'m',
      '--pids-limit','256','--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=256m',
      '--mount',mount,'--publish',`127.0.0.1:${instance.port}:80`,
      '--env','HF_HUB_OFFLINE=1','--env','HF_HOME=/tmp/huggingface',
      '--log-opt','max-size=10m','--log-opt','max-file=3'];
    if(instance.backend==='nvidia')args.push('--gpus','device='+instance.gpuUuid);
    args.push(instance.image,'--model-id',modelPath,'--port','80','--dtype',instance.precision,'--max-client-batch-size','32','--max-concurrent-requests','8','--max-batch-tokens',instance.backend==='cpu'?'1024':'8192','--pooling','cls');
    if(instance.backend==='cpu')args.push('--auto-truncate');
    return args;
  }
  async deploy(instance,cache){
    try{await this.owned(instance);return;}catch(e){if(e.message==='Managed container ownership mismatch')throw e;}
    await this.run('docker',this.arguments(instance,cache));
  }
  async start(instance){await this.owned(instance);await this.run('docker',['start',this.name(instance)]);}
  async stop(instance){await this.owned(instance);await this.run('docker',['stop','--time','15',this.name(instance)]);}
  async restart(instance){await this.owned(instance);await this.run('docker',['restart','--time','15',this.name(instance)]);}
  async remove(instance){await this.owned(instance);await this.run('docker',['rm','--force',this.name(instance)]);}
  async inspect(instance){try{const value=await this.owned(instance);return{status:value.State.Running?'RUNNING':'STOPPED',exitCode:value.State.ExitCode,image:value.Config.Image,startedAt:value.State.StartedAt};}catch(e){if(e.message==='Managed container ownership mismatch')throw e;return{status:'MISSING'};}}
  async getLogs(instance){await this.owned(instance);return this.run('docker',['logs','--tail','150',this.name(instance)],{includeStderr:true}).catch(()=> 'Docker model logs unavailable');}
  async getMetrics(instance){await this.owned(instance);return JSON.parse(await this.run('docker',['stats','--no-stream','--format','{{json .}}',this.name(instance)]));}
}
class DockerCpuRuntimeAdapter extends DockerRuntimeAdapter {
  async checkCompatibility(config,hardware){
    if(hardware.docker?.os!=='linux'||!['x86_64','amd64'].includes(hardware.docker?.arch))throw Error('Unsupported CPU Docker daemon: Linux amd64 is required');
    if(hardware.docker.memoryMiB<config.memoryMiB)throw Error('Insufficient Docker memory for selected model');
    return registry.matrix.find(r=>r.backend==='cpu');
  }
}
class NvidiaCudaRuntimeAdapter extends DockerRuntimeAdapter {
  async checkCompatibility(config,hardware){
    if(hardware.docker?.os!=='linux'||!['x86_64','amd64'].includes(hardware.docker?.arch))throw Error('Unsupported CUDA Docker daemon architecture');
    if(!hardware.docker.nvidiaRuntime)throw Error('CUDA Docker runtime missing: install NVIDIA Container Toolkit');
    const gpu=hardware.gpus.find(g=>g.uuid===config.gpuUuid);
    if(!gpu)throw Error('GPU selection is not available on this node');
    if(gpu.freeMiB<3072)throw Error('Insufficient free GPU memory; at least 3072 MiB required');
    const runtime=registry.matrix.find(r=>r.backend==='nvidia'&&r.capability===gpu.capability);
    if(!runtime)throw Error('Unsupported GPU compute capability '+gpu.capability);
    if(runtime.experimental&&!config.allowExperimental)throw Error('GPU Blackwell runtime is experimental; explicit acknowledgement required');
    const driver=parseInt(gpu.driver,10);if(driver<(gpu.capability==='12.0'?570:535))throw Error('CUDA driver is too old for selected runtime');
    return{...runtime,gpuName:gpu.name};
  }
  async healthCheck(instance){
    await super.healthCheck(instance);
    // TEI may fall back to CPU when CUDA initialization fails. Require runtime device evidence.
    const info=await this.owned(instance);
    if(!info.HostConfig.DeviceRequests?.some(d=>d.DeviceIDs?.includes(instance.gpuUuid)))throw Error('GPU device was not allocated');
    const logs=await this.getLogs(instance);
    if(/Using CPU instead|Starting .* on Cpu/i.test(logs)||!/(Starting .*Cuda|compute cap|CUDA device)/i.test(logs))throw Error('GPU inference device not confirmed by runtime logs');
    return true;
  }
}
function xml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
class AppleMetalRuntimeAdapter extends ModelRuntimeAdapter {
  constructor(root,cacheRoot,run=command){super();this.root=root;this.cacheRoot=cacheRoot;this.run=run;}
  label(instance){return 'io.llmgather.model.'+id(instance.id);}
  plist(instance){return inside(this.root,'launchd',this.label(instance)+'.plist');}
  python(){return inside(this.root,'mlx-venv','bin','python');}
  async checkCompatibility(config,hardware){
    if(hardware.platform!=='darwin'||hardware.arch!=='arm64'||!/^Apple M\d/.test(hardware.apple?.chip||''))throw Error('Unsupported Apple runtime: registered macOS Apple Silicon node required');
    if(parseInt(hardware.apple.version,10)<14)throw Error('Apple MLX runtime requires macOS 14 or newer');
    if(hardware.memoryMiB<config.memoryMiB)throw Error('Insufficient Apple unified memory');
    return{precision:'float16',verification:'MLX FP16 variant; node health probe required',variant:'mlx'};
  }
  async prepare(){
    try{await fs.access(this.python());}catch{
      await this.run(process.env.AGENT_PYTHON||'python3',['-m','venv',inside(this.root,'mlx-venv')],{timeout:120000});
      await this.run(this.python(),['-m','pip','install','--requirement',path.join(__dirname,'native','requirements.txt')],{timeout:20*60*1000});
    }
    const probe=await this.run(this.python(),['-c','import mlx.core as mx; import mlx_embeddings; assert mx.metal.is_available(), "Metal unavailable"; print("METAL_READY")']);
    if(!probe.includes('METAL_READY'))throw Error('Metal or MLX environment unavailable');
  }
  async deploy(instance,cache){
    const folder=inside(this.root,'launchd');await fs.mkdir(folder,{recursive:true});const logs=inside(this.root,'logs');await fs.mkdir(logs,{recursive:true});
    const args=[this.python(),path.join(__dirname,'native','embedding_server.py'),'--model-path',cache.path,'--model-id',instance.modelId,'--port',String(instance.port)];
    const body=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${xml(this.label(instance))}</string><key>ProgramArguments</key><array>${args.map(a=>'<string>'+xml(a)+'</string>').join('')}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${xml(inside(logs,instance.id+'.out'))}</string><key>StandardErrorPath</key><string>${xml(inside(logs,instance.id+'.err'))}</string><key>EnvironmentVariables</key><dict><key>HF_HUB_OFFLINE</key><string>1</string></dict></dict></plist>`;
    await fs.writeFile(this.plist(instance),body,{mode:0o600});
  }
  async start(instance){await this.run('launchctl',['bootstrap','gui/'+os.userInfo().uid,this.plist(instance)]).catch(async()=>{await this.run('launchctl',['kickstart','gui/'+os.userInfo().uid+'/'+this.label(instance)]);});}
  async stop(instance){await this.run('launchctl',['bootout','gui/'+os.userInfo().uid+'/'+this.label(instance)]);}
  async restart(instance){await this.run('launchctl',['kickstart','-k','gui/'+os.userInfo().uid+'/'+this.label(instance)]);}
  async remove(instance){await this.stop(instance).catch(()=>{});await fs.unlink(this.plist(instance));}
  async inspect(instance){try{const state=await this.run('launchctl',['print','gui/'+os.userInfo().uid+'/'+this.label(instance)]);return{status:/state = running/.test(state)?'RUNNING':'STOPPED',pid:Number(state.match(/pid = (\d+)/)?.[1]||0)};}catch{return{status:'STOPPED'};}}
  async getLogs(instance){const read=async kind=>(await fs.readFile(inside(this.root,'logs',instance.id+'.'+kind),'utf8').catch(()=> '')).slice(-16000);return(await read('out'))+'\n'+await read('err');}
  async getMetrics(instance){const state=await this.inspect(instance);if(!state.pid)return{status:state.status};return{process:await this.run('ps',['-p',String(state.pid),'-o','%cpu,rss,etime']),metalMemory:'Reported by native /health endpoint',...(await(await fetch(`http://127.0.0.1:${instance.port}/health`,{signal:AbortSignal.timeout(5000)})).json())};}
}
function adapters(root,cache){return{cpu:new DockerCpuRuntimeAdapter(root,cache),nvidia:new NvidiaCudaRuntimeAdapter(root,cache),apple:new AppleMetalRuntimeAdapter(root,cache)};}
module.exports={ModelRuntimeAdapter,DockerRuntimeAdapter,DockerCpuRuntimeAdapter,NvidiaCudaRuntimeAdapter,AppleMetalRuntimeAdapter,adapters,xml,sleep,detect};
