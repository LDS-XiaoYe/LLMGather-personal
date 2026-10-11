import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { seal, traceText } from '../workflows/runtime/persistence-codec';
import { AgentClient, validateAgentUrl } from './agent.client';
import { modelRegistry, validateConfig } from './model.registry';
import { AgentNode, AgentState, AgentTask, DeploymentConfig, InstanceRow, NodeRow, TaskRow } from './model.types';

export function managedId(id: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new BadRequestException('Invalid managed ID');
  return id;
}
const terminal = ['SUCCEEDED','FAILED','CANCELLED'];
@Injectable()
export class ModelServicesService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy=false;
  private readonly worker=randomUUID();
  constructor(private readonly database: DatabaseService, private readonly agent: AgentClient) {}
  private get db() { return this.database.connection; }
  onModuleInit() { this.timer=setInterval(()=>void this.tick().catch(()=>{}),2000);this.timer.unref(); }
  onModuleDestroy() { if(this.timer)clearInterval(this.timer); }
  async audit(actor: string, action: string, target: string, detail: unknown={}) {
    await this.db.prepare('INSERT INTO model_audit (actor_id,action,target_id,detail_json) VALUES (?,?,?,?)').run(actor,action,target,JSON.stringify(detail));
  }
  async node(id: string): Promise<NodeRow> {
    const row=await this.db.prepare('SELECT *, (last_seen>DATE_SUB(NOW(3),INTERVAL 45 SECOND)) AS fresh FROM model_nodes WHERE id=?').get(managedId(id));
    if(!row)throw new NotFoundException('Compute node not found');return row as unknown as NodeRow;
  }
  async registerNode(actor: string,input: {id:string;name:string;baseUrl:string;token:string}) {
    if(!input||Object.keys(input).some(k=>!['id','name','baseUrl','token'].includes(k)))throw new BadRequestException('Invalid node field');
    managedId(input.id);
    if(!input.name?.trim()||input.name.length>128||typeof input.token!=='string'||input.token.length<32||input.token.length>512)throw new BadRequestException('Invalid node identity or credential');
    try{validateAgentUrl(input.baseUrl);}catch(e){throw new BadRequestException((e as Error).message);}
    const node={id:input.id,name:input.name.trim(),base_url:input.baseUrl,token_cipher:seal(input.token)} as NodeRow;
    const probe=await this.agent.request<AgentNode>(node,'GET','/v1/node');
    if(probe.id!==input.id)throw new BadRequestException('Agent device identity mismatch');
    await this.db.prepare(`INSERT INTO model_nodes (id,name,base_url,token_cipher,status,hardware_json,last_seen) VALUES (?,?,?,?,'ONLINE',?,NOW(3))
      ON DUPLICATE KEY UPDATE name=VALUES(name),base_url=VALUES(base_url),token_cipher=VALUES(token_cipher),status='ONLINE',hardware_json=VALUES(hardware_json),last_seen=NOW(3)`)
      .run(node.id,node.name,node.base_url,node.token_cipher,JSON.stringify(probe.hardware));
    await this.audit(actor,'node.register',node.id,{name:node.name});return{id:node.id};
  }
  async snapshot() {
    const [nodes,instances,tasks]=await Promise.all([
      this.db.prepare('SELECT id,name,base_url AS baseUrl,status,hardware_json AS hardwareJson,last_seen AS lastSeen FROM model_nodes ORDER BY created_at').all(),
      this.db.prepare('SELECT * FROM model_instances ORDER BY updated_at DESC').all(),
      this.db.prepare('SELECT id,instance_id AS instanceId,node_id AS nodeId,status,phase,progress_json AS progressJson,error,updated_at AS updatedAt FROM model_tasks ORDER BY created_at DESC LIMIT 100').all(),
    ]);
    return{registry:modelRegistry,nodes:nodes.map(n=>({...n,hardware:JSON.parse(String(n.hardwareJson||'null')),hardwareJson:undefined})),
      instances:instances.map(i=>({...i,config:JSON.parse(String(i.config_json)),spec:JSON.parse(String(i.spec_json||'null'))})),
      tasks:tasks.map(t=>({...t,progress:JSON.parse(String(t.progressJson||'{}')),progressJson:undefined})),defaultInstanceId:await this.defaultId()};
  }
  async instance(id:string):Promise<InstanceRow>{
    const row=await this.db.prepare('SELECT * FROM model_instances WHERE id=?').get(managedId(id));
    if(!row)throw new NotFoundException('Managed model instance not found');return row as unknown as InstanceRow;
  }
  async dependencies(id:string) {
    return this.db.prepare('SELECT id,name,user_id AS userId FROM knowledge_bases WHERE embedding_instance_id=? AND deleted_at IS NULL').all(managedId(id));
  }
  async enqueue(actor:string,input:{taskId:string;instanceId:string;nodeId?:string;action:string;config?:DeploymentConfig;confirm?:boolean}) {
    if(!input||Object.keys(input).some(k=>!['taskId','instanceId','nodeId','action','config','confirm'].includes(k)))throw new BadRequestException('Invalid task field');
    if(input.action!=='deploy'&&input.config)throw new BadRequestException('Lifecycle operations do not accept model configuration');
    managedId(input.taskId);managedId(input.instanceId);
    if(!['deploy','start','stop','restart','remove','delete-cache'].includes(input.action))throw new BadRequestException('Invalid managed action');
    if(input.action==='deploy'){
      try{validateConfig(input.config!);}catch(e){throw new BadRequestException((e as Error).message);}
      managedId(input.nodeId!);
    }
    let instance:InstanceRow|undefined;
    try{instance=await this.instance(input.instanceId);}catch(e){if(!(e instanceof NotFoundException))throw e;}
    if(input.action!=='deploy'&&!instance)throw new NotFoundException('Managed model instance not found');
    const node=await this.node(instance?.node_id||input.nodeId!);
    const request={taskId:input.taskId,instanceId:input.instanceId,action:input.action,...(input.config?{config:input.config}:{})};
    const hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const prior=await this.db.prepare('SELECT id,request_hash FROM model_tasks WHERE id=?').get(input.taskId);
    if(prior){if(prior.request_hash!==hash)throw new ConflictException('Task idempotency payload mismatch');return{id:input.taskId,instanceId:input.instanceId};}
    if(node.status!=='ONLINE')throw new ConflictException('Compute node is offline');
    if(['stop','remove','delete-cache'].includes(input.action)){
      const impacts=await this.dependencies(input.instanceId);
      if(input.confirm!==true)throw new ConflictException({message:'Confirm destructive operation and affected knowledge bases',dependencies:impacts});
    }
    if(instance&&input.config&&JSON.stringify(JSON.parse(instance.config_json))!==JSON.stringify(input.config))throw new ConflictException('Instance model configuration is immutable; deploy a new instance and reindex');
    if(!instance) {
      try{await this.db.prepare(`INSERT INTO model_instances (id,node_id,model_id,config_json,desired_state,actual_state) VALUES (?,?,?,?,'RUNNING','PENDING')`)
        .run(input.instanceId,node.id,input.config!.modelId,JSON.stringify(input.config));}
      catch(e){if((e as {code?:string}).code!=='ER_DUP_ENTRY')throw e;}
    }
    const claimed=await this.db.prepare(`UPDATE model_instances SET operation_id=?,updated_at=NOW(3) WHERE id=? AND operation_id IS NULL`).run(input.taskId,input.instanceId);
    if(!claimed.changes)throw new ConflictException('Another model operation owns this instance');
    try{
      await this.db.prepare(`INSERT INTO model_tasks (id,instance_id,node_id,request_json,request_hash,status,phase,progress_json) VALUES (?,?,?,?,?,'PENDING','CHECKING_ENVIRONMENT','{}')`)
        .run(input.taskId,input.instanceId,node.id,JSON.stringify(request),hash);
      const desired=input.action==='stop'?'STOPPED':input.action==='remove'?'REMOVED':input.action==='delete-cache'?null:'RUNNING';
      if(desired)await this.db.prepare('UPDATE model_instances SET desired_state=?,provider_registered=0 WHERE id=? AND operation_id=?').run(desired,input.instanceId,input.taskId);
      await this.audit(actor,'model.'+input.action,input.instanceId,{taskId:input.taskId,dependencies:['stop','remove'].includes(input.action)?await this.dependencies(input.instanceId):[]});
      await this.event(input.taskId,{status:'PENDING',phase:'CHECKING_ENVIRONMENT'});
      return{id:input.taskId,instanceId:input.instanceId};
    }catch(e){await this.db.prepare('UPDATE model_instances SET operation_id=NULL WHERE id=? AND operation_id=?').run(input.instanceId,input.taskId);throw e;}
  }
  async event(taskId:string,payload:unknown){await this.db.prepare('INSERT INTO model_events (task_id,payload_json) VALUES (?,?)').run(taskId,JSON.stringify(payload));}
  async events(after:number) {
    return this.db.prepare(`SELECT id,task_id AS taskId,payload_json AS payloadJson FROM model_events WHERE id>? ORDER BY id LIMIT 200`).all(after);
  }
  async cancel(actor:string,id:string){
    const row=await this.db.prepare('SELECT id FROM model_tasks WHERE id=?').get(managedId(id));if(!row)throw new NotFoundException('Task not found');
    await this.db.prepare('UPDATE model_tasks SET cancel_requested=1 WHERE id=?').run(id);await this.audit(actor,'task.cancel',id);return{id};
  }
  async details(id:string,kind:'logs'|'metrics') {const i=await this.instance(id);return this.agent.request(await this.node(i.node_id),'GET',`/v1/instances/${i.id}/${kind}`);}
  async defaultId():Promise<string|null>{const row=await this.db.prepare("SELECT value FROM model_settings WHERE id='default_embedding'").get();return row?.value?String(row.value):null;}
  async setDefault(actor:string,id:string){await this.readyInstance(id);await this.db.prepare("INSERT INTO model_settings (id,value) VALUES ('default_embedding',?) ON DUPLICATE KEY UPDATE value=VALUES(value)").run(id);await this.audit(actor,'provider.default',id);return{id,appliesTo:'new-knowledge-bases-only'};}
  async readyInstance(id:string):Promise<InstanceRow>{const i=await this.instance(id);const n=await this.node(i.node_id);
    if(i.actual_state!=='RUNNING'||i.desired_state!=='RUNNING'||!i.provider_registered||n.status!=='ONLINE'||Number(n.fresh)!==1)
      throw new ConflictException('Embedding model service is stopped, unhealthy or node offline');return i;}
  async providers(){return this.db.prepare(`SELECT i.id,i.model_id AS modelId,i.fingerprint,i.spec_json AS specJson,n.name AS nodeName
    FROM model_instances i JOIN model_nodes n ON n.id=i.node_id WHERE i.provider_registered=1 AND i.actual_state='RUNNING' AND i.desired_state='RUNNING'
    AND n.status='ONLINE' AND n.last_seen>DATE_SUB(NOW(3),INTERVAL 45 SECOND)`).all();}
  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      // Recover a crash between reserving an instance and inserting its durable task.
      await this.db.prepare(`UPDATE model_instances i LEFT JOIN model_tasks t ON t.id=i.operation_id SET i.operation_id=NULL
        WHERE i.operation_id IS NOT NULL AND (t.status IN ('SUCCEEDED','FAILED','CANCELLED') OR (t.id IS NULL AND i.updated_at<DATE_SUB(NOW(3),INTERVAL 60 SECOND)))`).run();
      const nodes=await this.db.prepare('SELECT * FROM model_nodes').all();
      for(const row of nodes){const n=row as unknown as NodeRow;
        try {
          const info=await this.agent.request<AgentNode>(n,'GET','/v1/node');
          if(info.id!==n.id)throw new Error('Node identity mismatch');
          const state=await this.agent.request<AgentState>(n,'GET','/v1/state');
          await this.db.prepare("UPDATE model_nodes SET status='ONLINE',hardware_json=?,last_seen=NOW(3) WHERE id=?").run(JSON.stringify(info.hardware),n.id);
          await this.syncInstances(n,state);
          const tasks=await this.db.prepare("SELECT * FROM model_tasks WHERE node_id=? AND status IN ('PENDING','RUNNING') ORDER BY created_at LIMIT 10").all(n.id);
          for(const value of tasks)await this.work(n,value as unknown as TaskRow,state);
        }catch{
          await this.db.prepare("UPDATE model_nodes SET status='OFFLINE' WHERE id=?").run(n.id);
          await this.db.prepare("UPDATE model_instances SET actual_state='OFFLINE',provider_registered=0 WHERE node_id=? AND desired_state<>'REMOVED'").run(n.id);
        }
      }
    }finally{this.busy=false;}
  }
  private async syncInstances(node:NodeRow,state:AgentState){
    const rows=await this.db.prepare('SELECT * FROM model_instances WHERE node_id=?').all(node.id);
    for(const row of rows){const i=row as unknown as InstanceRow;const actual=state.instances[i.id];if(!actual)continue;
      if(actual.spec){const expected=createHash('sha256').update(JSON.stringify(actual.spec)).digest('hex');
        if(expected!==actual.fingerprint||actual.spec.modelId!==i.model_id||actual.spec.dimensions!==modelRegistry.models.find(m=>m.id===i.model_id)?.dimensions)throw new Error('Agent model identity mismatch');
        if(i.fingerprint&&i.fingerprint!==expected)throw new Error('Managed vector space changed unexpectedly');
      }
      // Only the task lease owner registers a provider after a live embedding probe. Reconciliation must not race desired state.
      await this.db.prepare("UPDATE model_instances SET actual_state=?,spec_json=COALESCE(NULLIF(?,''),spec_json),fingerprint=COALESCE(NULLIF(?,''),fingerprint),updated_at=NOW(3) WHERE id=?")
        .run(actual.actualState,actual.spec?JSON.stringify(actual.spec):null,actual.fingerprint||null,i.id);
      if(actual.actualState!=='RUNNING'||i.desired_state!=='RUNNING')await this.db.prepare('UPDATE model_instances SET provider_registered=0 WHERE id=?').run(i.id);
      else if(!i.operation_id&&!i.provider_registered&&actual.spec){try{await this.probeRegister(node,i.id,actual.spec.dimensions);}catch{await this.db.prepare("UPDATE model_instances SET actual_state='UNHEALTHY',provider_registered=0 WHERE id=?").run(i.id);}}
    }
  }
  private async probeRegister(node:NodeRow,id:string,dimensions:number){
    const i=await this.instance(id);
    const response=await this.agent.request<{data:{index:number;embedding:number[]}[]}>(node,'POST',`/v1/instances/${id}/embeddings`,{model:i.model_id,input:['健康检查']});
    if(response.data?.length!==1||response.data[0].embedding.length!==dimensions||!response.data[0].embedding.every(Number.isFinite)||!response.data[0].embedding.some(v=>v!==0))throw new Error('Embedding provider validation failed');
    await this.db.prepare("UPDATE model_instances SET provider_registered=1 WHERE id=? AND actual_state='RUNNING' AND desired_state='RUNNING'").run(id);
  }
  private async work(node:NodeRow,task:TaskRow,state:AgentState){
    const claim=await this.db.prepare(`UPDATE model_tasks SET owner=?,lease_until=DATE_ADD(NOW(3),INTERVAL 90 SECOND),status='RUNNING'
      WHERE id=? AND status IN ('PENDING','RUNNING') AND (owner IS NULL OR lease_until<NOW(3) OR owner=?)`).run(this.worker,task.id,this.worker);
    if(!claim.changes)return;
    try{
      let current=state.tasks[task.id];
      if(!current)current=await this.agent.request<AgentTask>(node,'POST','/v1/tasks',JSON.parse(task.request_json));
      if(task.cancel_requested&&!terminal.includes(current.status))current=await this.agent.request<AgentTask>(node,'POST',`/v1/tasks/${task.id}/cancel`,{});
      const previousProgress=JSON.parse(task.progress_json||'{}') as {historyCursor?:number};
      const historyCursor=previousProgress.historyCursor||0;
      for(const change of (current.history||[]).slice(historyCursor))if(change.phase!=='COMPLETED')await this.event(task.id,{...change,status:'RUNNING'});
      if(current.status==='SUCCEEDED'&&current.phase==='COMPLETED'){
        const instance=await this.instance(task.instance_id);
        if(instance.desired_state==='RUNNING'){
          await this.event(task.id,{status:'RUNNING',phase:'REGISTERING_PROVIDER'});
          if(!instance.spec_json||instance.actual_state!=='RUNNING')return;
          await this.probeRegister(node,instance.id,JSON.parse(instance.spec_json).dimensions as number);
        }
      }
      const progress=JSON.stringify({downloadedBytes:current.downloadedBytes,totalBytes:current.totalBytes,source:current.source,file:current.file,cached:current.cached,historyCursor:current.history?.length||0});
      if(task.status!==current.status||task.phase!==current.phase||task.progress_json!==progress)await this.event(task.id,{...current,error:current.error?traceText(current.error):undefined});
      const result=await this.db.prepare(`UPDATE model_tasks SET status=?,phase=?,progress_json=?,error=?,updated_at=NOW(3),owner=NULL,lease_until=NULL WHERE id=? AND owner=? AND lease_until>NOW(3)`)
        .run(current.status,current.phase,progress,traceText(current.error||''),task.id,this.worker);
      if(!result.changes)throw new Error('Deployment task lease lost');
      if(current.totalBytes)await this.db.prepare(`INSERT INTO model_downloads (task_id,instance_id,source,downloaded_bytes,total_bytes,phase,file_path)
        VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE source=VALUES(source),downloaded_bytes=VALUES(downloaded_bytes),total_bytes=VALUES(total_bytes),phase=VALUES(phase),file_path=VALUES(file_path),updated_at=NOW(3)`)
        .run(task.id,task.instance_id,current.source||'',current.downloadedBytes||0,current.totalBytes,current.phase,current.file||'');
    if(terminal.includes(current.status)){
      if(['FAILED','CANCELLED'].includes(current.status)&&!state.instances[task.instance_id])await this.db.prepare("UPDATE model_instances SET desired_state='STOPPED',actual_state=?,provider_registered=0 WHERE id=? AND operation_id=?").run(current.status,task.instance_id,task.id);
      if(['FAILED','CANCELLED'].includes(current.status)&&state.instances[task.instance_id]?.desiredState==='STOPPED')await this.db.prepare("UPDATE model_instances SET desired_state='STOPPED',provider_registered=0 WHERE id=? AND operation_id=?").run(task.instance_id,task.id);
      await this.db.prepare('UPDATE model_instances SET operation_id=NULL WHERE id=? AND operation_id=?').run(task.instance_id,task.id);
    }
    }catch(e){
      // Network failures remain durable/retryable; never invent a completed deployment.
      await this.db.prepare("UPDATE model_tasks SET owner=NULL,lease_until=NULL,error='Node operation interrupted; retrying with the same task ID' WHERE id=? AND owner=?").run(task.id,this.worker);
      throw e;
    }
  }
}
