import { validateAgentUrl } from './agent.client';
import { modelRegistry, validateConfig } from './model.registry';
import { managedId } from './model-services.service';
import { ManagedEmbeddingService } from './managed-embedding.service';
import { ModelServicesService } from './model-services.service';
import { DatabaseService } from '../database/database.service';
import { AgentClient } from './agent.client';
import { AdminGuard } from '../common/guards/admin.guard';
import { ExecutionContext } from '@nestjs/common';
describe('model service contract',()=>{
  test('REST/SSE snapshots omit uninstalled models and their default marker without deleting lifecycle history',async()=>{
    const config=JSON.stringify({modelId:'bge-m3',backend:'cpu'});
    const instance=(id:string,actual_state:string,desired_state=actual_state,operation_id:string|null=null)=>({id,actual_state,desired_state,operation_id,config_json:config});
    const rows=[instance('removed','REMOVED'),instance('stopped','STOPPED'),instance('failed-remove','FAILED','REMOVED'),instance('removing','RUNNING','REMOVED','task'),instance('redeploying','REMOVED','RUNNING','task')];
    const history=[{id:'task',instanceId:'removed',status:'SUCCEEDED',progressJson:'{}'}];
    const run=jest.fn(),db={connection:{prepare:(sql:string)=>({
      all:async()=>sql.includes('FROM model_instances')?rows:sql.includes('FROM model_tasks')?history:[],
      get:async()=>({value:'removed'}),run,
    })}} as unknown as DatabaseService;
    const service=new ModelServicesService(db,{} as AgentClient);
    let snapshot=await service.snapshot();
    expect(snapshot.instances.map(i=>(i as Record<string,unknown>).id)).toEqual(['stopped','failed-remove','removing','redeploying']);
    expect(snapshot.defaultInstanceId).toBeNull();expect(snapshot.tasks).toHaveLength(1);expect(run).not.toHaveBeenCalled();
    rows.splice(0,rows.length,instance('removed','REMOVED'));
    snapshot=await service.snapshot();expect(snapshot.instances).toEqual([]);
  });
  test('confirmed removal clears only its own default marker, not KB bindings or other defaults',async()=>{
    const statements:Array<{sql:string;args:unknown[]}>=[];
    const db={connection:{prepare:(sql:string)=>({all:async()=>[{id:'removed',model_id:'bge-m3',desired_state:'REMOVED'}],run:async(...args:unknown[])=>{statements.push({sql,args});return{changes:1};}})}} as unknown as DatabaseService;
    const service=new ModelServicesService(db,{} as AgentClient);
    await (service as any).syncInstances({id:'node'},{instances:{removed:{actualState:'REMOVED'}},tasks:{}});
    expect(statements.find(s=>s.sql.startsWith('DELETE'))).toEqual({sql:"DELETE FROM model_settings WHERE id='default_embedding' AND value=?",args:['removed']});
    expect(statements.some(s=>/DELETE FROM (model_instances|knowledge_bases|model_tasks)/.test(s.sql))).toBe(false);
  });
  test('fixed revisions, source parity and distinct runtime images',()=>{
    const model=modelRegistry.models[0];expect(model.dimensions).toBe(1024);
    expect(model.variants.tei.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(model.variants.tei.files.every(f=>f.modelscopeRevision&&!!(f.sha256||f.gitBlob))).toBe(true);
    expect(model.variants.mlx.sources).toEqual(['huggingface']);
    expect(new Set(modelRegistry.matrix.map(r=>r.image)).size).toBe(4);
  });
  test('configuration does not accept arbitrary image, mount, shell, memory or GPU',()=>{
    const c={modelId:'bge-m3',backend:'cpu' as const,source:'auto' as const,cpu:2,memoryMiB:6144};
    expect(validateConfig(c)).toEqual(c);
    expect(()=>validateConfig({...c,image:'evil'} as typeof c)).toThrow();
    expect(()=>validateConfig({...c,cpu:0})).toThrow();
    expect(()=>validateConfig({...c,backend:'nvidia'})).toThrow();
  });
  test('Agent URLs reject metadata SSRF, credentials, path and off-allowlist endpoints',()=>{
    delete process.env.MODEL_AGENT_ALLOWED_HOSTS;
    expect(validateAgentUrl('http://127.0.0.1:19090').port).toBe('19090');
    for(const url of ['http://169.254.169.254','http://example.com','http://token@localhost','http://localhost/command','file:///tmp/a'])expect(()=>validateAgentUrl(url)).toThrow();
    process.env.MODEL_AGENT_ALLOWED_HOSTS='mac.example';expect(()=>validateAgentUrl('http://mac.example')).toThrow();expect(validateAgentUrl('https://mac.example').protocol).toBe('https:');delete process.env.MODEL_AGENT_ALLOWED_HOSTS;
  });
  test('identifiers reject path traversal and malformed UUID',()=>{expect(()=>managedId('../model')).toThrow();expect(()=>managedId('-'.repeat(36))).toThrow();});
  test('node freshness uses the database clock rather than interpreting DATETIME in the host timezone',async()=>{
    const id='f5736df0-4f77-4b34-9acf-0183beac0de0';
    const db={connection:{prepare:(sql:string)=>({get:async()=>sql.includes('model_nodes')?{id,status:'ONLINE',fresh:1,last_seen:'2000-01-01'}:{id,node_id:id,actual_state:'RUNNING',desired_state:'RUNNING',provider_registered:1}})}} as unknown as DatabaseService;
    expect((await new ModelServicesService(db,{} as AgentClient).readyInstance(id)).id).toBe(id);
  });
  test('admin guard rejects ordinary and anonymous users',async()=>{
    let currentRole='user';const db={connection:{prepare:()=>({get:async()=>({role:currentRole})})}} as unknown as DatabaseService;
    const guard=new AdminGuard(db);const context=(role:string)=>({switchToHttp:()=>({getRequest:()=>({user:{id:'test',role}})})}) as ExecutionContext;
    await expect(guard.canActivate(context('admin'))).rejects.toThrow();currentRole='admin';await expect(guard.canActivate(context('user'))).resolves.toBe(true);
  });
  test('new KB uses default; old KB with no frozen managed binding retains remote configuration',async()=>{
    const db={connection:{prepare:()=>({get:async()=>({embedding_instance_id:null})})}} as unknown as DatabaseService;
    const services={defaultId:async()=>null} as ModelServicesService;
    const managed=new ManagedEmbeddingService(db,services,{} as AgentClient);
    expect(await managed.describe('f5736df0-4f77-4b34-9acf-0183beac0de0')).toBeNull();expect(await managed.initialBinding()).toEqual({id:null,spec:null});
  });
  test('managed provider checks fingerprint and dimensions before returning vectors',async()=>{
    const id='f5736df0-4f77-4b34-9acf-0183beac0de0';
    const instance={id,node_id:id,model_id:'bge-m3',fingerprint:'new',spec_json:JSON.stringify({dimensions:1024,revision:'r'})};
    const services={readyInstance:async()=>instance,node:async()=>({})} as unknown as ModelServicesService;
    const agent={request:async()=>({data:[{index:0,embedding:[1,2]}]})} as unknown as AgentClient;
    const managed=new ManagedEmbeddingService({} as DatabaseService,services,agent);
    const descriptor={endpoint:'managed://'+id,model:'bge-m3',dimensions:1024,revision:'r',fingerprint:'old'};
    await expect(managed.embed(['test'],descriptor)).rejects.toThrow(/space changed/);
    await expect(managed.embed(['test'],{...descriptor,fingerprint:'new'})).rejects.toThrow(/dimension/);
  });
});
