const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const ref=value=>({value});
const source=fs.readFileSync('frontend/src/app/useAppController.ts','utf8');
const tree=ts.createSourceFile('controller.ts',source,ts.ScriptTarget.Latest,true);
const body=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useAppController').body;
const fn=body.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='loadModels');
function controller(overrides={}) {
 const calls=[];
 const c={modelListGeneration:0,modelListOwner:'',modelListRequest:null,isAuthenticated:ref(true),authUser:ref({id:'user'}),backendBaseUrl:ref('/v1'),isLoadingModels:ref(false),isSubmitting:ref(false),modelRefreshError:ref(''),models:ref([]),selectedModel:ref('auto'),pageModelsConfig:ref({}),status:ref('existing status'),Error,Promise,ApiError:class ApiError extends Error{constructor(msg,status){super(msg);this.status=status;}},fetchModels:async()=>[{id:'a'},{id:'b'}],fetchPageModels:async()=>({page_models_chat:'a,b'}),restoreSelectedModel:()=>calls.push('chat'),restoreMmModel:()=>calls.push('mm'),restoreTtsModel:()=>calls.push('tts'),restoreVisionModel:()=>calls.push('vision'),clearStoredToken:()=>calls.push('clear-token'),calls,...overrides};
 Object.defineProperty(c,'chatModels',{get:()=>({value:c.models.value.filter(m=>!(c.pageModelsConfig.value.page_models_chat||'').includes('exclude:'+m.id))})});
 vm.createContext(c);vm.runInContext(ts.transpileModule(fn.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);return c;
}
test('automatic refresh coalesces requests, updates catalogue/config and leaves status alone',async()=>{
 let resolve,requests=0;const c=controller({fetchModels:()=>{requests++;return new Promise(done=>resolve=done);}});
 const a=c.loadModels({silent:true}),b=c.loadModels({silent:true});assert.equal(requests,1);assert.equal(c.isLoadingModels.value,true);resolve([{id:'new'}]);await Promise.all([a,b]);
 assert.equal(c.models.value[0].id,'new');assert.equal(c.pageModelsConfig.value.page_models_chat,'a,b');assert.equal(c.status.value,'existing status');assert.equal(c.isLoadingModels.value,false);
});
test('refresh preserves a valid user selection and does not reset other workspaces',async()=>{
 const c=controller();await c.loadModels({silent:true});c.selectedModel.value='b';await c.loadModels({silent:true});assert.equal(c.selectedModel.value,'b');assert.deepEqual(c.calls,['chat','mm','tts','vision']);
 c.selectedModel.value='removed';await c.loadModels({silent:true});assert.equal(c.selectedModel.value,'a');
 c.selectedModel.value='auto';await c.loadModels({silent:true});assert.equal(c.selectedModel.value,'auto');
 c.selectedModel.value='removed';c.isSubmitting.value=true;await c.loadModels({silent:true});assert.equal(c.selectedModel.value,'removed');
});
test('transient failures preserve usable models and do not log out for upstream Key errors',async()=>{
 const c=controller();await c.loadModels({silent:true});c.selectedModel.value='b';c.fetchModels=async()=>{throw Error('upstream API Key missing');};await c.loadModels({silent:true});
 assert.equal(c.models.value.length,2);assert.equal(c.selectedModel.value,'b');assert.equal(c.authUser.value.id,'user');assert.equal(c.status.value,'existing status');assert.match(c.modelRefreshError.value,/API Key missing/);
 c.fetchModels=async()=>{throw new c.ApiError('expired',401);};await c.loadModels({silent:true});assert.equal(c.authUser.value,null);assert.equal(c.models.value.length,0);assert.ok(c.calls.includes('clear-token'));
});
test('late account/host responses do not overwrite the current catalogue or loading flag',async()=>{
 const pending=[];const c=controller({fetchModels:base=>new Promise(resolve=>pending.push({base,resolve}))});const old=c.loadModels({silent:true});c.backendBaseUrl.value='/other';const current=c.loadModels({silent:true});
 pending[0].resolve([{id:'old'}]);await old;assert.equal(c.models.value.length,0);assert.equal(c.isLoadingModels.value,true);
 pending[1].resolve([{id:'current'}]);await current;assert.equal(c.models.value[0].id,'current');assert.equal(c.isLoadingModels.value,false);
 const late=c.loadModels({silent:true});c.authUser.value={id:'other-user'};pending[2].resolve([{id:'wrong-user'}]);await late;assert.equal(c.models.value[0].id,'current');
});
test('signed-out refresh performs no requests',async()=>{
 const c=controller({isAuthenticated:ref(false),fetchModels:()=>{throw Error('must not fetch');}});await c.loadModels({silent:true});assert.equal(c.status.value,'existing status');assert.equal(c.models.value.length,0);
});
test('catalogue APIs preserve HTTP error status and opt out of unrelated public-settings updates',async()=>{
 const api=ts.createSourceFile('api.ts',fs.readFileSync('frontend/src/api.ts','utf8'),ts.ScriptTarget.Latest,true);
 const c={Error,DOMException,ApiError:class ApiError extends Error{constructor(msg,status){super(msg);this.status=status;}},defaultBaseUrl:'/v1',withTimeoutSignal:()=>({signal:null,cleanup:()=>{}}),buildHeaders:()=>({}),noStore:'no-store',credOpts:{},readError:async()=> 'upstream API Key unavailable',fetch:async()=>({ok:false,status:503})};
 vm.createContext(c);
 for(const name of ['fetchModels','fetchPageModels']){const fn=api.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);vm.runInContext(ts.transpileModule(fn.getText(api).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);}
 await assert.rejects(c.fetchModels(),e=>e.status===503);
 let applied=0;c.applyPublicSettings=()=>applied++;c.fetch=async()=>({ok:true,json:async()=>({data:{page_models_chat:'a'}})});
 await c.fetchPageModels('/v1',{applySettings:false});assert.equal(applied,0);await c.fetchPageModels();assert.equal(applied,1);
});

const chat=fs.readFileSync('frontend/src/components/app/pages/ChatModule.vue','utf8');
test('chat selector is beside clear in composer, never in header, and templates compile',()=>{
 const parsed=parse(chat),template=parsed.descriptor.template.content;assert.equal(parsed.errors.length,0);assert.equal(compileTemplate({source:template,id:'chat',filename:'ChatModule.vue'}).errors.length,0);
 assert.doesNotMatch(template,/刷新模型/);const header=template.slice(0,template.indexOf('</WorkspaceHeader>'));assert.doesNotMatch(header,/<el-select/);
 const actions=template.slice(template.indexOf('<div class="composer-actions">'));assert.ok(actions.indexOf('chat-model-select')<actions.indexOf('清空'));assert.match(actions,/@visible-change="refreshChatModels"/);assert.match(chat,/grid-template-columns: minmax\(0, 1fr\) auto auto/);
});
test('chat refreshes on mount, interval, visible focus and auth change; stops when hidden/busy/unmounted',()=>{
 let mounted,unmounted,interval,watcher,now=10_000;const listeners=new Map(),refreshes=[],app={isAuthenticated:ref(true),isSubmitting:ref(false),isLoadingModels:ref(false),authUser:ref({id:'user'}),backendBaseUrl:ref('/v1'),loadModels:()=>refreshes.push(now)};
 const events={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const vue={unref:v=>v&&typeof v==='object'&&'value'in v?v.value:v,isRef:v=>v&&typeof v==='object'&&'value'in v,computed:fn=>({get value(){return fn.get();},set value(v){fn.set(v);}}),onMounted:fn=>mounted=fn,onUnmounted:fn=>unmounted=fn,watch:(_,fn)=>watcher=fn};
 const code=ts.transpileModule(parse(chat).descriptor.scriptSetup.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const c={exports:{},require:name=>name==='vue'?vue:{},defineProps:()=>({app}),Date:{now:()=>now},document:{...events,visibilityState:'visible'},window:events,setInterval:(fn,ms)=>{assert.equal(ms,60_000);interval=fn;return 7;},clearInterval:id=>{assert.equal(id,7);interval=null;}};
 vm.runInNewContext(code,c);mounted();assert.equal(refreshes.length,1);listeners.get('focus')();assert.equal(refreshes.length,1);
 now+=60_000;interval();assert.equal(refreshes.length,2);c.document.visibilityState='hidden';now+=60_000;interval();assert.equal(refreshes.length,2);
 c.document.visibilityState='visible';listeners.get('visibilitychange')();assert.equal(refreshes.length,3);app.isSubmitting.value=true;now+=60_000;interval();assert.equal(refreshes.length,3);
 app.isSubmitting.value=false;app.authUser.value={id:'new'};watcher();assert.equal(refreshes.length,4);app.isAuthenticated.value=false;now+=60_000;interval();assert.equal(refreshes.length,4);
 unmounted();assert.equal(interval,null);assert.equal(listeners.size,0);
});
