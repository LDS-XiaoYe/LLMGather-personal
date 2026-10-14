import { AgentsService } from './agents.service';
import { ToolsService } from '../tools/tools.service';
import { SkillsService } from '../skills/skills.service';
import { McpService } from '../mcp/mcp.service';
import { AgentTeamsService } from '../agent-teams/agent-teams.service';
import { DatabaseService } from '../database/database.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import * as dns from 'dns/promises';

const form = (id = 'A'): any => ({ id, userId: 'u', name: id, description: '', model: 'model', systemPrompt: 'prompt', temperature: .2, maxTokens: 128, memoryEnabled: false, status: 'active', toolIds: [], skillIds: [], knowledgeBaseIds: [], workflowIds: [], subAgentIds: [] });
const tool = (extra = {}): any => ({ id: 'tool', userId: 'u', name: 'calculator', displayName: 'Calculator', enabled: true, permissionLevel: 'auto', implementationType: 'custom_code', code: 'return 1', riskLevel: 'low', ...extra });
function service(type: any, values: any) { return Object.assign(Object.create(type.prototype), values) as any; }
function database(rows: any = {}) {
 const log: any[] = [];
 const db: any = { now: () => '2026-10-13 12:00:00', log, connection: { prepare: (sql: string) => ({ run: async (...args: any[]) => { log.push({ sql, args }); return { changes: 1 }; }, get: async () => rows.get?.(sql) ?? {}, all: async () => rows.all?.(sql) ?? [] }) } };
 db.transaction = async (work: any) => { const checkpoint = log.length; try { return await work(db.connection); } catch (e) { log.splice(checkpoint); throw e; } };
 return db;
}

