const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'../src'),utility=fs.readFileSync(path.join(root,'utils/model-runtime-logs.ts'),'utf8');
const moduleFixture={exports:{}};
vm.runInNewContext(ts.transpileModule(utility,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleFixture,exports:moduleFixture.exports});
const format=moduleFixture.exports.formatModelRuntimeLogs;
test('Agent envelope displays actual newlines and strips TEI terminal colors rather than JSON-escaping them',()=>{
  assert.equal(format({logs:'\x1b[2m2026-10-12T14:09:01Z\x1b[0m \x1b[33mWARN\x1b[0m 模型加载中\n\x1b[32mINFO\x1b[0m 已就绪\n'}),'2026-10-12T14:09:01Z WARN 模型加载中\nINFO 已就绪');
});
test('Unicode escaped Chinese, surrogate pairs and encoded ANSI become readable text',()=>{
  assert.equal(format({logs:String.raw`\u001b[32mINFO\u001b[0m \u6a21\u578b\u5df2\u5c31\u7eea \ud83d\ude80`}), 'INFO 模型已就绪 🚀');
});
test('JSON-serialized legacy envelope unwraps correctly without corrupting Windows paths or literal escapes',()=>{
  const text=String.raw`C:\new\tools\model`+'\n  stack frame\tvalue';
  assert.equal(format(JSON.stringify({logs:JSON.stringify(text)})),text);
  assert.equal(format(String.raw`literal \\u4e2d`),String.raw`literal \\u4e2d`);
});
test('JSON records are indented, Unicode reads naturally, partial records and stack traces remain intact',()=>{
  assert.equal(format({logs:String.raw`{"level":"INFO","message":"\u6a21\u578b","details":{"ready":true}}`}),'{\n  "level": "INFO",\n  "message": "模型",\n  "details": {\n    "ready": true\n  }\n}');
  const partial='Traceback:\n  File "model.py", line 10\n{"unfinished":';assert.equal(format(partial),partial);
});
test('terminal hyperlinks, carriage returns and control codes are removed without removing visible text',()=>{
  assert.equal(format('\x1b]8;;https://example.invalid\x07模型\x1b]8;;\x07\r\nready\rnext\x00'), '模型\nready\nnext');
});
test('empty logs remain empty and markup is preserved as inert text, not HTML',()=>{
  for(const value of [{logs:''},{logs:null},null,undefined,{logs:'\x1b[0m\n'}])assert.equal(format(value),'');
  assert.equal(format({logs:'<img src=x onerror=alert(1)>'}),'<img src=x onerror=alert(1)>');
});
const component=fs.readFileSync(path.join(root,'components/ModelServiceManagement.vue'),'utf8');
test('log dialog compiles with text interpolation, independent empty/loading/error states and responsive overflow',()=>{
  const {parse,compileTemplate}=require('@vue/compiler-sfc'),{descriptor,errors}=parse(component);assert.deepEqual(errors,[]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'ModelServiceManagement.vue',id:'logs-review'}).errors,[]);
  assert.match(component,/v-model="detailOpen"/);assert.match(component,/formatModelRuntimeLogs\(value\)/);
  assert.match(component,/正在加载/);assert.match(component,/暂无日志/);assert.match(component,/刷新.*日志/);
  assert.match(component,/overflow-wrap:anywhere/);assert.doesNotMatch(component,/v-html=/);
});
function controllerFixture(){
  const tree=ts.createSourceFile('component.ts',component.split('<script setup lang="ts">')[1].split('</script>')[0],ts.ScriptTarget.Latest,true);
  const source=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&['inspect','refreshDetail','closeDetail'].includes(n.name?.text)).map(n=>n.getText(tree)).join('\n');
  const pending=[],ref=value=>({value}),context={Error,detail:ref(''),detailOpen:ref(false),detailLoading:ref(false),detailError:ref(''),detailTitle:ref(''),detailTarget:ref(null),detailRequest:0,props:{baseUrl:'/fixture'},formatModelRuntimeLogs:format,modelRequest:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return{context,pending};
}
test('logs open while loading, empty logs stay visible, metrics remain pretty JSON',async()=>{
  const {context:c,pending:p}=controllerFixture(),i={id:'fixture',model_id:'bge-m3'};
  let work=c.inspect(i,'logs');assert.equal(c.detailOpen.value,true);assert.equal(c.detailLoading.value,true);
  p[0].resolve({logs:''});await work;assert.equal(c.detailOpen.value,true);assert.equal(c.detail.value,'');assert.equal(c.detailLoading.value,false);
  work=c.inspect(i,'metrics');p[1].resolve({memory:123});await work;assert.equal(c.detail.value,'{\n  "memory": 123\n}');
});
test('refresh errors preserve readable previous logs and closing blocks stale responses',async()=>{
  const {context:c,pending:p}=controllerFixture(),i={id:'fixture',model_id:'bge-m3'};
  let work=c.inspect(i,'logs');p[0].resolve({logs:'INFO ready'});await work;
  work=c.refreshDetail();p[1].reject(new Error('fixture error'));await work;assert.equal(c.detail.value,'INFO ready');assert.equal(c.detailError.value,'fixture error');
  work=c.refreshDetail();c.detailOpen.value=false;c.closeDetail();p[2].resolve({logs:'stale'});await work;assert.equal(c.detail.value,'');assert.equal(c.detailLoading.value,false);
});
