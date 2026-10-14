const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NvidiaCudaRuntimeAdapter}=require('../runtime.cjs');

async function fixture(t){
  const instance={id:'12345678-1234-4123-8123-123456789abc',modelId:'bge-m3',gpuUuid:'GPU-fixture',port:21000};
  t.mock.method(global,'fetch',async url=>{assert.equal(url,'http://127.0.0.1:21000/health');return{ok:true};});
  const info={Id:'a'.repeat(64),State:{Running:true,StartedAt:'2026-10-12T00:00:00.000000000Z'},HostConfig:{DeviceRequests:[{DeviceIDs:[instance.gpuUuid]}]}};
  const calls=[];
  let logs='Starting FlashBert model on Cuda(CudaDevice(DeviceId(1)))\n'+'inference Success\n'.repeat(200);
  const run=async(program,args,options)=>{assert.equal(program,'docker');calls.push({args,options});if(args[0]==='logs')return logs;throw Error('Unexpected Docker command');};
  const adapter=()=>{
    const a=new NvidiaCudaRuntimeAdapter('/state','/state/cache',run);
    a.owned=async()=>info;
    a.embed=async()=>({data:[{embedding:Array(1024).fill(0.1)},{embedding:Array(1024).fill(0.2)}]});
    return a;
  };
  return{instance,info,calls,adapter,setLogs:value=>{logs=value;}};
}

test('CUDA startup survives more than 150 request logs; scan uses current container lifecycle, not UI tail',async t=>{
  const f=await fixture(t);
  assert.equal(await f.adapter().healthCheck(f.instance),true);
  assert.deepEqual(f.calls[0].args.slice(0,3),['logs','--since',f.info.State.StartedAt]);
  assert.equal(f.calls[0].args.at(-1),f.info.Id);
  assert(!f.calls[0].args.includes('--tail'));
  assert.equal(f.calls[0].options.includeStderr,true);
  assert(f.calls[0].options.maxBuffer<=32*1024*1024);
});

test('persisted verification survives Agent restart and rotated startup logs, but still probes embeddings',async t=>{
  const f=await fixture(t);await f.adapter().healthCheck(f.instance);
  const persisted=JSON.parse(JSON.stringify(f.instance));f.setLogs('inference Success');
  const a=f.adapter();let probes=0;const embed=a.embed;
  a.embed=async()=>{probes++;return embed();};
  assert.equal(await a.healthCheck(persisted),true);
  assert.equal(probes,1);assert.equal(f.calls.length,1);
});

test('container restart invalidates evidence and rejects CPU fallback even with a CUDA message',async t=>{
  const f=await fixture(t);await f.adapter().healthCheck(f.instance);
  f.info.State.StartedAt='2026-10-12T01:00:00.000000000Z';f.setLogs('CUDA device detected\nUsing CPU instead');
  await assert.rejects(f.adapter().healthCheck(f.instance),/GPU inference device not confirmed/);
  assert.equal(f.instance.cudaVerifiedRun,undefined);assert.equal(f.calls.length,2);
});

test('container recreation requires fresh evidence rather than trusting old container identity',async t=>{
  const f=await fixture(t);await f.adapter().healthCheck(f.instance);
  f.info.Id='b'.repeat(64);f.setLogs('inference Success');
  await assert.rejects(f.adapter().healthCheck(f.instance),/GPU inference device not confirmed/);
  assert.equal(f.instance.cudaVerifiedRun,undefined);
  f.setLogs('Starting FlashBert model on Cuda(CudaDevice(DeviceId(1)))');
  assert.equal(await f.adapter().healthCheck(f.instance),true);
  assert.equal(f.instance.cudaVerifiedRun.containerId,f.info.Id);
});

test('GPU UUID change and missing allocation never reuse a previous device verification',async t=>{
  const f=await fixture(t);await f.adapter().healthCheck(f.instance);
  f.instance.gpuUuid='GPU-other';
  await assert.rejects(f.adapter().healthCheck(f.instance),/GPU device was not allocated/);
  f.info.HostConfig.DeviceRequests=[{DeviceIDs:['GPU-other']}];f.setLogs('request Success');
  await assert.rejects(f.adapter().healthCheck(f.instance),/GPU inference device not confirmed/);
});

test('cached device evidence does not mask invalid embedding dimensions or a stopped container',async t=>{
  const f=await fixture(t);const a=f.adapter();await a.healthCheck(f.instance);
  a.embed=async()=>({data:[{embedding:[1]},{embedding:[1]}]});
  await assert.rejects(a.healthCheck(f.instance),/dimension\/value check failed/);
  f.info.State.Running=false;
  await assert.rejects(f.adapter().healthCheck(f.instance),/GPU model container is not running/);
});
