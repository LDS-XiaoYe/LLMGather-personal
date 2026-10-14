const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const {test}=require('node:test');
const moduleBox={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/utils/agent-trace.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleBox,exports:moduleBox.exports});
const helpers=moduleBox.exports;
const source=fs.readFileSync('frontend/src/app/useAppController.ts','utf8');
const tree=ts.createSourceFile('controller.ts',source,ts.ScriptTarget.Latest,true);
const body=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useAppController').body;
const functions=body.statements.filter(ts.isFunctionDeclaration);
const declarations=body.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations);
const ref=value=>({value});
function build(overrides={}){const notifications=[];const c={notifications,ElMessage:Object.fromEntries(["info","success","warning","error"].map(type=>[type,text=>notifications.push({type,text})])),...helpers,agentHistoryGeneration:0,agentExecutionGeneration:0,agentRunAbortController:null,authUser:ref({id:'user'}),executingAgentRun:ref(null),agentComparisonRunId:ref(''),agentTraceFollowLive:ref(false),agentContinueConversation:ref(true),agentRunning:ref(false),agentImageUrlInput:ref(''),isComposing:ref(false),agentLastPrompt:ref(''),agentStepTypeLabel:x=>x,console,Date,Math,Number,Boolean,String,JSON,Error,Set,Map,Array,Promise,computed:fn=>({get value(){return fn();}}),activeAgentRun:ref(null),agentRuns:ref([]),agentForm:ref({id:'agent-B',systemPrompt:'current saved prompt',model:'current-model',temperature:.7,maxTokens:2048,skillIds:['skill-current']}),activeAgentId:ref('agent-B'),activeAgentTraceStepId:ref(null),agentTraceReplayIndex:ref(0),agentTraceReplayPlaying:ref(false),agentInvokeMaxSteps:ref(6),agentPrompt:ref(''),agentInvokePanelTab:ref('trace'),agentConversationId:ref(''),status:ref(''),availableSkills:ref([{id:'skill-current',name:'Current Skill'}]),billingLedger:ref([]),isAuthenticated:ref(true),backendBaseUrl:ref('/v1'),traceStageDefinitions:[{id:'input',label:'用户输入',types:['user_input']},{id:'context',label:'上下文',types:['context_pack','rag_retrieval','skill_context']},{id:'llm',label:'LLM',types:['plan','reflection','llm_completion']},{id:'tool',label:'工具',types:['tool_call','observation']},{id:'final',label:'最终输出',types:['final']}],...overrides};vm.createContext(c);const names=['isFinalAnswerStep','sortAgentRunSteps','stepMatchesTypes','formatTraceSummary','formatMemoryTraceOutput','selectAgentTraceStep','setAgentTraceReplayIndex','pauseAgentTraceReplay','resumeAgentTraceReplay','stepIntoAgentTrace','stepOverAgentTrace','restartAgentFromTraceNode','applyAgentRunStreamEvent','loadAgentRuns','buildAgentRunPayload','rerunLastAgentPrompt','copyActiveAgentOutput','selectAgentRun','runCurrentAgent','followAgentLiveTrace'];for(const name of names){const fn=functions.find(n=>n.name?.text===name);assert.ok(fn,name);vm.runInContext(ts.transpileModule(fn.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);}for(const name of ['activeAgentTraceStep','agentTraceReplayMax','agentTraceSnapshot','agentComparativeReplay','activeAgentToolResultCards','agentFailedTraceSteps','agentContextSourceSummary','agentHarnessMetrics','agentExecutionTraceFlow']){const n=declarations.find(n=>n.name.getText(tree)===name);c[name]=vm.runInContext(ts.transpileModule('('+n.initializer.getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);}return c;}
function step(id,runId,type,output='',extra={}){return{id,runId,stepType:type,name:type,status:'succeeded',input:'original task',output,error:'',latencyMs:1,metadata:'',startedAt:'2026-10-13 01:00:00',...extra};}
function run(id,steps=[],extra={}){return{id,agentId:'agent-B',conversationId:'conversation-'+id,input:'input-'+id,output:'final-'+id,model:'historical-model',status:'succeeded',totalTokens:10,latencyMs:100,steps,...extra};}
test('SSE events only update their executing Run; other history stays selected',()=>{
 const c=build();c.executingAgentRun.value=run('A');c.activeAgentRun.value=run('B');
 c.applyAgentRunStreamEvent({type:'step_completed',step:step(1,'A','tool_call')});
 assert.equal(c.activeAgentRun.value.id,'B');assert.equal(c.activeAgentRun.value.steps.length,0);
 assert.equal(c.executingAgentRun.value.steps[0].runId,'A');
 c.applyAgentRunStreamEvent({type:'llm_delta',runId:'A',output:'late A'});assert.equal(c.activeAgentRun.value.output,'final-B');
 c.applyAgentRunStreamEvent({type:'run_completed',run:run('A')});assert.equal(c.activeAgentRun.value.id,'B');
});
test('foreign run and Agent stream events are discarded',()=>{
 const c=build();c.executingAgentRun.value=run('A');
 c.applyAgentRunStreamEvent({type:'step_completed',step:step(1,'X','tool_call')});assert.equal(c.executingAgentRun.value.steps.length,0);
 c.applyAgentRunStreamEvent({type:'run_created',run:run('X',[],{agentId:'foreign'})});assert.equal(c.executingAgentRun.value.id,'A');
});
test('history request generations reject out of order, session and host responses',async()=>{
 const pending=[];const c=build({fetchAgentRuns:id=>new Promise(resolve=>pending.push({id,resolve}))});
 c.activeAgentId.value='A';const a=c.loadAgentRuns('A');c.activeAgentId.value='B';const b=c.loadAgentRuns('B');
 pending[1].resolve([run('B',[],{agentId:'B'})]);await b;pending[0].resolve([run('A',[],{agentId:'A'})]);await a;
 assert.equal(c.activeAgentRun.value.agentId,'B');
 const third=c.loadAgentRuns('B');c.authUser.value={id:'other'};pending[2].resolve([run('stale',[],{agentId:'B'})]);await third;assert.equal(c.activeAgentRun.value,null);
});
test('recorded snapshots do not read drafts or future memory writes',()=>{
 const c=build();c.activeAgentRun.value=run('old',[step(1,'old','context_pack'),step(2,'old','memory_write','future')]);
 c.activeAgentTraceStepId.value=1;c.agentForm.value.systemPrompt='UNSAVED';
 assert.equal(c.agentTraceSnapshot.value.prompt,'未记录');assert.equal(c.agentTraceSnapshot.value.messages,null);assert.equal(c.agentTraceSnapshot.value.memoryState.length,0);
 c.activeAgentRun.value.steps[0].metadata=JSON.stringify({runtimeSnapshot:{systemPrompt:'recorded',parameters:{temperature:.2}}});
 assert.equal(c.agentTraceSnapshot.value.prompt,'recorded');assert.equal(c.agentTraceSnapshot.value.parameters.temperature,.2);
});
test('model request snapshot uses actual selected step messages',()=>{
 const r=run('new',[step(1,'new','llm_completion','answer',{metadata:JSON.stringify({requestSnapshot:{model:'actual',messages:[{role:'system',content:'actual system'}],temperature:.1,max_tokens:88}})})]);
 const snapshot=helpers.traceSnapshot(r,r.steps[0]);assert.equal(snapshot.messages[0].role,'system');assert.equal(snapshot.model,'actual');assert.equal(snapshot.parameters.maxTokens,88);
});
test('comparison requires explicitly selected same-Agent run; missing history stays unknown',()=>{
 const c=build();c.activeAgentRun.value=run('current');c.agentRuns.value=[run('other'),run('foreign',[],{agentId:'X'})];
 assert.equal(c.agentComparativeReplay.value.baseline,null);c.agentComparisonRunId.value='foreign';assert.equal(c.agentComparativeReplay.value.baseline,null);
 c.agentComparisonRunId.value='other';assert.equal(c.agentComparativeReplay.value.promptDiff.before,'未记录');assert.equal(c.agentComparativeReplay.value.skillDiff.after,'未记录');assert.equal(c.agentComparativeReplay.value.inputDiff.before,'input-other');
});
test('legacy aggregate tool failures surface in tool cards and failed steps',()=>{
 const c=build();c.activeAgentRun.value=run('legacy',[step(1,'legacy','tool_calling',JSON.stringify([{toolName:'Notion',input:{query:'x'},status:'failed',error:'missing config'}]))]);
 assert.equal(c.agentFailedTraceSteps.value.length,1);assert.equal(c.activeAgentToolResultCards.value[0].status,'failed');assert.equal(c.activeAgentToolResultCards.value[0].output,'missing config');
});
test('sources support legacy counts without inventing zero; explicit empty is zero',()=>{
 const c=build();c.activeAgentRun.value=run('old',[step(1,'old','rag_retrieval',JSON.stringify([{id:1},{id:2},{id:3}])),step(2,'old','skill_context','',{metadata:'{"count":4}'})]);
 assert.equal(c.agentContextSourceSummary.value.knowledge,3);assert.equal(c.agentContextSourceSummary.value.skill,4);assert.equal(c.agentContextSourceSummary.value.memory,null);
 c.activeAgentRun.value.steps.push(step(3,'old','memory_retrieval','[]',{metadata:'{"contextSources":[]}'}));assert.equal(c.agentContextSourceSummary.value.memory,0);
});
test('per-run metrics never show account-wide billing as run cost',()=>{
 const c=build();c.activeAgentRun.value=run('selected',[],{latencyMs:50,totalTokens:7});c.agentRuns.value=[run('other',[],{latencyMs:1000})];c.billingLedger.value=[{requestType:'agent',cost:999}];
 assert.equal(c.agentHarnessMetrics.value.latency,50);assert.equal(c.agentHarnessMetrics.value.tokens,7);assert.equal(c.agentHarnessMetrics.value.cost,undefined);assert.equal(c.agentHarnessMetrics.value.sampleCount,1);
});
test('payload captures selected historical parent, fresh rerun has no conversation',()=>{
 const c=build();c.activeAgentRun.value=run('old');c.agentRuns.value=[run('latest')];c.agentConversationId.value='conversation-old';
 let payload=c.buildAgentRunPayload('task',[]);assert.equal(payload.parentRunId,'old');assert.equal(payload.conversationId,'conversation-old');
 c.agentContinueConversation.value=false;payload=c.buildAgentRunPayload('task',[]);assert.equal(payload.continueFromLast,false);assert.equal(payload.parentRunId,undefined);assert.equal(payload.conversationId,undefined);
 c.agentContinueConversation.value=true;c.activeAgentRun.value=null;payload=c.buildAgentRunPayload('new',[]);assert.equal(payload.continueFromLast,false);assert.equal(payload.parentRunId,undefined);
});
test('rerun fills selected task only, resets images and never auto-executes',()=>{
 const c=build({agentLastPrompt:ref('wrong task A')});c.activeAgentRun.value=run('B',[],{input:'selected task B'});c.agentImageUrlInput.value='old-image';
 c.rerunLastAgentPrompt();assert.equal(c.agentPrompt.value,'selected task B');assert.equal(c.agentImageUrlInput.value,'');assert.equal(c.agentContinueConversation.value,false);assert.equal(c.agentRunning.value,false);
});
test('paused browsing is not moved by live step events; follow button restores latest',()=>{
 const c=build();const r=run('live',[step(1,'live','context_pack'),step(2,'live','tool_call')],{status:'running'});c.activeAgentRun.value=r;c.executingAgentRun.value=r;
 c.selectAgentTraceStep(1);c.applyAgentRunStreamEvent({type:'step_completed',step:step(2,'live','tool_call')});assert.equal(c.activeAgentTraceStepId.value,1);
 c.followAgentLiveTrace();assert.equal(c.activeAgentTraceStepId.value,2);assert.equal(c.agentTraceFollowLive.value,true);
});
test('timeline preserves retries and final LLM as actual chronological steps',()=>{
 const c=build();c.activeAgentRun.value=run('loop',[step(1,'loop','tool_call','',{status:'failed',error:'first failure'}),step(2,'loop','reflection'),step(3,'loop','tool_call'),step(4,'loop','llm_completion','answer',{name:'最终回答'})]);
 const nodes=c.agentExecutionTraceFlow.value;assert.equal(nodes.length,4);assert.equal(nodes[0].status,'failed');assert.equal(nodes[3].step.stepType,'llm_completion');assert.equal(nodes[3].status,'succeeded');
});
test('previous/next have bounded cursor and fill-step explicitly prepares a new task',()=>{
 const c=build();c.activeAgentRun.value=run('two',[step(1,'two','context_pack'),step(2,'two','llm_completion','',{input:'{"round":1}'})]);
 c.stepIntoAgentTrace();assert.equal(c.agentTraceReplayIndex.value,0);c.stepOverAgentTrace();c.stepOverAgentTrace();assert.equal(c.agentTraceReplayIndex.value,1);
 c.restartAgentFromTraceNode();assert.equal(c.agentPrompt.value,'{"round":1}');assert.match(c.status.value,/不是节点恢复/);assert.equal(c.agentContinueConversation.value,false);
});
test('IME composition never executes an Agent',async()=>{
 const c=build();c.agentPrompt.value='中文';c.isComposing.value=true;await c.runCurrentAgent();assert.equal(c.agentRunning.value,false);
 c.isComposing.value=false;await c.runCurrentAgent({isComposing:true});assert.equal(c.agentRunning.value,false);
});
test('run payload is built before clearing selection, callbacks are session scoped',async()=>{
 let sent;const c=build({AbortController,activeAgent:ref({id:'agent-B'}),confirmToolExecutionIfNeeded:async()=>[],streamAgentRun:async(id,payload,callbacks)=>{sent=payload;callbacks.onEvent({type:'run_created',run:run('created')});callbacks.onEvent({type:'run_completed',run:run('created')});callbacks.onDone();},fetchMe:async()=>({id:'user'}),fetchBillingLedger:async()=>[],fetchAgentRuns:async()=>[run('created')]});
 c.activeAgentRun.value=run('old');c.agentConversationId.value='conversation-old';c.agentPrompt.value='task';await c.runCurrentAgent();
 assert.equal(sent.parentRunId,'old');assert.equal(c.agentRunning.value,false);assert.equal(c.activeAgentRun.value.id,'created');assert.equal(c.agentPrompt.value,'');
});
test('Vue templates compile and controls use honest accessible semantics',()=>{
 const {parse,compileTemplate}=require('@vue/compiler-sfc');
 for(const file of ['frontend/src/components/agent/AgentRunTrace.vue','frontend/src/components/app/pages/AgentModule.vue']){const source=fs.readFileSync(file,'utf8'),parsed=parse(source);assert.equal(parsed.errors.length,0);assert.equal(compileTemplate({source:parsed.descriptor.template.content,id:'test',filename:file}).errors.length,0);}
 const view=fs.readFileSync('frontend/src/components/agent/AgentRunTrace.vue','utf8');assert.match(view,/aria-current/);assert.match(view,/aria-live/);assert.match(view,/选择另一条运行记录/);assert.doesNotMatch(view,/从当前步骤重启|跳过步骤|进入步骤/);
 const module=fs.readFileSync('frontend/src/components/app/pages/AgentModule.vue','utf8');assert.match(module,/@keydown.ctrl.enter/);assert.doesNotMatch(module,/@keydown.enter.exact/);assert.match(module,/过程与历史/);
});
test('trace formatter never loses valid JSON or escaped Unicode',()=>{
 assert.match(helpers.formatTraceDisplayValue('{"systemPrompt":true,"model":"bge-m3"}'),/bge-m3/);
 assert.equal(helpers.formatTraceDisplayValue('"\\u4f60\\u597d"'),'你好');
 assert.equal(helpers.formatTraceDisplayValue('plain\\ntext'),'plain\ntext');
});
const snapshotBox={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('backend/src/agents/trace-snapshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{Buffer,module:snapshotBox,exports:snapshotBox.exports});
const {captureAgentTraceSnapshot}=snapshotBox.exports;
const serviceTree=ts.createSourceFile('service.ts',fs.readFileSync('backend/src/agents/agents.service.ts','utf8'),ts.ScriptTarget.Latest,true);
const serviceClass=serviceTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='AgentsService');
function serviceMethod(name){const method=serviceClass.members.find(n=>n.name?.getText(serviceTree)===name);const js=ts.transpileModule('class Harness {'+method.getText(serviceTree)+'}\nHarness.prototype.'+name,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return vm.runInNewContext(js,{Date,JSON,Math,captureAgentTraceSnapshot});}
test('backend stores immutable redacted runtime config with no database schema change',async()=>{
 const emitted=[];const agent={systemPrompt:'secret original',model:'model-a',temperature:.2,maxTokens:128,skillIds:['one'],workflowIds:['workflow'],knowledgeBaseIds:[],memoryEnabled:false};
 const ctx={databaseService:{now:()=> '2026-10-13'},redactSensitiveText:v=>v.replace('secret','[redacted]'),maxCompletionTokens:a=>a.maxTokens};
 await serviceMethod('collectAgentContext').call(ctx,'user',agent,{input:'task',contextStrategy:'minimal',maxSteps:25,imageUrls:[]},'run',{},async step=>{emitted.push(step);return step;});
 const config=JSON.parse(emitted[0].metadata).runtimeSnapshot;agent.systemPrompt='changed';agent.skillIds.push('new');
 assert.equal(config.systemPrompt,'[redacted] original');assert.equal(config.skillIds.length,1);assert.equal(config.parameters.maxSteps,10);assert.equal(config.workflow[0],'workflow');
});
test('backend completion metadata merges rather than dropping captured request',async()=>{
 let declaration;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(serviceTree)==='completeAndEmit') declaration??=n;ts.forEachChild(n,walk);}walk(serviceClass);
 let metadata;const context={userId:'user',runId:'run',emit:()=>{}};vm.createContext(context);
 const fn=vm.runInContext(ts.transpileModule('function wrapper(){return '+declaration.initializer.getText(serviceTree)+';} wrapper',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const service={databaseService:{now:()=> '2026-10-13',connection:{prepare:()=>({run:async(...args)=>{metadata=JSON.parse(args[5]);}})}},getStep:async()=>({startedAt:'2026-10-13',metadata:JSON.stringify({requestSnapshot:{messages:[{role:'system',content:'stored'}]},round:1})}),parseJsonRecord:JSON.parse};
 await fn.call(service)(1,'succeeded','answer','',{usage:{total_tokens:5}});assert.equal(metadata.requestSnapshot.messages[0].content,'stored');assert.equal(metadata.round,1);assert.equal(metadata.usage.total_tokens,5);
});
test('request snapshots are byte bounded and preserve valid JSON during redaction',()=>{
 const clean=captureAgentTraceSnapshot({model:'m',messages:[{content:'token: abc" with quotes'}],authorization:'secret'},s=>s.replace(/token: \S+/g,'token: [redacted]'));
 assert.equal(JSON.parse(JSON.stringify(clean)).messages.length,1);assert.equal(clean.authorization,'[已脱敏]');
 const large=captureAgentTraceSnapshot({model:'m',messages:[{content:'中文'.repeat(20000)}]},s=>s);
 assert.ok(Buffer.byteLength(JSON.stringify(large))<32000);assert.equal(large.messages,undefined);assert.ok(large.omitted);
});


test('tool payload formatting retains diagnostics, exit code, logs and false/zero results',()=>{
 const payload={result:{value:0},stdout:'line one\nline two',stderr:'failed stderr',logs:['warning'],exitCode:1};
 const displayed=helpers.formatTraceDisplayValue(JSON.stringify(payload));
 assert.deepEqual(JSON.parse(displayed),payload);
 const c=build();c.activeAgentRun.value=run('tools',[step(1,'tools','tool_calling',JSON.stringify([{toolName:'zero',status:'failed',output:0,error:'explicit error'},{toolName:'false',status:'succeeded',output:false}]))]);
 const cards=c.activeAgentToolResultCards.value;assert.equal(cards[0].output,0);assert.equal(cards[0].error,'explicit error');assert.equal(cards[0].latencyMs,null);assert.equal(cards[1].output,false);
});

test('copy output gives feedback on every click and reports clipboard failures',async()=>{
 const copied=[];const c=build({navigator:{clipboard:{writeText:async text=>copied.push(text)}}});c.activeAgentRun.value=run('copy');
 await c.copyActiveAgentOutput();await c.copyActiveAgentOutput();assert.deepEqual(copied,['final-copy','final-copy']);assert.equal(c.notifications.length,2);assert.equal(c.notifications[1].type,'success');
 c.navigator.clipboard.writeText=async()=>{throw Error('clipboard denied');};await c.copyActiveAgentOutput();assert.equal(c.notifications[2].type,'error');
});

test('prepared reruns and step input report that they have not executed',()=>{
 const c=build();c.activeAgentRun.value=run('prepare',[step(1,'prepare','context_pack')]);c.rerunLastAgentPrompt();assert.match(c.notifications[0].text,/新会话/);c.selectAgentTraceStep(1);c.restartAgentFromTraceNode();assert.match(c.notifications[1].text,/不是节点恢复/);assert.equal(c.agentRunning.value,false);
 const view=fs.readFileSync('frontend/src/components/app/pages/AgentModule.vue','utf8');assert.doesNotMatch(view,/本次运行最终输出/);assert.match(view,/所选运行.*生成中/);assert.match(view,/toolResult.error/);
});


test('disconnect and incomplete stream notify without claiming cancellation or success',async()=>{
 for(const event of ['onAbort','onDone']) {
  const c=build({AbortController,activeAgent:ref({id:'agent-B'}),confirmToolExecutionIfNeeded:async()=>[],streamAgentRun:async(id,payload,callbacks)=>{callbacks.onEvent({type:'run_created',run:run('open',[],{status:'running'})});callbacks[event]();},fetchMe:async()=>({id:'user'}),fetchBillingLedger:async()=>[],fetchAgentRuns:async()=>[run('open',[],{status:'running'})]});
  c.agentPrompt.value='task';await c.runCurrentAgent();assert.equal(c.notifications.length,1);assert.equal(c.notifications[0].type,'warning');assert.match(c.notifications[0].text,event==='onAbort'?/后台任务可能仍在执行/:/尚未收到任务结束状态/);assert.equal(c.executingAgentRun.value.status,'running');
 }
});
