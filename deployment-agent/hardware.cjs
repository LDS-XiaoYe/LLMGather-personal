const os=require('node:os');
const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
const {randomUUID}=require('node:crypto');
async function command(program,args,options={}) { const result=await execute(program,args,{timeout:20000,maxBuffer:4*1024*1024,windowsHide:true,...options});return (result.stdout+(options.includeStderr?result.stderr:'')).trim(); }
const gpuQuery=['--query-gpu=name,uuid,memory.total,memory.free,compute_cap,driver_version','--format=csv,noheader,nounits'];
function parseNvidiaGpus(output){
  return output.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const fields=line.split(',').map(s=>s.trim());
    const [name,uuid,total,free,capability,driver]=fields;
    if(fields.length!==6||!name||!/^GPU-[a-f0-9-]+$/i.test(uuid)||!/^\d+\.\d+$/.test(capability)||!/^\d+(\.\d+)+$/.test(driver)||
      !total||!free||!Number.isFinite(Number(total))||Number(total)<=0||!Number.isFinite(Number(free))||Number(free)<0||Number(free)>Number(total))throw Error('Invalid NVIDIA discovery response');
    return{name,uuid,totalMiB:Number(total),freeMiB:Number(free),capability,driver};
  });
}
function createNvidiaDiscovery(run=command,{now=Date.now,ttl=30000,container=()=>process.env.AGENT_NETWORK_CONTAINER}={}){
  let cached,pending;
  async function probe(target){
    let helper;
    const source=target?'docker':'native';
    try{
      let output;
      if(target){
        if(!/^[a-f0-9]{12,64}$/.test(target))throw Error('Invalid Agent container identity');
        // Reuse our immutable local image: no downloads, host mounts, socket or published ports.
        const image=(await run('docker',['inspect','--format','{{.Image}}',target],{timeout:1000})).trim();
        if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('Invalid Agent image identity');
        helper='llmgather-gpu-probe-'+randomUUID();
        output=await run('docker',['run','--rm','--name',helper,'--pull','never','--gpus','all','--network','none',
          '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--cpus','1','--memory','128m',
          '-e','NVIDIA_DRIVER_CAPABILITIES=utility','--entrypoint','nvidia-smi',image,...gpuQuery],{timeout:6000});
      }else output=await run('nvidia-smi',gpuQuery,{timeout:3000});
      const gpus=parseNvidiaGpus(output);
      return{gpus,gpuDiscovery:{source,status:gpus.length?'available':'not-detected',message:gpus.length?'': '节点未发现 NVIDIA GPU'}};
    }catch(error){
      // Do not forward arbitrary daemon stderr into UI or expose container internals.
      const text=String(error.stderr||error.message||'');
      const runtimeMissing=/could not select device driver|unknown.*runtime|nvidia-container-cli.*not found/i.test(text);
      const noDevice=/no devices were found|no supported devices/i.test(text);
      return{gpus:[],gpuDiscovery:{source,status:runtimeMissing?'runtime-unavailable':noDevice?'not-detected':'unavailable',
        message:runtimeMissing?'Docker GPU 运行时不可用，请检查 Container Toolkit / Docker Desktop GPU 支持':
          noDevice?'节点未发现 NVIDIA GPU':target?'Docker GPU 探测失败，请检查驱动与 Docker GPU 访问状态':'节点 NVIDIA 探测失败，请检查驱动及 nvidia-smi'}};
    }finally{
      // A timed-out Docker CLI may leave the helper behind. Remove only our unique probe.
      if(helper)await run('docker',['rm','--force',helper],{timeout:1000}).catch(()=>{});
    }
  }
  return async()=>{
    const target=container()||'';
    if(cached&&cached.target===target&&now()-cached.at<ttl)return cached.value;
    if(pending)return pending;
    pending=probe(target).then(value=>{cached={target,at:now(),value};return value;}).finally(()=>{pending=undefined;});
    return pending;
  };
}
const discoverNvidia=createNvidiaDiscovery();
async function detect(root,python='python3') {
  const result={platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,memoryMiB:Math.floor(os.totalmem()/1048576),freeMemoryMiB:Math.floor(os.freemem()/1048576),gpus:[],docker:null,apple:null};
  try{const disk=await fs.statfs(root);result.freeDiskMiB=Number(disk.bavail)*Number(disk.bsize)/1048576;}catch{result.freeDiskMiB=0;}
  try{const info=JSON.parse(await command('docker',['info','--format','{{json .}}']));result.docker={os:info.OSType,arch:info.Architecture,nvidiaRuntime:Boolean(info.Runtimes?.nvidia),memoryMiB:Math.floor(info.MemTotal/1048576)};}catch{result.dockerError='Docker daemon unavailable';}
  Object.assign(result,await discoverNvidia());
  if(result.gpuDiscovery.status!=='available')result.gpuError=result.gpuDiscovery.message;
  // Successful --gpus execution is stronger evidence than the daemon runtime-name list.
  if(result.docker&&result.gpuDiscovery.source==='docker'&&result.gpus.length)result.docker.nvidiaRuntime=true;
  if(result.platform==='darwin'&&result.arch==='arm64'){
    const chip=await command('sysctl',['-n','machdep.cpu.brand_string']);const version=await command('sw_vers',['-productVersion']);
    let mlx=false,metal=false;
    try{const probe=JSON.parse(await command(python,['-c','import json; import mlx.core as mx; import mlx_embeddings; print(json.dumps({"metal": mx.metal.is_available()}))']));mlx=true;metal=probe.metal;}catch{/* MLX is installed by prepare, never fake a GPU result. */}
    result.apple={chip,version,mlx,metal,unifiedMemoryMiB:result.memoryMiB};
  }
  return result;
}
module.exports={command,detect,parseNvidiaGpus,createNvidiaDiscovery};
