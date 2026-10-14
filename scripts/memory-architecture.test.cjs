const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('both default Compose deployments exclude the independent memory server and mandatory dependency', () => {
  for (const file of ['docker-compose.yml', 'docker-compose.prod.yml']) {
    const source = read(file);
    assert(!/^\s+langgraph-memory:/m.test(source));
    assert(!/MEMORY_PROVIDER|LANGGRAPH_MEMORY|langgraph_node_modules/.test(source));
    assert(/^  qdrant:/m.test(source) && /^  phpmyadmin:/m.test(source));
  }
});
test('templates consistently opt out of memory embeddings until explicitly enabled', () => {
  for (const file of ['.env.example','.env.docker.example','backend/.env.example']) {
    assert.match(read(file), /^MEMORY_SEMANTIC_INDEX_ENABLED=false$/m);
    assert.match(read(file), /^MEMORY_EMBEDDING_INSTANCE_ID=$/m);
  }
});
test('LangGraph stays embedded, MySQL stays authoritative and the former adapter is not registered', () => {
  assert.match(read('backend/src/agents/agents.service.ts'), /graph\.compile\(/);
  assert.match(read('backend/src/workflows/runtime/workflow-engine.ts'), /checkpointer: context\.checkpointer/);
  assert(!read('backend/src/memory/memory.module.ts').includes('LangGraphMemoryProvider'));
  assert(!fs.existsSync(path.join(root,'backend/src/memory/providers/langgraph-memory.provider.ts')));
  assert(read('backend/src/memory/memory.service.ts').includes("return 'native'"));
});
test('README remains emoji-free and all relative Markdown links resolve', () => {
  const source = read('README.md');
  assert(!/[\p{Extended_Pictographic}\uFE0F\u200D]/u.test(source));
  assert(!/MEMORY_PROVIDER=langgraph|记忆服务 `2024`/.test(source));
  for(const file of ['README.md','docs/MEMORY-ARCHITECTURE.md','docs/P0-ARCHITECTURE.md','langgraph/README.md']) {
    for(const match of read(file).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const link = match[1].split('#')[0];
      if(!link || /^[a-z]+:/i.test(link)) continue;
      assert(fs.existsSync(path.resolve(root,path.dirname(file),link)),file+': '+link);
    }
  }
});