describe('Agent workbench regression: execution and configuration boundaries', () => {
 test.each(['pending', 'interrupted', 'cancelled', 'failed'])('A06 %s workflow never completes an Agent successfully or extracts memory', async status => {
  const db = database(); const memory = jest.fn();
  const s = service(AgentsService, { databaseService: db, resolveAgentConversationContext: async () => ({ conversationId: 'c', parentRunId: null, messages: [] }), runBoundWorkflowIfNeeded: async () => ({ status, output: '', error: status }), applySmartMemory: memory, getRun: async () => ({ status: 'failed' }) });
  await s.executeAgentRun('u', form(), { input: 'x' }, () => {});
  expect(db.log.find(x => x.sql.includes('SET status = ?')).args[0]).toBe('failed'); expect(memory).not.toHaveBeenCalled();
 });
 test.each(['confirm', 'disabled'])('A07 omitted permissions retain %s binding', async level => {
  const db = database({ all: () => [{ toolId: 'tool', permissionLevel: level }] });
  const s = service(ToolsService, { databaseService: db, getById: async () => tool() });
  await s.setAgentTools('u', 'A', ['tool']);
  expect(db.log.find(x => x.sql.includes('INSERT INTO agent_tools')).args[3]).toBe(level);
 });
 test('A07 explicit permission changes still apply', async () => { const db=database({ all:()=>[{toolId:'tool',permissionLevel:'disabled'}] });await service(ToolsService,{databaseService:db,getById:async()=>tool()}).setAgentTools('u','A',['tool'],{tool:'confirm'});expect(db.log[1].args[3]).toBe('confirm'); });
 test('A08 published versions use frozen Tool/Skill contents and empty snapshots do not pick up new bindings', async () => {
  const s = service(AgentsService, { toolsService: { getAgentTools: jest.fn(() => [tool({id:'new'})]) }, skillsService: { getAgentSkills: jest.fn(() => [{id:'new'}]) }, isCodeRunnerTool: () => false, effectiveToolRisk: () => 'low' });
  const agent = {...form(),runtimeBindings:{tools:[tool({code:'frozen code'})],skills:[{id:'old-skill',content:'frozen skill',enabled:true}]}};
  expect((await s.resolveRunnableTools('u', agent, [])).allowed[0].code).toBe('frozen code');expect((await s.resolveAgentSkills('u',agent))[0].content).toBe('frozen skill');
  agent.runtimeBindings={tools:[],skills:[]};expect((await s.resolveRunnableTools('u',agent,[])).allowed).toEqual([]);expect(await s.resolveAgentSkills('u',agent)).toEqual([]);
 });
 test('A08 frozen custom code is actually executed while live disabled/deleted tools remain revoked', async () => {
  const invokeDefinition=jest.fn(async (_u,t)=>({output:t.code})); const s=service(ToolsService,{resolveTool:async()=>tool({code:'new code'}),invokeDefinition});
  expect((await s.invokeSnapshot('u',tool({code:'version code'}),{})).output).toBe('version code');
  s.resolveTool=async()=>{throw Error('disabled')};await expect(s.invokeSnapshot('u',tool(),{})).rejects.toThrow('disabled');expect(invokeDefinition).toHaveBeenCalledTimes(1);
 });
 test('A09 invalid versions and conflicting slugs leave the old release untouched', async () => {
  for(const failure of ['version','slug']) {const db=database();const s=service(AgentsService,{databaseService:db,getById:async()=>form(),getVersionRow:async()=>{if(failure==='version')throw Error('missing');return{}},normalizeSlug:()=> 'slug',assertSlugAvailable:async()=>{if(failure==='slug')throw Error('conflict')}});await expect(s.publishVersion('u','A',{versionId:'v'})).rejects.toThrow();expect(db.log).toEqual([]);}
 });
 test('A10 canary publication requires a distinct stable release', async () => {const db=database({get:()=>undefined});db.connection.prepare=(sql:string)=>({get:async()=>undefined,run:async(...args:any[])=>db.log.push({sql,args})});const s=service(AgentsService,{databaseService:db,getById:async()=>form(),getVersionRow:async()=>({id:'v'}),normalizeSlug:()=> 'slug',assertSlugAvailable:async()=>{}});await expect(s.publishVersion('u','A',{versionId:'v',releaseMode:'canary'})).rejects.toThrow('稳定版本');expect(db.log).toEqual([]);});
 test('A10 all buckets route between stable and canary, never use the sole canary as a fallback',async()=> {const stable={id:'stable',status:'released'},canary={id:'canary',status:'canary',trafficPercent:10};const s=service(AgentsService,{databaseService:database({all:()=>[canary,stable]}),agentFromVersionSnapshot:(_:any,v:any)=>v});const counts={stable:0,canary:0};for(let i=0;i<100;i++){s.percentBucket=()=>i;counts[(await s.resolvePublishedRunnableAgent('u',form(),'x')).id as 'stable'|'canary']++}expect(counts).toEqual({stable:90,canary:10});s.databaseService=database({all:()=>[canary]});await expect(s.resolvePublishedRunnableAgent('u',form(),'x')).rejects.toThrow('稳定版本');});
 test('A11 public invocation strips owner conversation, approvals and private response fields', async () => {
  let captured:any;const s=service(AgentsService,{databaseService:database({get:()=>({id:'A',userId:'owner'})}),normalizeSlug:(x:string)=>x,getById:async()=>form(),resolvePublishedRunnableAgent:async(_:any,a:any)=>a,executeAgentRun:async(user:any,agent:any,dto:any,_emit:any,options:any)=>{captured={user,agent,dto,options};return {id:'private-run',userId:'owner',steps:[{input:'secret'}],status:'succeeded',output:'answer',latencyMs:8}}});
  const result=await s.runPublished('slug',{input:'hello',conversationId:'owner-c',parentRunId:'owner-run',continueFromLast:true,messages:[{role:'assistant',content:'private'}],approvedToolIds:['high-risk']});
  expect(captured.dto).toMatchObject({continueFromLast:false,approvedToolIds:[]});expect(captured.dto.conversationId).toBeUndefined();expect(captured.dto.messages).toBeUndefined();expect(captured.agent.memoryEnabled).toBe(false);expect(captured.options.publicInvocation).toBe(true);expect(result).toEqual({status:'succeeded',output:'answer',latencyMs:8});
 });
 test('A12 MCP test uses the real token while normal reads stay masked',async()=>{const s=service(McpService,{databaseService:database({get:()=>({configJson:JSON.stringify({token:'fixture-token-123'}),serverType:'notion',enabled:1})}),searchNotion:jest.fn(async server=>{expect(server.config.token).toBe('fixture-token-123');return[]}),updateStatus:async()=>{}});expect((await s.get('u','id')).config.token).not.toBe('fixture-token-123');expect((await s.test('u','id','query')).ok).toBe(true);});
 test('A17 rollback returns persisted publication flags, not the intermediate restored object',async()=>{const s=service(AgentsService,{databaseService:database(),restoreVersion:async()=>({...form(),published:false}),getById:async()=>({...form(),published:true,apiEnabled:true}),getVersionRow:async()=>({}),mapAgentVersion:(x:any)=>x});expect((await s.rollbackToVersion('u','A','v')).agent.published).toBe(true);});
 test('A18 own marketplace templates preserve workflow and child Agent bindings on install',async()=>{const db=database(),agent={...form(),workflowIds:['wf'],subAgentIds:['child']};const s=service(AgentsService,{databaseService:db,getById:async()=>agent,listMarketplaceTemplates:async()=>[{...agent,id:'template'}],toolsService:{listForUser:async()=>[]},skillsService:{listForUser:async()=>[]},create:jest.fn(async(_u,p)=>p)});const created=await s.createMarketplaceTemplate('u',{sourceAgentId:'A',name:'template'});expect(created.workflowIds).toEqual(['wf']);expect(created.subAgentIds).toEqual(['child']);const installed=await s.installMarketplaceTemplate('u',{templateId:'template',model:'model'});expect(installed.workflowIds).toEqual(['wf']);expect(installed.subAgentIds).toEqual(['child']);});
 test('A19 Team and test suite failures terminalize instead of leaving running records',async()=>{for(const kind of ['team','suite']){const db=database();const s=kind==='team'?service(AgentTeamsService,{databaseService:db,get:async()=>({id:'T',status:'active'}),buildAgentTeamGraph:()=>({invoke:async()=>{throw Error('archived')}}),getRun:async()=>({status:'failed'})}):service(AgentsService,{databaseService:db,getTestSuiteRow:async()=>({agentId:'A'}),listTestCases:async()=>[{id:'case',input:'x'}],run:async()=>{throw Error('archived')}});const result=kind==='team'?await s.run('u','T','x'):await s.runTestSuite('u','suite');expect(result.status).toBe('failed');expect(db.log.some(x=>x.sql.includes("status = 'failed'"))).toBe(true);}});
 test('A20 archived Agent API execution is rejected before runtime',async()=>{const execute=jest.fn();const s=service(AgentsService,{getById:async()=>({...form(),status:'archived',apiEnabled:true}),executeAgentRun:execute});await expect(s.runApi('u','A',{input:'x'})).rejects.toThrow('归档');expect(execute).not.toHaveBeenCalled();});
 test('A21 editing disabled Skills and Tools does not re-enable them',async()=>{for(const [type,position]of [[SkillsService,11],[ToolsService,12]]as const){const db=database(),current={...form(),...tool(),enabled:false,content:'skill',permissions:{},timeoutMs:1000};const s=service(type,{databaseService:db,getById:async()=>current,getOwnedCustomTool:async()=>current});await s.update('u','id',{description:'changed'});expect(db.log[0].args[position]).toBe(0);}});
 test('A22 invalid resources are checked before deletes and Agent create is atomic',async()=>{for(const [type,fn,api]of [[ToolsService,'setAgentTools','tool'],[SkillsService,'setAgentSkills','skill']]as const){const db=database(),s=service(type,{databaseService:db,getById:async()=>{throw Error('missing '+api)}});await expect(s[fn]('u','A',['missing'])).rejects.toThrow('missing');expect(db.log).toEqual([]);}const db=database(),s=service(AgentsService,{databaseService:db,assertRunnableModel:()=>{},toolsService:{setAgentTools:async()=>{throw Error('missing')}}});await expect(s.create('u',{name:'A',model:'model',toolIds:['missing']})).rejects.toThrow('missing');expect(db.log).toEqual([]);});
 test.each(['disabled','confirm'])('A23 parent %s tools cannot be bypassed by workflow adapters',async level=>{const invoke=jest.fn();const s=service(AgentsService,{getById:async()=>form(),toolsService:{getAgentTools:async()=>[tool({permissionLevel:level})],invoke},isCodeRunnerTool:()=>false,effectiveToolRisk:()=> 'low'});await expect(s.invokeWorkflowTool('u','tool',{}, {runtimeAgentId:'A'})).rejects.toThrow('未绑定');expect(invoke).not.toHaveBeenCalled();});
 test('A23 allowed workflow tools run through the frozen definition and public callers never grant approvals',async()=>{const s=service(AgentsService,{getById:async()=>form(),toolsService:{invokeSnapshot:jest.fn(async()=>({output:'frozen'}))},isCodeRunnerTool:()=>false,effectiveToolRisk:()=> 'low'});const snapshot={...form(),runtimeBindings:{tools:[tool({permissionLevel:'confirm'})],skills:[]}};await expect(s.invokeWorkflowTool('u','tool',{}, {runtimeAgentId:'A',runtimeAgentSnapshot:snapshot,approvedToolIds:['tool'],publicInvocation:true})).rejects.toThrow();expect((await s.invokeWorkflowTool('u','tool',{}, {runtimeAgentId:'A',runtimeAgentSnapshot:snapshot,approvedToolIds:['tool']})).output).toBe('frozen');});
 test('A25 actual LangGraph visits planning and reflection in reflective mode but skips planning in fast mode',async()=>{for(const mode of ['reflective','fast']){const visited:string[]=[];const s=service(AgentsService,{databaseService:database(),collectAgentContext:async()=>[],resolveRunnableTools:async()=>({allowed:[tool()],skipped:[]}),planNextAgentAction:async()=>{visited.push('plan');return{action:{action:visited.filter(x=>x==='plan').length===1?'tool':'final',toolId:'tool'},usage:{}}},addUsage:()=>{},plannerActionConfidence:()=>1,runGraphToolNode:async(_u:any,_a:any,_d:any,_r:any,state:any)=>({observations:['ok'],action:null}),reflectAgentProgress:()=>{visited.push('reflect');return{decision:'final'}},generateFinalAgentOutput:async()=>{visited.push('final');return'answer'}});const graph=s.buildAgentExecutionGraph('u',form(),{input:'x',mode},'r',{},()=>{},async()=>({}),async()=>({}),{});await graph.invoke({contextBlocks:[],tools:[],skippedTools:[],observations:[],action:null,reflection:null,finalOutput:'',round:0,maxSteps:3},{recursionLimit:30});expect(visited).toEqual(mode==='fast'?['final']:['plan','reflect','final']);}});
 test('A25 retry policy caps failure replanning and disables it explicitly',()=>{const s=service(AgentsService,{}),state={round:1,maxSteps:5,skippedTools:[],observations:['failed']};expect(s.reflectAgentProgress({retryPolicy:{maxRetries:0}},state).decision).toBe('final');expect(s.reflectAgentProgress({retryPolicy:{maxRetries:2,retryToolFailure:false}},state).decision).toBe('final');expect(s.reflectAgentProgress({retryPolicy:{maxRetries:2}},state).decision).toBe('retry');});
 test('A26 workflow HTTP uses the shared guarded adapter rather than unrestricted fetch',async()=>{const requestExternalHttp=jest.fn(async()=>({status:200,body:'ok'}));const s=service(WorkflowsService,{toolsService:{requestExternalHttp},interpolateText:(x:any)=>x,interpolateArgs:()=>({})});expect(JSON.parse(await s.runHttpNode({config:{url:'https://example.org'}},'x','x',{})).body).toBe('ok');expect(requestExternalHttp).toHaveBeenCalled();});
 test.each(['http://127.0.0.1/','http://169.254.169.254/','http://localhost/','http://[::1]/','http://example.org:3000/','http://user:pass@example.org/'])('A26 blocks unsafe HTTP URL %s before opening a connection',async url=>{const s=service(ToolsService,{});await expect(s.requestExternalHttp(url,{method:'GET',headers:{}})).rejects.toThrow();});
});

