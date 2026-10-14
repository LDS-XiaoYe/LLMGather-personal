const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const root = 'frontend/src/';
function load(source, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { Error, module, exports: module.exports, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id]; }, ...globals });
  return module.exports;
}
const navigation = load(fs.readFileSync(root + 'utils/knowledge-navigation.ts', 'utf8'));
const ref = value => ({ value });
function fixture() {
  const watches = [], unmounts = [], timers = [], calls = [];
  const vue = { ref, reactive: v => v, computed: get => ({ get value() { return get(); } }), watch: (get, callback, options) => { watches.push({ get, callback }); if (options?.immediate) callback(); }, onUnmounted: fn => unmounts.push(fn) };
  const api = { fetchKnowledgeBases: async () => [], fetchKnowledgeDocuments: async (id) => [{ id }], createKnowledgeBase: async payload => { calls.push(payload); return { id: 'new', ...payload }; } };
  const window = { location: { hash: '#/rag' }, addEventListener() {}, removeEventListener() {}, setInterval: fn => { timers.push(fn); return 1; }, clearInterval() {} };
  const document = { hidden: false };
  const exported = load(fs.readFileSync(root + 'composables/useKnowledgeWorkspace.ts', 'utf8'), { vue, 'element-plus': { ElMessage: { success() {} } }, '../api': api, '../model-services-api': { modelRequest: async () => [] }, '../utils/knowledge-navigation': navigation }, { window, document });
  const authenticated = ref(false), workspace = exported.useKnowledgeWorkspace(ref('/v1'), authenticated, () => {});
  return { workspace, api, authenticated, watches, unmounts, timers, window, document, calls };
}
function componentFunctions(name, context) {
  const source = parse(fs.readFileSync(root + 'components/knowledge/' + name + '.vue', 'utf8')).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile('component.ts', source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast)).join('\n');
  vm.runInNewContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context;
}
test('legacy route, detail links, library and malformed IDs remain compatible', () => {
  assert.equal(navigation.isKnowledgeHash('#/rag'), true); assert.equal(navigation.isKnowledgeHash('#/knowledge/id/retrieval'), true);
  assert.equal(navigation.isKnowledgeHash('#/knowledge-other'), false);
  assert.equal(navigation.readKnowledgeRoute('#/knowledge/kb%20one/retrieval').id, 'kb one');
  assert.equal(navigation.readKnowledgeRoute('#/knowledge/library').library, true);
  assert.equal(navigation.readKnowledgeRoute('#/rag').tab, 'documents');
  assert.doesNotThrow(() => navigation.readKnowledgeRoute('#/knowledge/%invalid'));
  assert.equal(navigation.knowledgeHash('a b', 'settings'), '#/knowledge/a%20b/settings');
});
test('processing labels distinguish parsed but unindexed documents and failures', () => {
  assert.equal(navigation.documentStage({ parseStatus: 'pending', vectorStatus: 'pending' }), '等待处理');
  assert.equal(navigation.documentStage({ parseStatus: 'processing', vectorStatus: 'pending' }), '解析中');
  assert.equal(navigation.documentStage({ parseStatus: 'succeeded', vectorStatus: 'pending' }), '等待索引');
  assert.equal(navigation.documentStage({ parseStatus: 'succeeded', vectorStatus: 'building' }), '索引中');
  assert.equal(navigation.documentStage({ parseStatus: 'succeeded', vectorStatus: 'succeeded' }), '已就绪');
  assert.equal(navigation.documentStage({ parseStatus: 'succeeded', vectorStatus: 'failed' }), '处理失败');
});
test('upload validation rejects empty, unsupported or oversized files before parsing', () => {
  assert.equal(navigation.validateKnowledgeFile({ name: 'guide.pdf', size: 1024 }), '');
  for (const file of [{ name: 'guide.exe', size: 1 }, { name: 'guide.md', size: 0 }, { name: 'guide.pdf', size: 1024 * 1024 + 1 }]) assert.ok(navigation.validateKnowledgeFile(file));
});
test('failed creation retains dialog and form; success enters document management', async () => {
  const f = fixture(); f.workspace.createVisible.value = true; f.workspace.form.name = '资料';
  f.api.createKnowledgeBase = async () => { throw Error('服务不可用'); }; await f.workspace.create();
  assert.equal(f.workspace.createVisible.value, true); assert.equal(f.workspace.form.name, '资料'); assert.equal(f.workspace.createError.value, '服务不可用');
  f.api.createKnowledgeBase = async payload => ({ id: 'created', ...payload }); await f.workspace.create();
  assert.equal(f.workspace.createVisible.value, false); assert.equal(f.window.location.hash, '#/knowledge/created/documents');
});
test('late document responses never replace the current knowledge base', async () => {
  const f = fixture(), pending = []; f.authenticated.value = true;
  f.api.fetchKnowledgeDocuments = id => new Promise(resolve => pending.push({ id, resolve }));
  f.workspace.route.value.id = 'old'; const first = f.workspace.loadDocuments();
  f.workspace.route.value.id = 'new'; const second = f.workspace.loadDocuments();
  pending[1].resolve([{ id: 'new-document' }]); await second; pending[0].resolve([{ id: 'old-document' }]); await first;
  assert.equal(f.workspace.documents.value[0].id, 'new-document');
});
test('auto refresh respects visibility and component disposal', async () => {
  const f = fixture(); f.authenticated.value = true; f.workspace.route.value.id = 'kb'; f.workspace.bases.value = [{ id: 'kb', provider: 'native' }]; let reads = 0;
  f.api.fetchKnowledgeDocuments = async () => { reads++; return []; };
  f.document.hidden = true; await f.timers[0](); assert.equal(reads, 0);
  f.document.hidden = false; await f.timers[0](); assert.equal(reads, 1);
  f.unmounts.forEach(fn => fn()); await f.timers[0](); assert.equal(reads, 1);
});
test('association patches preserve other knowledge bases and deduplicate additions', () => {
  assert.deepEqual(Array.from(navigation.knowledgeAssociation(['other', 'kb'], 'kb', false)), ['other']);
  assert.deepEqual(Array.from(navigation.knowledgeAssociation(['other'], 'kb', true)), ['other', 'kb']);
  assert.equal(navigation.knowledgeAssociation(['kb'], 'kb', true).length, 1);
});
test('partial Agent saves retain successful changes and allow retrying the rest', async () => {
  const patches = [], agents = [{ id: 'one', name: 'One', knowledgeBaseIds: ['other'] }, { id: 'two', name: 'Two', knowledgeBaseIds: [] }];
  const c = componentFunctions('KnowledgeAgentBinding', { ref, props: { kbId: 'kb', baseUrl: '/v1' }, disposed: false, saving: ref(false), changed: ref(true), error: ref(''), selectedIds: ref(['one', 'two']), originalIds: ref([]), agents: ref(agents), fetchAgents: async () => agents, updateAgent: async (id, patch) => { patches.push({ id, patch }); if (id === 'two') throw Error('offline'); }, knowledgeAssociation: navigation.knowledgeAssociation, message: e => e.message, ElMessage: { success() {} }, emit() {} });
  await c.save(); assert.deepEqual(Array.from(c.originalIds.value), ['one']); assert.match(c.error.value, /offline/); assert.equal(c.saving.value, false);
  assert.deepEqual(Object.keys(patches[0].patch), ['knowledgeBaseIds']); assert.deepEqual(Array.from(patches[0].patch.knowledgeBaseIds), ['other', 'kb']);
});
test('document delete cancellation never calls the API', async () => {
  let deleted = 0;
  const c = componentFunctions('KnowledgeDocuments', { actionId: ref(''), actionError: ref(''), ElMessageBox: { confirm: async () => { throw 'cancel'; } }, deleteKnowledgeDocument: async () => deleted++, props: { baseUrl: '/v1' }, emit() {}, ElMessage: { success() {} }, message: e => e.message });
  await c.act({ id: 'doc', title: 'Guide' }, true); assert.equal(deleted, 0); assert.equal(c.actionError.value, '');
});
test('write failure retains upload draft and refreshes actual server status rather than reporting success', async () => {
  const events = [];
  const c = componentFunctions('KnowledgeDocumentUpload', { valid: ref(true), busy: ref(false), error: ref(''), phase: ref(''), title: ref('Guide'), content: ref('Original content'), props: { kbId: 'kb', baseUrl: '/v1' }, addKnowledgeDocument: async () => { throw Error('index failed'); }, message: e => e.message, emit: e => events.push(e) });
  await c.save(); assert.equal(c.content.value, 'Original content'); assert.match(c.error.value, /index failed/); assert.deepEqual(events, ['changed']); assert.equal(c.busy.value, false);
});
test('all knowledge templates compile, preserve actual features and do not reintroduce removed controls', () => {
  for (const name of fs.readdirSync(root + 'components/knowledge').filter(n => n.endsWith('.vue'))) {
    const source = fs.readFileSync(root + 'components/knowledge/' + name, 'utf8'); const { descriptor, errors } = parse(source);
    assert.deepEqual(errors, [], name); assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: name, id: name }).errors, [], name);
    assert.doesNotMatch(source, /@ts-nocheck|刷新状态|索引已就绪|待检索/);
  }
  const css = fs.readFileSync(root + 'knowledge.css', 'utf8'); assert.match(css, /max-width: 1280px/); assert.match(css, /max-width: 760px/);
  const retrieval = fs.readFileSync(root + 'components/knowledge/KnowledgeRetrievalTest.vue', 'utf8'); assert.match(retrieval, /createRagLabSession/); assert.match(retrieval, /不调用 LLM/);
});
test('library downloads use a Blob and release the object URL without navigating to stored content', async () => {
  let clicked = false, revoked = false;
  const link = { click() { clicked = true; }, remove() {} };
  const c = componentFunctions('KnowledgeLibrary', { api: { fetchUserLibraryFile: async () => ({ filename: 'guide.txt', fileBase64: 'data:text/plain;base64,aGVsbG8=' }) }, props: { baseUrl: '/v1' }, error: ref(''), message: e => e.message, Uint8Array, atob, Blob, document: { createElement: () => link, body: { appendChild() {} } }, URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL: () => { revoked = true; } }, window: { setTimeout: fn => fn() } });
  await c.download({ id: 'file' }); assert.equal(link.href, 'blob:fixture'); assert.equal(link.download, 'guide.txt'); assert.equal(clicked, true); assert.equal(revoked, true); assert.equal(c.error.value, '');
});
test('library rejects an executable URL instead of assigning it to a download link', async () => {
  const c = componentFunctions('KnowledgeLibrary', { api: { fetchUserLibraryFile: async () => ({ fileBase64: 'javascript:alert(1)' }) }, props: { baseUrl: '/v1' }, error: ref(''), message: e => e.message });
  await c.download({ id: 'file' }); assert.equal(c.error.value, '文件下载数据格式不正确');
});
