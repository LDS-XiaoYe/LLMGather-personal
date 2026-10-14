const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {parse,compileTemplate,compileScript}=require('@vue/compiler-sfc');
const root='frontend/src/';
const read=p=>fs.readFileSync(root+p,'utf8');
const ref=value=>({value});
const vue={ref,unref:v=>v&&typeof v==='object'&&'value'in v?v.value:v,isRef:v=>v&&typeof v==='object'&&'value'in v,computed:fn=>typeof fn==='function'?{get value(){return fn();}}:{get value(){return fn.get();},set value(v){fn.set(v);}},watch:()=>{}};
function functions(file,app){const content=parse(read(file)).descriptor.scriptSetup.content,ast=ts.createSourceFile('component.ts',content,ts.ScriptTarget.Latest,true);const ctx={props:{app},emit:()=>{},...vue};vm.createContext(ctx);const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['call','value'].includes(d.name.getText(ast))))).map(n=>n.getText(ast)).join('\n');vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx;}
test('all route templates and shared UI components compile',()=>{
 const files=fs.readdirSync(root+'components/app/pages').filter(p=>p.endsWith('.vue')).map(p=>'components/app/pages/'+p).concat(fs.readdirSync(root+'components/ui').filter(p=>p.endsWith('.vue')).map(p=>'components/ui/'+p),['components/app/AppShell.vue']);
 for(const file of files){const parsed=parse(read(file));assert.equal(parsed.errors.length,0,file);assert.equal(compileTemplate({source:parsed.descriptor.template.content,id:file,filename:file}).errors.length,0,file);}
});
test('pages retain content headings and feedback without the former navigation bar/account',()=>{
 for(const file of fs.readdirSync(root+'components/app/pages').filter(p=>p.endsWith('.vue'))){const content=read('components/app/pages/'+file);assert.match(content,/WorkspaceHeader/,file);assert.doesNotMatch(content,/<main[\s>]/,file+' must not nest another main landmark');}
 const header=read('components/ui/WorkspaceHeader.vue');assert.match(header,/<h1/);assert.doesNotMatch(header,/WorkspaceAccount|class="page-header/);assert.match(header,/WorkspaceFeedback/);
 assert.match(read('components/app/pages/RagModule.vue'),/<WorkspaceHeader :app="props.app"\s*\/>/);
 const account=read('components/ui/WorkspaceAccount.vue');assert.match(account,/aria-label/);assert.doesNotMatch(account,/<el-tag type="success"/);
});

test('sidebar footer retains the paired controls above an upward, teleported account menu',()=>{
 const shell=read('components/app/AppShell.vue');assert.equal((shell.match(/<WorkspaceAccount/g)||[]).length,2);
 assert.equal((shell.match(/class="ui-sidebar-footer"/g)||[]).length,2);
 for(const footer of shell.matchAll(/<div class="ui-sidebar-footer">([\s\S]*?)<WorkspaceAccount[^>]+\/>/g)){
  assert.match(footer[1],/class="aside-bottom"/);assert.match(footer[1],/>功能说明<\/el-button>/);assert.match(footer[1],/>设置<\/el-button>/);
 }
 const account=read('components/ui/WorkspaceAccount.vue');assert.match(account,/placement="top-start"/);assert.match(account,/:teleported="true"/);assert.match(account,/:aria-expanded="menuOpen"/);assert.match(account,/v-if="value\('isAdmin'\)" command="admin"/);
 const css=read('ui-foundation.css');assert.match(css,/\.ui-sidebar-footer \{ margin-top: auto; flex: 0 0 auto;/);assert.match(css,/\.ui-sidebar-account \{[^}]*height: 64px/);assert.match(css,/\.ui-account-button \{[^}]*height: 56px/);
 assert.doesNotMatch(read('knowledge.css'),/\.knowledge-shell > \.app-aside/);
});
test('mobile and desktop use the same navigation and session data; roles stay gated',()=>{
 const shell=read('components/app/AppShell.vue');assert.equal((shell.match(/<WorkspaceNavigation/g)||[]).length,2);assert.equal((shell.match(/<WorkspaceSessions/g)||[]).length,2);assert.match(shell,/aria-expanded="mobileNavigationOpen"/);assert.doesNotMatch(shell,/aside-hint/);
 const nav=read('components/ui/WorkspaceNavigation.vue');assert.match(nav,/v-if="value\('isAdmin'\)"/);for(const mode of ['vision','router','rag','admin'])assert.match(nav,new RegExp('index="'+mode+'"'));
});
test('account actions retain login/logout/console and role-specific navigation',()=>{
 const calls=[],app={isAuthDialogOpen:ref(false),handleUserMenu:cmd=>calls.push(cmd),switchPage:p=>calls.push(p),copyToClipboard:v=>calls.push(v),userInvitationCode:ref('invite')};const c=functions('components/ui/WorkspaceAccount.vue',app);c.login();assert.equal(app.isAuthDialogOpen.value,true);c.command('console');c.command('logout');c.command('admin');c.command('invitation');assert.deepEqual(calls,['console','logout','admin','invite']);
});

test('real account template hides admin from ordinary users and retains all authenticated actions',async()=>{
 const Vue=require('vue'),{renderToString}=require('@vue/server-renderer');
 const compiled=compileScript(parse(read('components/ui/WorkspaceAccount.vue')).descriptor,{id:'sidebar-account',inlineTemplate:true});
 const exports={};new Function('require','exports',ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,exports);
 async function render(isAdmin,isAuthenticated=true,invitation='invite'){
  const app=Vue.createSSRApp(exports.default,{app:{isAuthLoaded:true,isAuthenticated,isAdmin,authUser:{username:'tester'},userInvitationCode:invitation}});
  const stub={setup(_,context){return ()=>Vue.h('div',null,[context.slots.default?.(),context.slots.dropdown?.()]);}};
  for(const name of ['ElDropdown','ElDropdownMenu','ElDropdownItem','ElButton','ElAvatar','ElIcon','ElSkeleton'])app.component(name,stub);
  return renderToString(app);
 }
 const ordinary=await render(false);assert.doesNotMatch(ordinary,/管理后台/);for(const text of ['账户与用量','复制邀请码','退出登录'])assert.match(ordinary,new RegExp(text));
 assert.match(await render(true),/管理后台/);assert.doesNotMatch(await render(false,true,''),/复制邀请码/);
 const loggedOut=await render(false,false);assert.match(loggedOut,/登录 \/ 注册/);assert.doesNotMatch(loggedOut,/管理后台|退出登录/);
});
test('session selection is keyboard-native and retains separate destructive menus',()=>{
 const source=read('components/ui/WorkspaceSessions.vue');assert.match(source,/<button type="button" class="ui-session-select"/);assert.match(source,/aria-pressed/);assert.match(source,/handleSoftDeleteSession/);assert.match(source,/removeAgent/);
 const calls=[],app={pageMode:ref('chat'),activeSessionId:ref('old'),createNewChat:()=>calls.push('new')};const c=functions('components/ui/WorkspaceSessions.vue',app);c.kind={value:'chat'};c.select({id:'selected'});assert.equal(app.activeSessionId.value,'selected');c.create();assert.deepEqual(calls,['new']);
});
test('ledger pagination preserves all loaded data and never truncates the source',()=>{
 const source=parse(read('components/app/pages/ConsoleModule.vue')).descriptor.scriptSetup.content;const ast=ts.createSourceFile('console.ts',source,ts.ScriptTarget.Latest,true);const declarations=ast.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations);const rows=Array.from({length:43},(_,id)=>({id}));const c={vueComputed:vue.computed,billingLedger:ref(rows),rechargeOrders:ref(rows),ledgerPage:ref(1),rechargePage:ref(1)};vm.createContext(c);
 for(const name of ['ledgerPageRows','rechargePageRows']){const n=declarations.find(n=>n.name.getText(ast)===name);c[name]=vm.runInContext(ts.transpileModule('('+n.initializer.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);}
 assert.equal(c.ledgerPageRows.value.length,20);c.ledgerPage.value=3;assert.equal(c.ledgerPageRows.value.length,3);assert.equal(c.ledgerPageRows.value[0].id,40);assert.equal(rows.length,43);c.rechargePage.value=2;assert.equal(c.rechargePageRows.value[0].id,10);
});
test('technical details are opt-in, masked keys cannot be copied as full keys',()=>{
 const api=read('components/app/pages/ApiModule.vue');assert.ok((api.match(/<details class="ui-doc-section"/g)||[]).length>=8);assert.match(api,/:disabled="!row.fullKey"/);assert.doesNotMatch(api,/copyToClipboard\(row.fullKey \|\| row.maskedKey\)/);
 const chat=read('components/app/pages/ChatModule.vue');assert.match(chat,/ui-routing-details/);assert.doesNotMatch(chat,/<details v-if="msg.reasoning[^>]+\sopen/);assert.match(chat,/ui-empty-conversation/);
 const compiled=compileTemplate({source:parse(api).descriptor.template.content,id:'api',filename:'ApiModule.vue'});
 assert.doesNotMatch(compiled.code,/_ctx\.input\b/);assert.match(api,/<span v-pre>\{\{input\}\}<\/span>/);
});
test('TTS tags are keyboard-operable buttons and group participant count is consistent',()=>{
 const tts=read('components/app/pages/TtsModule.vue');assert.match(tts,/<button type="button" :aria-pressed="ttsStyleTag/);assert.match(tts,/<button type="button" v-for="tag in TTS_AUDIO_TAGS/);assert.match(tts,/aria-label="语音生成文本"/);
 const group=read('components/app/pages/GroupModule.vue');assert.doesNotMatch(group,/models.length.*个模型/);assert.equal((group.match(/groupModelList.length/g)||[]).length,1);
});
test('new foundation is theme-aware and preserves bounded readable layouts',()=>{
 const css=read('ui-foundation.css');assert.match(css,/html:not\(\.dark\)/);assert.match(css,/--el-text-color-secondary: #5f6f83/);assert.match(css,/--ui-width-content: 1280px/);assert.match(css,/max-width: calc\(100vw - 32px\)/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.ui-mobile-menu \{ display: inline-flex/);
 assert.match(read('app/useAppController.ts'),/window.location.hash === '#\/admin' \? 'admin'/);
});

test('Agent identity is separated by a themed card while the surrounding controls keep the page backdrop',()=>{
 const css=read('styles.css');
 for(const selector of ['.agent-studio-shell','.agent-workspace-switch','.agent-mode-nav','html.dark .agent-workspace-switch','html.dark .agent-mode-nav']){
  const block=css.slice(css.indexOf(selector+' {')).split('}')[0];assert.match(block,/background: transparent;/,selector);
 }
 const identity=css.slice(css.indexOf('.agent-workspace-switch {')).split('}')[0];
 assert.match(identity,/padding: 14px 24px;/);assert.match(identity,/flex-shrink: 0;/);assert.doesNotMatch(identity,/border-bottom:/);
 assert.match(css,/\.agent-workspace-switch, \.agent-mode-nav \{ padding-left: 16px; padding-right: 16px; \}/);
 assert.match(read('components/app/pages/AgentModule.vue'),/<el-card class="agent-workspace-context" shadow="never">\s*<div class="agent-workspace-switch">/);
 assert.match(css,/\.agent-workspace-context > \.el-card__body \{ padding: 0; \}/);
 assert.match(css,/--el-card-border-color: var\(--el-border-color-light\)/);
});
test('feedback ignores stale status and unrelated Agent updates while preserving errors and rotation notices',()=>{
 const content=parse(read('components/ui/WorkspaceFeedback.vue')).descriptor.scriptSetup.content;let callback;
 const app={pageMode:ref('chat'),status:ref('已选择 Agent：旧页面')};
 const js=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const state=vm.runInNewContext(js+'\n({message, warning})',{exports:{},require:()=>({...vue,watch:(get,fn)=>{callback=fn;}}),defineProps:()=>({app})});
 assert.equal(state.message.value,'');callback('Agent 执行失败');assert.equal(state.message.value,'');callback('读取模型失败');assert.equal(state.message.value,'读取模型失败');callback('回复完成，API Key 已轮转');assert.equal(state.warning.value,true);app.pageMode.value='api';callback('网络错误');assert.equal(state.message.value,'');
});
