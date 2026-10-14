const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const source=fs.readFileSync(path.join(__dirname,'../src/components/BailianModelSync.vue'),'utf8');
test('sync dialog compiles and uses password input and explicit removal confirmation',()=>{
  const {descriptor,errors}=parse(source);assert.deepEqual(errors,[]);
  const result=compileTemplate({source:descriptor.template.content,filename:'BailianModelSync.vue',id:'bailian-sync'});assert.deepEqual(result.errors,[]);
  assert.match(source,/type="password" show-password/);assert.match(source,/确认同步/);assert.match(source,/本地域官方目录中已不存在/);
});
test('remembered Keys are reused server-side with only a masked status in the UI',()=>{
  assert.match(source,/记住 Key（成功获取预览后保存，下次自动复用）/);
  assert.match(source,/apiKey: apiKey \|\| undefined/);
  assert.match(source,/!apiKey && !credential.value.remembered/);
  assert.match(source,/bailianCredentialRequest\('status'/);assert.match(source,/bailianCredentialRequest\('forget'/);
  assert.match(source,/request === credentialRequest && dialog.value/);
  assert.match(source,/不删除服务商调用密钥/);
});
test('explicit per-provider selections are submitted and deletions start unchecked',()=>{
  assert.match(source,/filter\(c => c.action === 'added'\).map\(c => c.key\)/);
  assert.match(source,/providerId: c.providerId, modelId: c.id, action: c.action/);
  assert.match(source,/applyBailianModels\(preview.value.previewId, selections, props.baseUrl\)/);
  assert.match(source,/toggleSelected\(row.key, Boolean\(\$event\)\)/);
  assert.match(source,/选择当前筛选模型/);
});
test('official Key console and documentation links open separately without credentials',()=>{
  assert.match(source,/href="https:\/\/bailian.console.aliyun.com\/cn-beijing\/model\/settings\/api-key" target="_blank" rel="noopener noreferrer"/);
  assert.match(source,/href="https:\/\/help.aliyun.com\/zh\/model-studio\/get-api-key\//);
  assert.match(source,/登录后选择与本页一致的地域/);
});
test('credential is cleared on close and drafts invalidate previews instead of storing keys in browser storage',()=>{
  assert.match(source,/@closed="clearSecret"/);assert.match(source,/watch\(form/);assert.match(source,/form.value.apiKey = ''/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|console\.(log|error)/);
  assert.match(source,/if \(busy.value \|\| !preview.value\) return/);
});
test('service-provider tab contains sync action and refreshes runtime model choices after confirmation',()=>{
  const admin=fs.readFileSync(path.join(__dirname,'../src/components/app/pages/AdminModule.vue'),'utf8');
  const providerPane=admin.split('<el-tab-pane label="服务商"')[1].split('</el-tab-pane>')[0];
  assert.match(providerPane,/<BailianModelSync/);assert.match(providerPane,/@synced="refreshAfterBailianSync"/);
  assert.match(admin,/function refreshAfterBailianSync\(\)[\s\S]*?loadModels.value\(\)/);
});
