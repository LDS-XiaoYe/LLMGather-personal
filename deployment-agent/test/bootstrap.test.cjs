const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ensureCredentials}=require('../container-bootstrap.cjs');
const {DockerCpuRuntimeAdapter}=require('../runtime.cjs');
const registry=require('../registry.json');
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'llmgather-node-bootstrap-'));
  t.after(async()=>{await fs.unlink(path.join(dir,'agent.json')).catch(()=>{});await fs.rmdir(dir);});
  return dir;
}
test('container automatically creates a stable UUID and secret, reuses exact file bytes',async t=>{
  const dir=await fixture(t),first=await ensureCredentials(dir),bytes=await fs.readFile(path.join(dir,'agent.json'));
  assert.match(first.id,/^[a-f0-9-]{36}$/);assert.match(first.token,/^[a-f0-9]{96}$/);
  assert.deepEqual(await ensureCredentials(dir),first);assert.deepEqual(await fs.readFile(path.join(dir,'agent.json')),bytes);
  if(process.platform!=='win32')assert.equal((await fs.stat(path.join(dir,'agent.json'))).mode&0o777,0o600);
});
test('concurrent bootstrap converges on one identity; independent installs differ',async t=>{
  const a=await fixture(t),b=await fixture(t);
  const results=await Promise.all([ensureCredentials(a),ensureCredentials(a),ensureCredentials(a)]);
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
  assert.notEqual(results[0].id,(await ensureCredentials(b)).id);
});
test('corrupted persisted credentials fail rather than rotating identity',async t=>{
  const dir=await fixture(t);await fs.writeFile(path.join(dir,'agent.json'),'invalid persisted identity');
  await assert.rejects(ensureCredentials(dir));assert.equal(await fs.readFile(path.join(dir,'agent.json'),'utf8'),'invalid persisted identity');
});
test('container models use the Agent namespace and private ports; native nodes retain loopback publishing',t=>{
  const prior=process.env.AGENT_NETWORK_CONTAINER;t.after(()=>{if(prior===undefined)delete process.env.AGENT_NETWORK_CONTAINER;else process.env.AGENT_NETWORK_CONTAINER=prior;});
  const adapter=new DockerCpuRuntimeAdapter('/state','/state/cache');
  const instance={id:'12345678-1234-4123-8123-123456789abc',cpu:2,memoryMiB:6144,port:21000,backend:'cpu',precision:'float32',image:registry.matrix.find(r=>r.backend==='cpu').image};
  process.env.AGENT_NETWORK_CONTAINER='abcdef123456';
  const args=adapter.arguments(instance,{path:'/state/cache/fixture'});
  assert.equal(args[args.indexOf('--network')+1],'container:abcdef123456');assert(!args.includes('--publish'));
  assert.equal(args[args.indexOf('--port')+1],'21000');
  assert(adapter.networkMatches({HostConfig:{NetworkMode:'container:abcdef123456789012'}}));
  assert(!adapter.networkMatches({HostConfig:{NetworkMode:'container:ffffffffffff'}}));
  process.env.AGENT_NETWORK_CONTAINER='../../invalid';assert.throws(()=>adapter.arguments(instance,{path:'/state/cache/fixture'}));
  delete process.env.AGENT_NETWORK_CONTAINER;
  const native=adapter.arguments(instance,{path:'/state/cache/fixture'});
  assert(native.includes('127.0.0.1:21000:80'));assert.equal(native[native.indexOf('--port')+1],'80');
});
