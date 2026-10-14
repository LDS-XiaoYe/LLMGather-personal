'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { validateCredentials } = require('./container-bootstrap.cjs');
try {
  const credentials = validateCredentials(JSON.parse(fs.readFileSync(path.join(process.env.AGENT_BOOTSTRAP_DIR || '/bootstrap', 'agent.json'), 'utf8')));
  const route = '/v1/ready', stamp = String(Date.now()), nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', credentials.token).update(['GET', route, stamp, nonce,
    crypto.createHash('sha256').update('').digest('hex')].join('\n')).digest('hex');
  const request = http.get({ hostname: '127.0.0.1', port: Number(process.env.AGENT_PORT || 19090), path: route, timeout: 3000,
    headers: { 'x-agent-id': credentials.id, 'x-agent-time': stamp, 'x-agent-nonce': nonce, 'x-agent-signature': signature } },
  response => { response.resume(); response.on('end', () => process.exit(response.statusCode === 200 ? 0 : 1)); });
  request.on('error', () => process.exit(1)); request.on('timeout', () => request.destroy());
} catch { process.exitCode = 1; }
