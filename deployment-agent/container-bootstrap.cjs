'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, randomBytes } = require('node:crypto');

function validateCredentials(value) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value?.id) ||
      typeof value.token !== 'string' || value.token.length < 32 || value.token.length > 512) {
    throw Error('Invalid persisted deployment node credentials');
  }
  return value;
}
async function ensureCredentials(directory) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'agent.json');
  try { return validateCredentials(JSON.parse(await fs.readFile(file, 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let temporary;
  try {
    const credentials = { id: randomUUID(), token: randomBytes(48).toString('hex') };
    temporary = path.join(directory, '.agent-' + randomUUID() + '.tmp');
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(credentials)); await handle.sync(); }
    finally { await handle.close(); }
    // Publish a complete inode without overwrite. Concurrent starts converge, and a killed
    // initializer cannot leave a stale lock or a partially written identity at the final path.
    try { await fs.link(temporary, file); return credentials; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return validateCredentials(JSON.parse(await fs.readFile(file, 'utf8')));
    }
  } finally {
    if (temporary) await fs.unlink(temporary).catch(() => {});
  }
}
async function start() {
  const credentials = await ensureCredentials(process.env.AGENT_BOOTSTRAP_DIR || '/bootstrap');
  process.env.AGENT_ID = credentials.id;
  process.env.AGENT_TOKEN = credentials.token;
  // Models share this Agent's private network namespace; no host networking or published model ports.
  process.env.AGENT_NETWORK_CONTAINER = os.hostname();
  console.log('Default deployment node identity ready; persisted credential reused across restarts');
  return require('./server.cjs').start();
}
if (require.main === module) start().catch(() => {
  console.error('Default deployment node startup failed; inspect persisted identity and Docker availability');
  process.exitCode = 1;
});
module.exports = { ensureCredentials, validateCredentials, start };
