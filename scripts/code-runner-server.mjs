import http from 'node:http';
import { Script, createContext } from 'node:vm';

const PORT = Number(process.env.CODE_RUNNER_PORT || 8787);
const MAX_CODE_LENGTH = Number(process.env.CODE_RUNNER_MAX_CODE_LENGTH || 4000);
const TIMEOUT_MS = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 1000);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 128_000) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function stringify(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function runCode(code, input) {
  if (!code || code.length > MAX_CODE_LENGTH) {
    throw new Error('code is empty or too long');
  }
  const logs = [];
  const sandbox = createContext({
    input,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    RegExp,
    console: {
      log: (...items) => logs.push(items.map(stringify).join(' ')),
    },
  });
  const script = new Script(`"use strict";\n${code}`);
  const result = script.runInContext(sandbox, { timeout: TIMEOUT_MS });
  return { result, logs };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/run') {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  try {
    const payload = JSON.parse(await readBody(req));
    const output = runCode(String(payload.code || ''), payload.input ?? {});
    res.end(JSON.stringify(output, null, 2));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[code-runner] listening on ${PORT}`);
});
