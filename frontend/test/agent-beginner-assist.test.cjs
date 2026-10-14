const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('frontend/src/app/useAppController.ts','utf8'),tree=ts.createSourceFile('controller.ts',source,99,true),body=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useAppController').body;
const ref=value=>({value});
function fixture(overrides={}){
 const template={id:'general',name:'Template',prompt:'LOCAL TEMPLATE',description:'template description',example:'example',temperature:.7,maxTokens:1024,memoryEnabled:true,toolNames:[],skillNames:[]};
 const c={JSON,Map,Set,Array,Number,String,Error,AbortController,authUser:ref({id:'u'}),backendBaseUrl:ref('/v1'),isAuthenticated:ref(true),agentEditorEpoch:0,selectedAgentTemplateId:ref('general'),beginnerAssistTarget:ref(''),beginnerGeneratedDraftSource:ref(''),agentGenerating:ref(false),agentCreateWizardStep:ref(1),agentCreationGoal:ref(''),agentPrompt:ref(''),status:ref(''),selectedModel:ref('auto'),models:ref([{id:'model'}]),chatModels:ref([{id:'model'}]),agentForm:ref({id:'',name:'Draft',model:'model',systemPrompt:'original',toolIds:[],skillIds:[],knowledgeBaseIds:[]}),beginnerAgentForm:ref({audience:'同事',job:'整理会议行动项',tone:'简洁',success:'明确责任人',avoid:'不编造',sampleInput:'example'}),resolveAgentTemplate:()=>template,resolveToolIdsByNames:()=>[],resolveSkillIdsByNames:()=>[],knowledgeBases:ref([]),apiGenerateAgent:async()=>({name:'AI Draft',description:'AI description',systemPrompt:'REAL AI PROMPT',model:'model',toolIds:[],skillIds:[]}),...overrides};
 vm.createContext(c);
 for(const name of ['captureAgentEditorScope','agentAccountMatches','agentEditorMatches','beginnerDraftSourceKey','resolveBeginnerAssistModel','buildBeginnerRequirement','applyBeginnerFormToAgent','generateBeginnerAgentDraft','completeBeginnerAssist','improveBeginnerText','saveAgentFromWizard']){
  const fn=body.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);vm.runInContext(ts.transpileModule(fn.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 }
 return c;
}
test('whole AI prompt survives next/save application while unchanged, new brief intentionally rebuilds it',async()=>{
 const c=fixture();await c.generateBeginnerAgentDraft();assert.equal(c.agentForm.value.systemPrompt,'REAL AI PROMPT');c.applyBeginnerFormToAgent();assert.equal(c.agentForm.value.systemPrompt,'REAL AI PROMPT');
 c.agentForm.value.name='Custom name';c.beginnerAgentForm.value.sampleInput='new sample';c.applyBeginnerFormToAgent();assert.equal(c.agentForm.value.systemPrompt,'REAL AI PROMPT');
 c.beginnerAgentForm.value.job='new requirement';c.applyBeginnerFormToAgent();assert.match(c.agentForm.value.systemPrompt,/new requirement/);assert.equal(c.beginnerGeneratedDraftSource.value,'');
});
test('wizard save transmits the AI-generated prompt instead of reconstructing a template',async()=>{
 const c=fixture();let savedPrompt;c.persistAgent=async()=>{savedPrompt=c.agentForm.value.systemPrompt;return{id:'saved'};};
 await c.generateBeginnerAgentDraft();c.applyBeginnerFormToAgent();await c.saveAgentFromWizard(false);assert.equal(savedPrompt,'REAL AI PROMPT');
});
test('auto or removed model falls through to an available concrete chat model',()=>{
 const c=fixture();c.agentForm.value.model='auto';assert.equal(c.resolveBeginnerAssistModel(),'model');c.agentForm.value.model='removed';assert.equal(c.resolveBeginnerAssistModel(),'model');c.chatModels.value=[];assert.equal(c.resolveBeginnerAssistModel(),'');
});
test('failed generation leaves the original form intact and never pretends a rule template was AI output',async()=>{
 const c=fixture({apiGenerateAgent:async()=>{throw new Error('invalid JSON');}});const original=JSON.stringify(c.agentForm.value);await c.generateBeginnerAgentDraft();assert.equal(JSON.stringify(c.agentForm.value),original);assert.match(c.status.value,/AI 生成失败.*原有内容已保留/);assert.equal(c.agentGenerating.value,false);
});
test('changes to source fields during whole generation discard late results',async()=>{
 let resolve;const c=fixture({apiGenerateAgent:()=>new Promise(r=>resolve=r)});const pending=c.generateBeginnerAgentDraft();c.beginnerAgentForm.value.job='new typed brief';resolve({name:'old',systemPrompt:'old prompt'});await pending;assert.equal(c.agentForm.value.systemPrompt,'original');assert.match(c.status.value,/未应用/);
});
test('small field requests disable thinking/cache and accumulate only final content',async()=>{
 const c=fixture({streamCompletion:async(payload,handlers)=>{assert.equal(payload.extra_body.enable_thinking,false);assert.equal(payload.cache_enabled,false);assert.equal(payload.max_tokens,512);handlers.onChunk({choices:[{delta:{reasoning_content:'not form text',content:'填写结果'},finish_reason:'stop'}]});handlers.onDone();}});
 assert.equal(await c.completeBeginnerAssist('prompt','model'),'填写结果');
});
for(const mode of ['error','length','premature','empty'])test(`field fill ${mode} preserves user input and surfaces the failure`,async()=>{
 const c=fixture({streamCompletion:async(_,h)=>{h.onChunk({choices:[{delta:{content:mode==='empty'?'':'invalid partial'},finish_reason:mode==='premature'?null:mode==='empty'?'stop':mode}]});if(mode!=='premature')h.onDone();}});
 await c.improveBeginnerText('goal');assert.equal(c.beginnerAgentForm.value.job,'整理会议行动项');assert.match(c.status.value,/AI 补全失败.*原有内容已保留/);assert.equal(c.beginnerAssistTarget.value,'');
});
