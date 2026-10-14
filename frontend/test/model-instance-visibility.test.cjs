const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const fixture={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/model-instance-visibility.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(fixture,fixture.exports);
const visible=fixture.exports.isVisibleModelInstance;
const instance=(actual_state,desired_state=actual_state,operation_id=null)=>({actual_state,desired_state,operation_id});

test('successful uninstalls disappear; stops, failed removals and pending removals remain visible',()=>{
  assert.equal(visible(instance('REMOVED')),false);
  assert.equal(visible(instance('REMOVED','REMOVED','cleanup-task')),false);
  for(const i of [instance('STOPPED'),instance('FAILED','REMOVED'),instance('RUNNING','REMOVED','remove-task'),instance('PENDING','RUNNING','deploy-task')])assert.equal(visible(i),true);
  assert.equal(visible(instance('REMOVED','RUNNING','redeploy-task')),true);
});

test('list and model count use the same derived collection after refresh or SSE updates',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/components/ModelServiceManagement.vue'),'utf8');
  assert.match(source,/snapshot.value.instances.filter\(isVisibleModelInstance\)/);
  assert.match(source,/:data="visibleInstances"/);assert.match(source,/visibleInstances.length/);
  assert.doesNotMatch(source,/:data="snapshot.instances"/);
  let snapshot=[instance('RUNNING'),instance('REMOVED')];
  assert.equal(snapshot.filter(visible).length,1);
  snapshot=[instance('REMOVED'),instance('REMOVED')];
  assert.deepEqual(snapshot.filter(visible),[]);
});
