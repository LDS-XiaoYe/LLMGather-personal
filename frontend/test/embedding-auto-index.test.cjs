const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'../src');
const component=fs.readFileSync(path.join(root,'components/KnowledgeEmbeddingSelector.vue'),'utf8');
const utility={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'utils/embedding-index-state.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(utility,utility.exports);
const {currentEmbeddingIndex}=utility.exports;
const tree=ts.createSourceFile('component.ts',component.split('<script setup lang="ts">')[1].split('</script>')[0],ts.ScriptTarget.Latest,true);
const functions=tree.statements.filter(n=>ts.isFunctionDeclaration(n)).map(n=>n.getText(tree)).join('\n');
function fixture(){
  const ref=value=>({value}),calls=[],events=[],timers=[];
  const c={Error,props:{baseUrl:'/v1',kbId:'kb',modelValue:'old',disabled:false},providers:ref([]),selected:ref('new'),boundModel:ref('old'),busy:ref(false),loading:ref(false),indexing:ref(false),error:ref(''),loadError:ref(''),retryNeeded:ref(false),awaitingCompletion:ref(false),request:0,disposed:false,polling:false,poll:undefined,document:{hidden:false},currentEmbeddingIndex,emit:(...args)=>events.push(args),ElMessageBox:{confirm:async()=>{}},setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;}};
  c.bindingChanged={get value(){return c.selected.value!==c.boundModel.value;}};
  c.modelRequest=async(_base,route,body)=>{calls.push({route,body});if(route.endsWith('embedding'))return{reindexRequired:false};if(route.endsWith('embedding-providers'))return[{id:'new',fingerprint:'fp-new'}];return[{fingerprint:'fp-new',status:'ready'}];};
  vm.runInNewContext(ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
  return{c,calls,events,timers};
}

test('binding uses the auto-index endpoint, refreshes silently and does not send a manual reindex request',async()=>{
  const {c,calls,events}=fixture();await c.bind();
  assert.equal(c.boundModel.value,'new');assert.equal(c.busy.value,false);assert.equal(c.error.value,'');
  assert.equal(calls.filter(r=>r.body).length,1);assert.equal(calls[0].body.instanceId,'new');
  assert.ok(calls.some(r=>r.route.endsWith('/index-status')));assert.ok(events.some(e=>e[0]==='changed'));
  assert.equal(calls.some(r=>r.route.endsWith('/reindex')),false);
});
test('binding failure retains the chosen model and enables retry; cancellation sends nothing',async()=>{
  const {c}=fixture();const read=c.modelRequest;c.modelRequest=async(...args)=>{if(args[2])throw Error('模型绑定已保存，但自动重建索引失败');return read(...args);};
  await c.bind();assert.equal(c.selected.value,'new');assert.equal(c.retryNeeded.value,true);assert.match(c.error.value,/自动重建索引失败/);assert.equal(c.busy.value,false);
  const other=fixture();other.c.ElMessageBox.confirm=async()=>{throw 'cancel';};await other.c.bind();assert.equal(other.calls.length,0);assert.equal(other.c.error.value,'');
});
test('a timeout is tracked automatically until the matching model index finishes',async()=>{
  const {c}=fixture();c.boundModel.value='new';c.retryNeeded.value=true;let status='building';
  c.modelRequest=async(_base,route,body)=>{if(body){const e=Error('timeout');e.name='TimeoutError';throw e;}if(route.endsWith('embedding-providers'))return[{id:'new',fingerprint:'fp-new'}];return[{fingerprint:'fp-new',status}];};
  await c.bind();assert.equal(c.awaitingCompletion.value,true);assert.equal(c.indexing.value,true);
  status='ready';await c.load(true);assert.equal(c.indexing.value,false);assert.equal(c.error.value,'');assert.equal(c.awaitingCompletion.value,false);
});
test('historical pending or failed vector spaces do not mask the current ready index',()=>{
  const state=currentEmbeddingIndex([{fingerprint:'old',status:'pending'},{fingerprint:'older',status:'failed'},{fingerprint:'new',status:'ready'}],'new');
  assert.equal(state.ready,true);assert.equal(state.failed,false);assert.equal(state.building,false);
  assert.equal(currentEmbeddingIndex([{fingerprint:'old',status:'ready'}],'new').ready,false);
});
test('polling updates without manual action and stops after disposal',async()=>{
  const {c,calls,timers}=fixture();await c.pollState();assert.equal(timers[0].delay,5000);assert.equal(c.loading.value,false);
  const count=calls.length;c.disposed=true;await timers[0].callback();assert.equal(calls.length,count);assert.equal(timers.length,1);
});
test('selector and RAG page compile with a visible Top K label and without removed controls or labels',()=>{
  const {parse,compileTemplate}=require('@vue/compiler-sfc');
  const page=fs.readFileSync(path.join(root,'components/app/pages/RagModule.vue'),'utf8');
  for(const [name,source] of [['KnowledgeEmbeddingSelector.vue',component],['RagModule.vue',page]]){
    const {descriptor,errors}=parse(source);assert.deepEqual(errors,[]);assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:name,id:'rag-auto-index'}).errors,[]);
  }
  assert.doesNotMatch(component,/刷新状态|索引已就绪|@click="reindex"/);assert.doesNotMatch(page,/待检索/);
  const retrieval=fs.readFileSync(path.join(root,'components/knowledge/KnowledgeRetrievalTest.vue'),'utf8');
  assert.match(retrieval,/返回片段数（Top K）/);assert.match(retrieval,/:precision="0"/);assert.match(retrieval,/step-strictly/);
  assert.match(retrieval,/props.indexing/);assert.match(component,/clearTimeout\(poll\)/);
});
