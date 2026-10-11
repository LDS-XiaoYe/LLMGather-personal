// Real hardware acceptance. Creates only owned instances; keeps model cache for repeatability.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {DeploymentAgent}=require('../server.cjs');
const {detect}=require('../hardware.cjs');
async function main(){
  process.env.AGENT_ID ||= 'a81f7b32-e1d2-44ef-bfd3-2b11e302eb58';
  const root=path.resolve(process.env.AGENT_DATA_DIR||'.p0-artifacts/bge-m3/agent-state'),a=await new DeploymentAgent(root).initialize();
  const report={hardware:await detect(root),results:[],apple:'NOT_RUN: macOS Apple Silicon hardware not present'};
  async function operation(id,action,config){
    const task=await a.submit({taskId:randomUUID(),instanceId:id,action,...(config?{config}:{})});
    let last='';while(['PENDING','RUNNING'].includes(task.status)){if(task.phase!==last){last=task.phase;console.log(action,last);}await new Promise(r=>setTimeout(r,1000));}
    if(task.status!=='SUCCEEDED')throw Error(task.error||task.status);return task;
  }
  try{
    for(const backend of process.argv.slice(2).length?process.argv.slice(2):['cpu','nvidia']){
      const id=randomUUID(),config={modelId:'bge-m3',backend,source:backend==='apple'?'huggingface':'auto',cpu:4,memoryMiB:8192,...(backend==='nvidia'?{gpuUuid:report.hardware.gpus[0]?.uuid,allowExperimental:true}:{})};
      await operation(id,'deploy',config);
      const instance=a.store.state.instances[id];const vectors=await a.embed(instance,['中文知识库检索','English retrieval']);
      assert.equal(vectors.data.length,2);assert.equal(vectors.data[0].embedding.length,1024);
      const metrics=await a.metrics(instance);console.log('PASS',backend,'real BGE-M3 batch: 2 x 1024',JSON.stringify(metrics.runtime));
      await operation(id,'stop');await assert.rejects(a.embed(instance,['stopped']));await operation(id,'start');await operation(id,'restart');
      const logs=await a.runtime[backend].getLogs(instance);await fs.writeFile(path.join(root,backend+'-runtime.log'),logs);
      report.results.push({backend,id,fingerprint:instance.fingerprint,spec:instance.spec,source:instance.source,dimensions:1024,batch:2,lifecycle:'deploy/stop/start/restart passed',metrics});
      await operation(id,'stop');await operation(id,'remove');
    }
  }finally{await a.close();await fs.writeFile(path.join(root,'acceptance.json'),JSON.stringify(report,null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
