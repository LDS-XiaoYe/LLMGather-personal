const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('frontend/src/api.ts','utf8'),tree=ts.createSourceFile('api.ts',source,ts.ScriptTarget.Latest,true);
const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='streamCompletion');
const code=ts.transpileModule(fn.getText(tree).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const status of ['applied','empty','unavailable'])test(`stream SDK memory status ${status} preserves completion and reports only real retrieval failures`,async()=>{
 let cleanup=0,done=0,sent;const warnings=[];
 const ctx={AbortController,DOMException,TextDecoder,defaultBaseUrl:'/v1',STREAM_REQUEST_TIMEOUT_MS:30_000,buildHeaders:()=>({}),withTimeoutSignal:()=>({signal:new AbortController().signal,cleanup:()=>cleanup++}),fetch:async(_,options)=>{sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'x-memory-status':status}});}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 await ctx.streamCompletion({model:'model',memory_enabled:true,messages:[{role:'user',content:'问题'}]},{onDone:()=>done++,onMemoryWarning:message=>warnings.push(message)});
 assert.equal(sent.memory_enabled,true);assert.equal(done,1);assert.equal(cleanup,1);assert.equal(warnings.length,status==='unavailable'?1:0);
 if(status==='unavailable')assert.match(warnings[0],/长期记忆读取失败/);
});
test('memory diagnostics headers are exposed for browsers using a separate backend origin',()=>{
 const main=fs.readFileSync('backend/src/main.ts','utf8');assert.match(main,/'x-memory-count'/);assert.match(main,/'x-memory-status'/);
});
test('memory settings omit infrastructure badges and label the bounded integer importance control',()=>{
 const shell=fs.readFileSync('frontend/src/components/app/AppShell.vue','utf8');
 assert.doesNotMatch(shell,/MySQL 长期记忆|MySQL \+ 语义索引|const memoryProviderInfo/);
 assert.match(shell,/<el-form-item label="记忆类型">/);assert.match(shell,/<el-form-item label="重要程度">/);
 assert.match(shell,/aria-label="记忆重要程度" aria-describedby="settings-memory-importance-help"/);
 assert.match(shell,/:min="1" :max="5" :step="1" step-strictly :precision="0"/);
 assert.match(shell,/重要程度 1–5，默认 3/);assert.match(shell,/@click="createSettingsMemory\(\)"/);
 const css=fs.readFileSync('frontend/src/ui-foundation.css','utf8');assert.match(css,/\.settings-memory-options \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) auto/);
});
