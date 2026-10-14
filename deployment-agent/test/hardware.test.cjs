const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseNvidiaGpus,createNvidiaDiscovery}=require('../hardware.cjs');
const csv='NVIDIA GeForce RTX 5070, GPU-d009a200-16ec-8b10-6aea-7b5412db9b6f, 12227, 7044, 12.0, 610.88';
const image='sha256:'+'a'.repeat(64),containerId='b'.repeat(12);

test('GPU parser preserves real hardware fields and rejects incomplete output',()=>{
  const [gpu]=parseNvidiaGpus(csv+'\r\n');assert.equal(gpu.name,'NVIDIA GeForce RTX 5070');
  assert.equal(gpu.freeMiB,7044);assert.equal(gpu.capability,'12.0');assert.equal(gpu.driver,'610.88');
  assert.deepEqual(parseNvidiaGpus(''),[]);
  for(const invalid of [csv.replace('7044','N/A'),csv.replace('12227',''),csv.replace('12.0','unknown'),csv.replace('7044','20000')])assert.throws(()=>parseNvidiaGpus(invalid));
});
test('native Agent keeps native GPU discovery without creating Docker helpers',async()=>{
  const probe=createNvidiaDiscovery(async(program)=>{assert.equal(program,'nvidia-smi');return csv;},{container:()=>''});
  const result=await probe();assert.equal(result.gpuDiscovery.source,'native');assert.equal(result.gpus.length,1);
});
test('container Agent probes the daemon GPU with its immutable image and removes only its helper',async()=>{
  const calls=[];let time=0;
  const probe=createNvidiaDiscovery(async(program,args)=>{
    calls.push(args);assert.equal(program,'docker');
    if(args[0]==='inspect')return image;
    if(args[0]==='run'){
      for(const flag of ['--read-only','--cap-drop','--pids-limit','--gpus'])assert(args.includes(flag));
      assert.equal(args[args.indexOf('--network')+1],'none');assert.equal(args[args.indexOf('--pull')+1],'never');
      assert(args.includes(image));assert(!args.includes('--volume'));assert(!args.includes('--publish'));
      return csv;
    }
    assert.equal(args[0],'rm');return '';
  },{container:()=>containerId,now:()=>time});
  const results=await Promise.all([probe(),probe(),probe()]);
  assert(results.every(r=>r.gpuDiscovery.status==='available'));assert.equal(calls.filter(a=>a[0]==='run').length,1);
  assert.equal(calls[1][calls[1].indexOf('--name')+1],calls[2][2]);
  await probe();assert.equal(calls.length,3);
  time=30001;await probe();assert.equal(calls.filter(a=>a[0]==='run').length,2);
});
test('failed or timed-out GPU probes do not claim no GPU and always clean up',async()=>{
  for(const message of ['probe timeout','could not select device driver with capabilities: [[gpu]]','No devices were found']){
    let removed=false;
    const probe=createNvidiaDiscovery(async(_program,args)=>{
      if(args[0]==='inspect')return image;
      if(args[0]==='run')throw Object.assign(Error(message),{stderr:message});
      removed=true;return '';
    },{container:()=>containerId});
    const result=await probe();assert.deepEqual(result.gpus,[]);assert(removed);
    assert.equal(result.gpuDiscovery.status,message.startsWith('could')?'runtime-unavailable':message.startsWith('No')?'not-detected':'unavailable');
  }
});
test('untrusted container or image identities never become Docker run arguments',async()=>{
  let ran=false;
  for(const target of ['invalid;host',containerId]){
    const probe=createNvidiaDiscovery(async(_program,args)=>{if(args[0]==='run')ran=true;return 'untrusted-image';},{container:()=>target});
    assert.equal((await probe()).gpuDiscovery.status,'unavailable');
  }
  assert.equal(ran,false);
});
