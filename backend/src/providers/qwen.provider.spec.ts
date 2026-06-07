import { QwenProvider } from './qwen.provider';
import type { OpenAiCompatibleConfig } from './openai-compatible.provider';

function makeConfig(): OpenAiCompatibleConfig {
  return {
    providerName: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeys: ['sk-test'],
    apiKey: '',
    models: ['qwen-vl-plus-latest'],
    retryCount: 0,
  };
}

describe('QwenProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes multimodal content before sending to DashScope compatible API', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ok',
          object: 'chat.completion',
          created: 1,
          model: 'qwen-vl-plus-latest',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const provider = new QwenProvider(makeConfig());
    await provider.chatCompletion({
      model: 'qwen-vl-plus-latest',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } },
          { type: 'text', text: '请描述图片' },
          { type: 'text', text: '   ' },
          { type: 'unknown', value: true } as any,
        ],
      }],
    });

    const request = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.messages[0].content).toEqual([
      { type: 'text', text: '请描述图片' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } },
    ]);
  });
});
