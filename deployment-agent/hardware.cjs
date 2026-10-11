const os=require('node:os');
const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
async function command(program,args,options={}) { const result=await execute(program,args,{timeout:20000,maxBuffer:4*1024*1024,windowsHide:true,...options});return (result.stdout+(options.includeStderr?result.stderr:'')).trim(); }
async function detect(root,python='python3') {
  const result={platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,memoryMiB:Math.floor(os.totalmem()/1048576),freeMemoryMiB:Math.floor(os.freemem()/1048576),gpus:[],docker:null,apple:null};
  try{const disk=await fs.statfs(root);result.freeDiskMiB=Number(disk.bavail)*Number(disk.bsize)/1048576;}catch{result.freeDiskMiB=0;}
  try{const info=JSON.parse(await command('docker',['info','--format','{{json .}}']));result.docker={os:info.OSType,arch:info.Architecture,nvidiaRuntime:Boolean(info.Runtimes?.nvidia),memoryMiB:Math.floor(info.MemTotal/1048576)};}catch{result.dockerError='Docker daemon unavailable';}
  try {result.gpus=(await command('nvidia-smi',['--query-gpu=name,uuid,memory.total,memory.free,compute_cap,driver_version','--format=csv,noheader,nounits'])).split('\n').filter(Boolean).map(line=>{const [name,uuid,total,free,capability,driver]=line.split(',').map(s=>s.trim());return{name,uuid,totalMiB:Number(total),freeMiB:Number(free),capability,driver};});}catch{result.gpuError='NVIDIA discovery unavailable';}
  if(result.platform==='darwin'&&result.arch==='arm64'){
    const chip=await command('sysctl',['-n','machdep.cpu.brand_string']);const version=await command('sw_vers',['-productVersion']);
    let mlx=false,metal=false;
    try{const probe=JSON.parse(await command(python,['-c','import json; import mlx.core as mx; import mlx_embeddings; print(json.dumps({"metal": mx.metal.is_available()}))']));mlx=true;metal=probe.metal;}catch{/* MLX is installed by prepare, never fake a GPU result. */}
    result.apple={chip,version,mlx,metal,unifiedMemoryMiB:result.memoryMiB};
  }
  return result;
}
module.exports={command,detect};
