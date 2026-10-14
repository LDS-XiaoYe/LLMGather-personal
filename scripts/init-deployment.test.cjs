'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { initialize, readKey } = require('./init-deployment.cjs');
const root = path.resolve(__dirname, '..');
// CLI smoke-test children run as normal processes, not inherited test workers.
const cliEnv = { ...process.env };
delete cliEnv.NODE_TEST_CONTEXT;

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'llmgather-deployment-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, envFile: path.join(directory, '.env'), template: path.join(root, '.env.example') };
}

test('first deployment generates a 32-byte random key, preserves the template, and reuses file bytes', async t => {
  const f = fixture(t);
  const template = fs.readFileSync(f.template);
  const first = await initialize(f);
  assert.equal(first.created, true);
  assert.equal(first.keyGenerated, true);
  const bytes = fs.readFileSync(f.envFile);
  assert.match(readKey(bytes.toString()), /^[a-f0-9]{64}$/);
  const next = await initialize(f);
  assert.equal(next.keyGenerated, false);
  assert.equal(next.created, false);
  assert.deepEqual(fs.readFileSync(f.envFile), bytes);
  assert.deepEqual(fs.readFileSync(f.template), template);
  if (process.platform !== 'win32') assert.equal(fs.statSync(f.envFile).mode & 0o777, 0o600);
});

test('separate deployments generate distinct keys', async t => {
  const a = fixture(t), b = fixture(t);
  await initialize(a); await initialize(b);
  assert.notEqual(readKey(fs.readFileSync(a.envFile, 'utf8')), readKey(fs.readFileSync(b.envFile, 'utf8')));
});

test('first dev initialization selects the dev origin; later mode changes do not rewrite config', async t => {
  const f = fixture(t);
  await initialize({ ...f, dev: true });
  const bytes = fs.readFileSync(f.envFile);
  assert.match(bytes.toString(), /^FRONTEND_ORIGIN=http:\/\/localhost:5174$/m);
  await initialize({ ...f, dev: false });
  assert.deepEqual(fs.readFileSync(f.envFile), bytes);
});

test('existing quoted custom keys, comments, settings and CRLF are preserved', async t => {
  const f = fixture(t);
  const source = "# custom\r\nQDRANT_API_KEY='custom-key # literal' # comment\r\nMYSQL_PASSWORD=my-password\r\n";
  fs.writeFileSync(f.envFile, source);
  assert.equal((await initialize(f)).keyGenerated, false);
  assert.equal(readKey(source), 'custom-key # literal');
  assert.equal(fs.readFileSync(f.envFile, 'utf8'), source);
});

test('missing, blank, comment-only, quoted-empty and legacy placeholder values are initialized', async t => {
  for (const field of ['', 'QDRANT_API_KEY=', 'QDRANT_API_KEY= # pending', "QDRANT_API_KEY=''", 'QDRANT_API_KEY=replace-with-a-random-qdrant-key']) {
    const f = fixture(t);
    fs.writeFileSync(f.envFile, 'EXISTING_SETTING=keep\r\n' + field + '\r\n');
    assert.equal((await initialize(f)).keyGenerated, true);
    const source = fs.readFileSync(f.envFile, 'utf8');
    assert.match(readKey(source), /^[a-f0-9]{64}$/);
    assert.match(source, /^EXISTING_SETTING=keep\r$/m);
  }
});

test('legacy .env.docker is migrated without changing its working key or source bytes', async t => {
  const f = fixture(t);
  const source = 'QDRANT_API_KEY=legacy-working-key\nFRONTEND_ORIGIN=https://existing.example\n';
  const legacy = path.join(f.directory, '.env.docker');
  fs.writeFileSync(legacy, source);
  const result = await initialize({ ...f, dev: true });
  assert.equal(result.migrated, true);
  assert.equal(result.keyGenerated, false);
  assert.equal(fs.readFileSync(f.envFile, 'utf8'), source);
  assert.equal(fs.readFileSync(legacy, 'utf8'), source);
});

test('duplicate or malformed definitions fail without changing the file and release the lock', async t => {
  for (const source of ['QDRANT_API_KEY=a\nQDRANT_API_KEY=b\n', 'QDRANT_API_KEY="unterminated\n']) {
    const f = fixture(t);
    fs.writeFileSync(f.envFile, source);
    await assert.rejects(initialize(f));
    assert.equal(fs.readFileSync(f.envFile, 'utf8'), source);
    assert.equal(fs.existsSync(f.envFile + '.init.lock'), false);
  }
});

test('parallel processes create exactly one key and leave no temporary files', async t => {
  const f = fixture(t);
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/init-deployment.cjs', '--env-path', f.envFile], { cwd: root, env: cliEnv, stdio: 'pipe' });
    child.stdout.resume(); child.stderr.resume();
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Initializer exit ' + code)));
  })));
  assert(outcomes.every(item => item.status === 'fulfilled'));
  const source = fs.readFileSync(f.envFile, 'utf8');
  assert.match(readKey(source), /^[a-f0-9]{64}$/);
  assert.equal((source.match(/^QDRANT_API_KEY=/gm) || []).length, 1);
  assert.deepEqual(fs.readdirSync(f.directory), ['.env']);
});

test('CLI logs never print a generated or reused key', t => {
  const f = fixture(t);
  for (let i = 0; i < 2; i++) {
    const result = spawnSync(process.execPath, ['scripts/init-deployment.cjs', '--env-path', f.envFile], { cwd: root, env: cliEnv, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert(!result.stdout.includes(readKey(fs.readFileSync(f.envFile, 'utf8'))));
    assert(!result.stderr.includes(readKey(fs.readFileSync(f.envFile, 'utf8'))));
  }
});

test('both Compose files share the key and include loopback phpMyAdmin with manual login', () => {
  for (const file of ['docker-compose.yml', 'docker-compose.prod.yml']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /LLMGATHER_ENV_FILE:-\.env}/);
    assert.match(source, /QDRANT__SERVICE__API_KEY: \$\{QDRANT_API_KEY:\?/);
    assert.match(source, /QDRANT_API_KEY=\$\{QDRANT_API_KEY:\?/);
    assert.match(source, /image: phpmyadmin:5\.2\.3-apache/);
    assert.match(source, /PMA_HOST: db/);
    assert.match(source, /127\.0\.0\.1:\$\{PHPMYADMIN_PORT:-8080}:80/);
    assert(!/PMA_USER|PMA_PASSWORD/.test(source));
    assert(source.includes('$${MYSQL_ROOT_PASSWORD}'));
  }
});

test('README has no emoji, documents initialization, key reuse and phpMyAdmin', () => {
  const source = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert(!/[\p{Extended_Pictographic}\uFE0F\u200D]/u.test(source));
  for (const detail of ['scripts/init-deployment.cjs', '首次', '复用', 'phpMyAdmin', 'http://localhost:8080', 'npm run deploy', 'Git']) assert(source.includes(detail), detail);
});

test('the generated .env is ignored by Git and excluded from Docker context', () => {
  assert.equal(spawnSync('git', ['check-ignore', '.env'], { cwd: root }).status, 0);
  assert.match(fs.readFileSync(path.join(root, '.dockerignore'), 'utf8'), /^\.env$/m);
});
