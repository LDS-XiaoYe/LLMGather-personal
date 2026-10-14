#!/usr/bin/env node
// Real MySQL + Redis in uniquely named temporary containers; no existing .env/volumes used.
const cp = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');
const root = path.resolve(__dirname, '../..');
const prefix = 'llmgather-seed-test-' + crypto.randomBytes(6).toString('hex');
const password = crypto.randomBytes(24).toString('hex');
const created = [];
function docker(args) {
  const r = cp.spawnSync('docker', args, { encoding: 'utf8' });
  if (r.status !== 0) throw Error('Test Docker operation failed (' + args[0] + ')');
  return r.stdout.trim();
}
function launch(kind, image, port, extra) {
  const name = prefix + '-' + kind;
  if (!name.startsWith('llmgather-seed-test-')) throw Error('Invalid test container');
  docker(['run', '--detach', '--name', name, '--label', 'llmgather.database-bootstrap-test=true',
    '--publish', '127.0.0.1::' + port, ...extra, image]);
  created.push(name);
  const state = JSON.parse(docker(['inspect', name]))[0];
  return state.NetworkSettings.Ports[port + '/tcp'][0].HostPort;
}
async function main() {
  try {
    const port = launch('mysql', 'mysql:8.0', 3306, ['--tmpfs', '/var/lib/mysql:rw', '--env', 'MYSQL_ROOT_PASSWORD=' + password]);
    const redisPort = launch('redis', 'redis:7-alpine', 6379, []);
    let healthy = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const c = await mysql.createConnection({ host: '127.0.0.1', port: Number(port), user: 'root', password, connectTimeout: 1000 });
        await c.query('SELECT 1'); await c.end(); healthy = true; break;
      } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    if (!healthy) throw Error('Temporary MySQL did not become ready');
    const env = { ...process.env, DATABASE_BOOTSTRAP_INTEGRATION: 'true', MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: port, MYSQL_USER: 'root', MYSQL_PASSWORD: password, MYSQL_DATABASE: 'seed_test_fresh',
      MYSQL_BOOTSTRAP_RETRIES: '3', MYSQL_BOOTSTRAP_RETRY_DELAY_MS: '0', MYSQL_CONNECT_TIMEOUT_MS: '2000',
      MYSQL_BOOTSTRAP_LOCK_TIMEOUT_SECONDS: '30', REDIS_URL: 'redis://127.0.0.1:' + redisPort,
      MEMORY_SEMANTIC_INDEX_ENABLED: 'false', WORKFLOW_AUTO_RECOVER: 'false', QDRANT_URL: 'http://127.0.0.1:1',
      QDRANT_API_KEY: '', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      CHECKPOINT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'), NODE_NO_WARNINGS: '1' };
    const r = cp.spawnSync(process.execPath, [path.join(root, 'node_modules/jest/bin/jest.js'),
      '--config', 'backend/jest.config.js', '--runInBand', '--runTestsByPath',
      'backend/src/database/seeds/system-settings.integration.spec.ts'], { cwd: root, env, stdio: 'inherit', timeout: 240000 });
    if (r.status !== 0) throw Error('Database integration tests failed');
    console.log('PASS isolated MySQL initialization: fresh, repeat, admin override, partial, failure, concurrent processes, full NestJS HTTP');
  } finally {
    for (const name of created.reverse()) docker(['rm', '--force', name]);
    console.log('Temporary test containers removed; existing volumes untouched');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
