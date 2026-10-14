const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/useAppController.ts'),'utf8');
const parsed=ts.createSourceFile('controller.ts',source,ts.ScriptTarget.Latest,true);
const controller=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useAppController');
const submit=controller.body.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='submitPrompt');
const executable=ts.transpileModule('('+submit.getText(parsed)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

for(const model of ['test-model','auto'])for(const thinking of [true,false])for(const memoryUnavailable of [false,true]){
  test(`${model}: ${thinking?'thinking':'direct'} uses ordinary chat with memory (${memoryUnavailable?'unavailable':'available'}) without Agent mode`,async()=>{
    let sequence=0,lastMessages=[],streamCalls=0,fetchCalls=0,payload;
    const ref=value=>({value});
    const context={
      isComposing:ref(false),draft:ref('测试回复模式'),isSubmitting:ref(false),activeSession:ref({id:'test-session'}),
      selectedModel:ref(model),models:ref([{id:'test-model'}]),activeMessages:ref([]),status:ref(''),requestId:ref(''),
      // A legacy "on" state must not route a selected model to an Agent endpoint.
      chatAgentMode:ref(true),chatThinkingMode:ref(thinking),chatAbortController:null,backendBaseUrl:ref('/v1'),
      routerIntent:ref(''),routerSelectedModel:ref(''),routerReason:ref(''),routerDebug:ref(null),
      createId:prefix=>prefix+'-'+(++sequence),upsertActiveSession:messages=>{lastMessages=messages;},
      getStoredToken:()=>'',formatKeyRotationNotice:()=>'',triggerSync:()=>{},AbortController,TextDecoder,
      streamCompletion:async(body,handlers,base,signal)=>{
        streamCalls++;payload=body;assert.equal(base,'/v1');assert(!signal.aborted);
        if(memoryUnavailable)handlers.onMemoryWarning('长期记忆读取失败，本次未使用记忆');
        handlers.onChunk({choices:[{delta:{content:'测试回答',reasoning_content:'测试推理'}}]});handlers.onDone();
      },
      fetch:async(url,options)=>{
        fetchCalls++;assert.equal(url,'/v1/chat/completions');payload=JSON.parse(options.body);
        return new Response('data: '+JSON.stringify({choices:[{delta:{content:'测试回答'}}]})+'\n\ndata: [DONE]\n\n',{headers:{'x-memory-status':memoryUnavailable?'unavailable':'applied'}});
      },
    };
    const run=vm.runInNewContext(executable,context);await run();
    assert.equal(payload.model,model);assert.equal(payload.extra_body.enable_thinking,thinking);
    assert.equal(payload.memory_enabled,true);
    if(memoryUnavailable)assert.match(context.status.value,/长期记忆读取失败/);
    assert.deepEqual(Object.keys(payload.extra_body),['enable_thinking']);
    assert.equal(streamCalls,model==='auto'?0:1);assert.equal(fetchCalls,model==='auto'?1:0);
    assert.equal(lastMessages.at(-1).content,'测试回答');
    if(model!=='auto')assert.equal(lastMessages.at(-1).reasoning,thinking?'测试推理':'');
    assert.equal(context.isSubmitting.value,false);
  });
}
test('chat Agent preference is retired while thinking preference and independent Agent pages remain',()=>{
  assert(!/CHAT_AGENT_MODE_KEY|agentModeEnabledForRequest|chatAgentMode/.test(source));
  assert(source.includes("watch(chatThinkingMode, (value) => setStoredValue(CHAT_THINKING_KEY, value ? 'on' : 'off'))"));
  const chat=fs.readFileSync(path.join(__dirname,'../src/components/app/pages/ChatModule.vue'),'utf8');
  assert(!/agent-mode-toggle|thinking-toggle-thumb|chatAgentMode/.test(chat));
  assert(chat.includes('aria-label="回答模式"'));assert(chat.includes(':disabled="isSubmitting"'));
  assert(fs.readFileSync(path.join(__dirname,'../src/components/app/AppShell.vue'),'utf8').includes("pageMode === 'agent'"));
});
