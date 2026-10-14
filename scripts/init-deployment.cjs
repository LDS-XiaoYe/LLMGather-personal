#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const ROOT = path.resolve(__dirname, '..');

function readKey(source) {
  const entries = source.split(/\r?\n/).filter(line => /^\s*(?:export\s+)?QDRANT_API_KEY\s*=/.test(line));
  if (entries.length > 1) throw new Error('QDRANT_API_KEY is defined more than once; keep one definition.');
  let value = entries.length ? entries[0].slice(entries[0].indexOf('=') + 1).trim() : '';
  if (value.startsWith("'") || value.startsWith('"')) {
    const quote = value[0];
    const end = value.indexOf(quote, 1);
    if (end < 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1))) throw new Error('Malformed QDRANT_API_KEY value.');
    value = value.slice(1, end);
  } else value = value.replace(/(?:^|\s+)#.*$/, '').trim();
  return value;
}

async function initialize({ envFile = path.join(ROOT, '.env'), template = path.join(ROOT, '.env.example'), dev = false } = {}) {
  envFile = path.resolve(envFile);
  const lock = envFile + '.init.lock';
  const deadline = Date.now() + 30000;
  while (true) {
    try { fs.mkdirSync(lock, { mode: 0o700 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error('Deployment initialization is locked; check for another initializer.');
      await delay(50);
    }
  }
  let temporary;
  try {
    const created = !fs.existsSync(envFile);
    const legacy = path.join(path.dirname(envFile), '.env.docker');
    const migrated = created && path.basename(envFile) === '.env' && fs.existsSync(legacy);
    let source = fs.readFileSync(created ? (migrated ? legacy : template) : envFile, 'utf8');
    const original = source;
    if (created && !migrated && dev) source = source.replace(/^FRONTEND_ORIGIN=.*$/m, 'FRONTEND_ORIGIN=http://localhost:5174');
    const existing = readKey(source);
    const keyGenerated = !existing || existing === 'replace-with-a-random-qdrant-key';
    if (keyGenerated) {
      const key = randomBytes(32).toString('hex');
      const pattern = /^(\s*(?:export\s+)?QDRANT_API_KEY\s*=)[^\r\n]*/m;
      source = pattern.test(source) ? source.replace(pattern, (_, prefix) => prefix + key) : source + (source.endsWith('\n') ? '' : '\n') + 'QDRANT_API_KEY=' + key + '\n';
    }
    if (created || source !== original) {
      temporary = envFile + '.init-' + randomUUID() + '.tmp';
      const descriptor = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(descriptor, source); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, envFile);
      temporary = undefined;
    }
    fs.chmodSync(envFile, 0o600);
    return { envFile, created, migrated, keyGenerated };
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(lock);
  }
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dev') options.dev = true;
    else if (args[i] === '--env-path' && args[i + 1]) options.envFile = path.resolve(args[++i]);
    else throw new Error('Usage: node scripts/init-deployment.cjs [--dev] [--env-path PATH]');
  }
  const result = await initialize(options);
  console.log(`Deployment environment ${result.created ? (result.migrated ? 'migrated from .env.docker' : 'created') : 'reused'}: ${result.envFile}`);
  console.log(`QDRANT_API_KEY ${result.keyGenerated ? 'generated and saved' : 'reused'}; secret value is not printed.`);
}

module.exports = { initialize, readKey };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
