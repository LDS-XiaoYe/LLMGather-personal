const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'../src');
function apiFixture(){
  const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
  const calls=[],localStorage=storage(),sessionStorage=storage(),module={exports:{}};
  const context={module,exports:module.exports,localStorage,sessionStorage,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({})};}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {api:module.exports,localStorage,sessionStorage,calls};
}
test('legacy tokens leave persistent browser storage; new fallback tokens are tab-scoped and logout clears both',()=>{
  const {api,localStorage,sessionStorage}=apiFixture(),key='llm_gather_access_token';
  localStorage.setItem(key,'legacy-fixture');assert.equal(api.getStoredToken(),'legacy-fixture');assert.equal(localStorage.getItem(key),null);
  api.setStoredToken('tab-fixture');assert.equal(sessionStorage.getItem(key),'tab-fixture');assert.equal(localStorage.getItem(key),null);
  api.clearStoredToken();assert.equal(api.getStoredToken(),'');
});
test('login submits the explicit remember flag and accepts server cookie credentials',async()=>{
  const {api,calls}=apiFixture(); await api.login('fixture','fixture-password',{},'/v1',true);
  assert.equal(JSON.parse(calls[0].options.body).rememberMe,true);assert.equal(calls[0].options.credentials,'include');
  await api.login('fixture','fixture-password',{});assert.equal(JSON.parse(calls[1].options.body).rememberMe,false);
});
test('login checkbox compiles; controller uses cookie-only login, waits for logout and preserves credentials on transient failures',()=>{
  const {parse,compileTemplate}=require('@vue/compiler-sfc'),source=fs.readFileSync(path.join(root,'components/app/AppShell.vue'),'utf8');
  const {descriptor,errors}=parse(source);assert.deepEqual(errors,[]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'AppShell.vue',id:'login-memory'}).errors,[]);
  assert.match(source,/v-model="authRememberMe"/);assert.match(source,/30 天内保持登录/);
  const controller=fs.readFileSync(path.join(root,'app/useAppController.ts'),'utf8');
  assert.match(controller,/import \{\s+ApiError,/);assert.match(controller,/backendBaseUrl.value, authRememberMe.value\)/);
  assert.doesNotMatch(controller,/setStoredToken\(result.accessToken\)/);
  assert.match(controller,/await apiLogout\(backendBaseUrl.value\)/);assert.match(controller,/error.status === 401/);
});