describe('request-local MySQL transactions',()=>{
 test('nested collaborating services share a connection, concurrent requests do not, and failures exit scope',async()=>{
  const db= new DatabaseService();const pool={prepare:()=> 'pool',exec:async()=>{}};const transactions:any[]=[];
  (db as any).adapter={...pool,transaction:async(work:any)=>{const label='tx-'+(transactions.length+1);const tx={prepare:()=>label,exec:async()=>{}};transactions.push(tx);return work(tx)}};
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const first=db.transaction(async()=>{expect(db.connection.prepare('x')).toBe('tx-1');await db.transaction(async()=>expect(db.connection.prepare('x')).toBe('tx-1'));await gate;expect(db.connection.prepare('x')).toBe('tx-1');});
  await db.transaction(async()=>{expect(db.connection).not.toBe(transactions[0]);expect(db.connection.prepare('x')).toBe('tx-2')});release();await first;expect(db.connection.prepare('x')).toBe('pool');expect(transactions).toHaveLength(2);
  await expect(db.transaction(async()=>{throw Error('rollback')})).rejects.toThrow('rollback');expect(db.connection.prepare('x')).toBe('pool');
 });
});


describe('bounded and pinned workflow HTTP transport', () => {
 afterEach(() => jest.restoreAllMocks());
 test.each(['success','redirect','oversize'])('A26 %s response uses validated DNS and applies transport bounds', async kind => {
  jest.spyOn(require('dns/promises'), 'lookup').mockResolvedValue([{address:'93.184.216.34',family:4}]);
  let transportOptions:any, lookupResult:any;
  const request = new EventEmitter() as any;
  request.setTimeout = jest.fn();
  request.destroy = (error:any) => request.emit('error',error);
  jest.spyOn(require('node:http'), 'request').mockImplementation(((_url:any,opts:any,callback:any) => {
    transportOptions=opts;opts.lookup('example.org',{all:true},(_err:any,value:any)=>lookupResult=value);
    request.end = () => { queueMicrotask(() => { const response=new EventEmitter() as any;response.statusCode=kind==='redirect'?302:200;response.destroy=jest.fn();callback(response); if(kind!=='redirect'){response.emit('data',Buffer.from(kind==='oversize'?'x'.repeat(65537):'answer'));if(kind!=='oversize')response.emit('end');} }); };
    return request;
  }) as any);
  const s=service(ToolsService,{});
  const result=s.requestExternalHttp('http://example.org/',{method:'GET',headers:{Host:'internal.local'}});
  if(kind==='success')expect(await result).toEqual({status:200,body:'answer'});else await expect(result).rejects.toThrow(kind==='redirect'?'重定向':'64 KiB');
  expect(lookupResult).toEqual([{address:'93.184.216.34',family:4}]);expect(transportOptions.headers.Host).toBeUndefined();expect(request.setTimeout).toHaveBeenCalledWith(15000,expect.any(Function));
 });
 test('A26 DNS resolving to private IP is rejected before request dispatch',async()=>{jest.spyOn(require('dns/promises'),'lookup').mockResolvedValue([{address:'10.0.0.1',family:4}]);const request=jest.spyOn(require('node:http'),'request');await expect(service(ToolsService,{}).requestExternalHttp('http://example.org/',{method:'GET',headers:{}})).rejects.toThrow('内网');expect(request).not.toHaveBeenCalled();});
});


