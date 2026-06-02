import 'dotenv/config';

const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000';
const platformApiKey = process.env.PLATFORM_API_KEY || '';
const model = process.env.SMOKE_TEST_MODEL || 'glm/glm-5.1';
const timeoutMs = Number(process.env.SMOKE_TEST_TIMEOUT_MS || 20000);

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'x-request-id': `smoke-${Date.now()}`,
  };

  if (platformApiKey) {
    headers['x-api-key'] = platformApiKey;
  }

  return headers;
}

async function main() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const payload = {
    model,
    messages: [{ role: 'user', content: '请用一句话回复：后端连通性测试成功。' }],
    temperature: 0,
    stream: false,
  };

  const startedAt = Date.now();

  try {
    const response = await fetch(`${backendBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;
    const requestId = response.headers.get('x-request-id') || '(missing)';
    const raw = await response.text();

    console.log(`HTTP ${response.status} (${elapsedMs}ms)`);
    console.log(`x-request-id: ${requestId}`);

    if (!response.ok) {
      console.log('response body:');
      console.log(raw || '(empty)');
      process.exitCode = 1;
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.log('response is not valid JSON:');
      console.log(raw);
      process.exitCode = 1;
      return;
    }

    const content = data?.choices?.[0]?.message?.content ?? '(empty)';
    console.log(`model: ${data?.model ?? '(unknown)'}`);
    console.log(`response id: ${data?.id ?? '(unknown)'}`);
    console.log(`assistant preview: ${String(content).slice(0, 200)}`);
    console.log('SMOKE TEST PASSED');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`SMOKE TEST FAILED: timeout after ${timeoutMs}ms`);
    } else {
      console.error(`SMOKE TEST FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exitCode = 1;
  } finally {
    clearTimeout(timeoutId);
  }
}

await main();
