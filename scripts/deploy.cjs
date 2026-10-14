#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initialize } = require('./init-deployment.cjs');

async function main(args) {
  const dev = args[0] === '--dev';
  if (dev) args.shift();
  if (args[0] === '--') args.shift();
  const root = path.resolve(__dirname, '..');
  const result = await initialize({ dev });
  console.log(`Deployment environment ready; Qdrant key ${result.keyGenerated ? 'generated' : 'reused'}.`);
  const env = { ...process.env, LLMGATHER_ENV_FILE: result.envFile };
  // Compose interpolation and backend env_file must use the persisted file, not an ambient key.
  delete env.QDRANT_API_KEY;
  const defaults = dev ? ['up', '-d'] : ['up', '-d', '--build'];
  const child = spawnSync('docker', ['compose', '--env-file', result.envFile, '-f', dev ? 'docker-compose.yml' : 'docker-compose.prod.yml', ...(args.length ? args : defaults)], { cwd: root, env, stdio: 'inherit' });
  if (child.error) throw child.error;
  process.exitCode = child.status === null ? 1 : child.status;
}

main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
