import { ApiKeyPool } from './api-key-pool';
import { GeminiProvider } from './gemini.provider';

function makeProvider(): GeminiProvider {
  const provider = new GeminiProvider({
    providerName: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-3.5-flash'],
    retryCount: 0,
  });
  provider.setKeyPool(new ApiKeyPool(['gemini-test-key']));
  return provider;
}

describe('GeminiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('matches configured models and models/ prefixed ids', () => {
    const provider = makeProvider();
    expect(provider.isModelSupported('gemini-3.5-flash')).toBe(true);
    expect(provider.isModelSupported('models/gemini-3.5-flash')).toBe(true);
    expect(provider.isModelSupported('gemini-2.5-flash')).toBe(false);
    expect(provider.isModelSupported('qwen-plus')).toBe(false);
  });

  it('converts OpenAI style chat requests to Gemini generateContent requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hello from gemini' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const provider = makeProvider();
    const result = await provider.chatCompletion({
      model: 'gemini-3.5-flash',
      temperature: 0.3,
      top_p: 0.8,
      max_tokens: 128,
      messages: [
        { role: 'system', content: 'Be concise.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image.' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          ],
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'gemini-test-key',
    });

    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: 'Be concise.' }] },
      generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 128 },
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Describe this image.' },
            { inlineData: { mimeType: 'image/png', data: 'abc123' } },
          ],
        },
      ],
    });
    expect(result.choices[0].message.content).toBe('hello from gemini');
    expect(result.choices[0].finish_reason).toBe('stop');
    expect(result.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 });
  });

  it('maps multi-turn messages, thinking config, safety, structured output, and tools', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    await makeProvider().chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Use a tool if needed' },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'lookup',
          description: 'Lookup data',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'lookup' } },
      extra_body: {
        thinking_config: { thinking_level: 'medium', include_thoughts: true },
        safety_settings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }],
        response_mime_type: 'application/json',
        response_schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        cached_content: 'cachedContents/test-cache',
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: 'System prompt' }] },
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there' }] },
        { role: 'user', parts: [{ text: 'Use a tool if needed' }] },
      ],
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'medium', includeThoughts: true },
        responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
      safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }],
      tools: [{
        functionDeclarations: [{
          name: 'lookup',
          description: 'Lookup data',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        }],
      }],
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['lookup'] },
      },
      cachedContent: 'cachedContents/test-cache',
    });
    expect(body.generationConfig.thinkingConfig.thinking_level).toBeUndefined();
    expect(body.generationConfig.thinkingConfig.include_thoughts).toBeUndefined();
  });

  it('wraps Gemini SSE chunks as OpenAI-compatible stream chunks', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const response = await makeProvider().chatCompletionStream({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });

    const text = await response.text();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse',
    );
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'gemini-test-key',
      Accept: 'text/event-stream',
    });
    expect(text).toContain('"object":"chat.completion.chunk"');
    expect(text).toContain('"content":"hi"');
    expect(text).toContain('data: [DONE]');
  });

  it('emits Gemini thought summary parts as reasoning_content in streams', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        'data: {"candidates":[{"content":{"parts":[{"text":"Thinking...","thought":true},{"text":"Answer."}]}}]}\n\n',
        { status: 200 },
      ),
    );

    const response = await makeProvider().chatCompletionStream({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'reason' }],
      stream: true,
      extra_body: { enable_thinking: true },
    });

    const text = await response.text();
    expect(text).toContain('"reasoning_content":"Thinking..."');
    expect(text).toContain('"content":"Answer."');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.thinkingConfig).toEqual({ includeThoughts: true });
  });

  it('parses CRLF SSE chunks and trailing events without a blank-line terminator', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\r\n\r\n' +
          'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}',
        { status: 200 },
      ),
    );

    const response = await makeProvider().chatCompletionStream({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });

    const text = await response.text();
    expect(text).toContain('"content":"hello"');
    expect(text).toContain('"content":" world"');
    expect(text).not.toContain('returned an empty response');
  });

  it('parses raw JSON stream fragments when the provider omits data prefixes', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        '{"candidates":[{"content":{"parts":[{"text":"raw json"}]}}]}',
        { status: 200 },
      ),
    );

    const response = await makeProvider().chatCompletionStream({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });

    const text = await response.text();
    expect(text).toContain('"content":"raw json"');
    expect(text).not.toContain('returned an empty response');
  });

  it('throws a readable error when Gemini returns no text in non-stream mode', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ finishReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_TEST', probability: 'HIGH' }] }],
        }),
        { status: 200 },
      ),
    );

    await expect(makeProvider().chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toThrow('finish reason: SAFETY');
  });

  it('surfaces Gemini provider error details from non-JSON responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('upstream html error', { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(makeProvider().chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toThrow('upstream html error');
  });

  it('emits an explanatory stream chunk when Gemini stream has no text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        'data: {"candidates":[{"finishReason":"SAFETY"}]}\n\n',
        { status: 200 },
      ),
    );

    const response = await makeProvider().chatCompletionStream({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });

    const text = await response.text();
    expect(text).toContain('gemini returned no text');
    expect(text).toContain('finish reason: SAFETY');
    expect(text).toContain('data: [DONE]');
  });
});
