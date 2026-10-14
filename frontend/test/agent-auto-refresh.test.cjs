const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const ref=value=>({value});
function fixture(){
 let mounted,unmounted,watcher,interval,now=10_000;const listeners=new Map(),calls=[];
 const app={isAuthenticated:ref(true),authUser:ref({id:'user'}),backendBaseUrl:ref('/v1'),refreshAgentStudio:options=>calls.push(['agent',options]),loadModels:options=>calls.push(['models',options])};
 const vue={unref:v=>v&&typeof v==='object'&&'value'in v?v.value:v,onMounted:fn=>mounted=fn,onUnmounted:fn=>unmounted=fn,watch:(_,fn)=>watcher=fn};
 const events={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const context={exports:{},require:()=>vue,console,Date:{now:()=>now},document:{...events,visibilityState:'visible'},window:events,setInterval:(fn,ms)=>{assert.equal(ms,60_000);interval=fn;return 7;},clearInterval:id=>{assert.equal(id,7);interval=null;}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/composables/useAgentAutoRefresh.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 context.exports.useAgentAutoRefresh(app);
 return {app,context,calls,listeners,mount:()=>mounted(),unmount:()=>unmounted(),tick:()=>interval(),change:()=>watcher(),advance:()=>{now+=60_000;},interval:()=>interval};
}
test('Agent and model catalogues refresh on entry, interval and visible focus with throttling',()=>{
 const f=fixture();f.mount();assert.equal(f.calls.length,2);assert.equal(f.calls[0][1].background,true);assert.equal(f.calls[1][1].silent,true);
 f.listeners.get('focus')();assert.equal(f.calls.length,2);f.advance();f.tick();assert.equal(f.calls.length,4);
 f.context.document.visibilityState='hidden';f.advance();f.tick();assert.equal(f.calls.length,4);
 f.context.document.visibilityState='visible';f.listeners.get('visibilitychange')();assert.equal(f.calls.length,6);
 f.app.isAuthenticated.value=false;f.advance();f.tick();assert.equal(f.calls.length,6);
 f.app.isAuthenticated.value=true;f.app.authUser.value={id:'other'};f.change();assert.equal(f.calls.length,8);
 f.app.backendBaseUrl.value='/other';f.change();assert.equal(f.calls.length,10);
 f.unmount();assert.equal(f.interval(),null);assert.equal(f.listeners.size,0);f.change();assert.equal(f.calls.length,10);
});
test('busy Agent and model requests are skipped independently without starving the next refresh',()=>{
 const f=fixture();f.app.agentLoading=ref(true);f.mount();assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'models');
 f.app.agentLoading.value=false;f.listeners.get('focus')();assert.equal(f.calls.length,2);assert.equal(f.calls[1][0],'agent');
 f.app.agentRunning=ref(true);f.app.isLoadingModels=ref(true);f.advance();f.tick();assert.equal(f.calls.length,2);
 f.app.agentRunning.value=false;f.app.agentSaving=ref(true);f.app.isLoadingModels.value=false;f.tick();assert.equal(f.calls.length,3);assert.equal(f.calls[2][0],'models');
 f.app.agentSaving.value=false;f.tick();assert.equal(f.calls.length,4);assert.equal(f.calls[3][0],'agent');f.unmount();
});
test('refresh controls are absent and the Agent identity uses a real Element Plus card',()=>{
 const source=fs.readFileSync('frontend/src/components/app/pages/AgentModule.vue','utf8'),descriptor=parse(source).descriptor;
 assert.doesNotMatch(descriptor.template.content,/刷新 Agent|刷新模型/);assert.match(source,/useAgentAutoRefresh\(app\)/);assert.match(source,/<el-card class="agent-workspace-context" shadow="never">/);
 assert.deepEqual(compileTemplate({source:descriptor.template.content,id:'agent',filename:'AgentModule.vue'}).errors,[]);
});
