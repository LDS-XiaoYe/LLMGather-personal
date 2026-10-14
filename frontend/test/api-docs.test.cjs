const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const source=fs.readFileSync(path.join(__dirname,'../src/components/app/pages/ApiModule.vue'),'utf8');

test('API documentation compiles without the endpoint index and preserves the usage sections',()=>{
  const {descriptor,errors}=parse(source);assert.deepEqual(errors,[]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'ApiModule.vue',id:'api-docs'}).errors,[]);
  assert.doesNotMatch(source,/接口索引|api-index-grid/);
  for(const section of ['中转 API Key','快速开始','OpenAI 兼容接口','Agent API','错误码参考'])assert.ok(source.includes(section),section);
  const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');assert.doesNotMatch(css,/\.api-index-grid/);
});
