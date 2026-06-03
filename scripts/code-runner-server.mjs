import http from 'node:http';
import { Script, createContext } from 'node:vm';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.CODE_RUNNER_PORT || 8787);
const MAX_CODE_LENGTH = Number(process.env.CODE_RUNNER_MAX_CODE_LENGTH || 10000);
const TIMEOUT_MS = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 5000);
const TEMP_DIR = '/tmp/code-runner';

// 确保临时目录存在
try { mkdirSync(TEMP_DIR, { recursive: true }); } catch {}

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

// JavaScript 执行器
function runJavascript(code, input) {
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

// Python 执行器
function runPython(code, input) {
  if (!code || code.length > MAX_CODE_LENGTH) {
    throw new Error('code is empty or too long');
  }

  const id = randomUUID();
  const codeFile = join(TEMP_DIR, `${id}.py`);
  const inputFile = join(TEMP_DIR, `${id}_input.json`);

  // 包装代码，添加输入处理和结果捕获
  const wrappedCode = `
import json
import sys
import io

# 重定向stdout以捕获print输出
captured_output = io.StringIO()
sys.stdout = captured_output

# 读取输入
with open('${inputFile}', 'r') as f:
    input_data = json.load(f)

input = input_data

# 用户代码
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)

# 恢复stdout并获取输出
sys.stdout = sys.__stdout__
output = captured_output.getvalue()

# 尝试获取result变量
result = None
try:
    result = eval('result') if 'result' in dir() else None
except:
    pass

print(json.dumps({"result": result, "logs": output.strip().split('\\n') if output.strip() else []}, ensure_ascii=False, default=str))
`;

  try {
    writeFileSync(codeFile, wrappedCode);
    writeFileSync(inputFile, JSON.stringify(input));

    const output = execSync(`python3 "${codeFile}"`, {
      timeout: TIMEOUT_MS,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return JSON.parse(output.trim());
  } catch (error) {
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    throw new Error(stderr || stdout || error.message);
  } finally {
    try { unlinkSync(codeFile); } catch {}
    try { unlinkSync(inputFile); } catch {}
  }
}

// TypeScript 执行器（编译为JS后执行）
function runTypescript(code, input) {
  // 简单处理：移除类型注解后作为JS执行
  const jsCode = code
    .replace(/:\s*\w+(\[\])?/g, '')  // 移除类型注解
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')  // 移除interface
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');  // 移除type别名
  return runJavascript(jsCode, input);
}

// 语言路由
function runCode(language, code, input) {
  switch (language?.toLowerCase()) {
    case 'python':
    case 'py':
      return runPython(code, input);
    case 'typescript':
    case 'ts':
      return runTypescript(code, input);
    case 'javascript':
    case 'js':
    default:
      return runJavascript(code, input);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ ok: true, supportedLanguages: ['javascript', 'python', 'typescript'] }));
    return;
  }
  
  if (req.method === 'GET' && req.url === '/languages') {
    res.end(JSON.stringify({
      languages: [
        { id: 'javascript', name: 'JavaScript', extensions: ['.js'] },
        { id: 'python', name: 'Python', extensions: ['.py'] },
        { id: 'typescript', name: 'TypeScript', extensions: ['.ts'] },
      ]
    }));
    return;
  }
  
  if (req.method !== 'POST' || req.url !== '/run') {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  
  try {
    const payload = JSON.parse(await readBody(req));
    const language = payload.language || 'javascript';
    const code = String(payload.code || '');
    const input = payload.input ?? {};
    
    const output = runCode(language, code, input);
    res.end(JSON.stringify(output, null, 2));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[code-runner] listening on ${PORT}`);
  console.log(`[code-runner] supported languages: javascript, python, typescript`);
});