describe('shared Agent operation entry points',()=>{
 test('A08/A09/A22 platform tools use the same transactional version and update services',async()=>{
   const agentApi={update:jest.fn(async()=>({id:'A'})),createVersion:jest.fn(async()=>({id:'v'})),publishVersion:jest.fn(async()=>({version:{id:'v'}}))};
   const s=service(ToolsService,{});s.registerAgentOperations(agentApi);
   await s.platformUpdateAgent('u','A',{description:'changed'});await s.platformCreateAgentVersion('u','A',{});await s.platformPublishAgentVersion('u','A',{versionId:'v'});
   expect(agentApi.update).toHaveBeenCalledWith('u','A',{description:'changed'});expect(agentApi.createVersion).toHaveBeenCalled();expect(agentApi.publishVersion).toHaveBeenCalledWith('u','A',{versionId:'v'});
 });
 test('A11 public calls do not use owner-connected integrations or custom code',async()=>{const s=service(AgentsService,{isCodeRunnerTool:()=>false,effectiveToolRisk:()=> 'low',toolsService:{getAgentTools:async()=>[tool({name:'notion_search',source:'builtin'}),tool({name:'private_custom',source:'custom'}),tool({name:'calculator',source:'builtin'})]}});expect((await s.resolveRunnableTools('u',form(),[],true)).allowed.map((t:any)=>t.name)).toEqual(['calculator']);});
 test('A19 Team member errors are returned as failed observations, retaining successful members',async()=>{const s=service(AgentTeamsService,{buildMemberInput:()=> 'x',agentsService:{run:async()=>{throw Error('archived')}}});expect(await s.runTeamMember('u',{id:'team'},{agentId:'child',role:'reviewer'},'x','',[])).toMatchObject({agentId:'child',role:'reviewer',status:'failed',error:'archived'});});
 test('A05 duplicate classifier names and empty-keyword defaults route by stable branch ID',async()=>{const {nextFor}=require('../workflows/runtime/workflow-runtime.service');const s=service(WorkflowsService,{});const node={id:'classifier',type:'question_classifier',config:{nextIds:['a','b'],branches:[{id:'first',name:'same',keyword:'order',nextIds:['a']},{id:'second',name:'same',keyword:'',nextIds:['b']}]}};const output=await s.runNode('u',node,'not matched','x',{});expect(nextFor(node,'not matched',output)).toEqual(['b']);const matched=await s.runNode('u',node,'ORDER query','x',{});expect(nextFor(node,'ORDER query',matched)).toEqual(['a']);});
});
