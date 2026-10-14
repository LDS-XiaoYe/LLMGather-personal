import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMemoryContextService } from './chat-memory-context.service';

function fixture() {
  const memory = { chatContext: jest.fn().mockResolvedValue([{ id: 'test', userId: 'owner', agentId: null, memoryType: 'fact', content: '测试项目代号：银杏' }]) };
  const completion = { id: 'reply', choices: [{ message: { role: 'assistant', content: '银杏' } }], usage: { prompt_tokens: 20, completion_tokens: 2, total_tokens: 22 } };
  const provider = { providerName: 'test', chatCompletion: jest.fn().mockResolvedValue(completion), chatCompletionStream: jest.fn().mockImplementation(async () => new Response('data: {"choices":[{"delta":{"content":"银杏"}}]}\n\ndata: [DONE]\n\n')) };
  const chat = new ChatService({ resolveProvider: () => provider } as any);
  const billing = { reserveForStream: jest.fn().mockReturnValue({ prompt_tokens: 20 }), chargeForCompletion: jest.fn().mockResolvedValue({ credits: 1 }) };
  const cache = { lookup: jest.fn().mockResolvedValue({ id: 'old', response: '旧缓存答案', tokensSaved: 99 }), store: jest.fn().mockResolvedValue(null) };
  const router = { route: jest.fn().mockResolvedValue({ model: 'model', decision: { selectedModel: 'model', intent: 'general', reason: 'test', targetType: 'model' } }), recordCompletion: jest.fn() };
  const controller = new ChatController(chat, billing as any, cache as any, router as any, {} as any, new ChatMemoryContextService(memory as any));
  const headers = new Map<string, string>(), writes: string[] = [];
  const response = { setHeader: jest.fn((key, value) => headers.set(key, value)), json: jest.fn(), end: jest.fn(), write: jest.fn(text => writes.push(text)), flushHeaders: jest.fn() };
  return { controller, provider, billing, cache, router, memory, response, headers, writes };
}

describe.each(['model', 'auto'])('%s chat completion', model => {
  test.each([true, false])('stream=%s delivers real memory context to provider and billing, without stale cache', async stream => {
    const f = fixture();const original = { model, memory_enabled: true, stream, messages: [{ role: 'user' as const, content: '项目代号是什么？' }] };
    await f.controller.completions(original, { id: 'owner', username: 'owner', role: 'user' }, f.response as any);
    expect(f.memory.chatContext).toHaveBeenCalledWith('owner', '项目代号是什么？');
    const payload = (stream ? f.provider.chatCompletionStream : f.provider.chatCompletion).mock.calls[0][0];
    expect(JSON.stringify(payload.messages)).toContain('测试项目代号：银杏');
    expect(payload.messages.at(-1).content).toBe('项目代号是什么？');expect(payload).not.toHaveProperty('memory_enabled');expect(original.messages).toHaveLength(1);
    expect(f.headers.get('x-memory-count')).toBe('1');expect(f.headers.get('x-memory-status')).toBe('applied');
    expect(f.cache.lookup).not.toHaveBeenCalled();expect(f.cache.store).not.toHaveBeenCalled();expect(f.billing.chargeForCompletion.mock.calls[0][1]).toBe(payload);
    if (stream) { expect(f.response.end).toHaveBeenCalled();expect(f.writes.join('')).toContain('银杏'); } else expect(f.response.json).toHaveBeenCalled();
    if (model === 'auto') expect(f.router.route).toHaveBeenCalled();
  });
});

test('empty or unavailable memory still bypasses old answer cache and reports the true status', async () => {
  for (const unavailable of [false, true]) {
    const f = fixture();if (unavailable) f.memory.chatContext.mockRejectedValueOnce(new Error('offline'));else f.memory.chatContext.mockResolvedValueOnce([]);
    await f.controller.completions({ model: 'model', memory_enabled: true, messages: [{ role: 'user', content: '问题' }] }, { id: 'owner', username: '', role: 'user' }, f.response as any);
    expect(f.headers.get('x-memory-status')).toBe(unavailable ? 'unavailable' : 'empty');expect(f.headers.get('x-memory-count')).toBe('0');expect(f.cache.lookup).not.toHaveBeenCalled();expect(f.cache.store).not.toHaveBeenCalled();
  }
});

test('API requests that did not opt into personal memory retain their existing cache behavior', async () => {
  const f = fixture();await f.controller.completions({ model: 'model', messages: [{ role: 'user', content: '问题' }] }, { id: 'owner', username: '', role: 'user' }, f.response as any);
  expect(f.memory.chatContext).not.toHaveBeenCalled();expect(f.cache.lookup).toHaveBeenCalledWith('owner', '问题', 'model');expect(f.response.json.mock.calls[0][0].choices[0].message.content).toBe('旧缓存答案');
});

test('form rewriting can disable semantic cache without exposing the flag to the provider', async () => {
  const f=fixture();await f.controller.completions({model:'model',cache_enabled:false,messages:[{role:'user',content:'改写字段'}]},{id:'owner',username:'',role:'user'},f.response as any);
  expect(f.cache.lookup).not.toHaveBeenCalled();expect(f.cache.store).not.toHaveBeenCalled();expect(f.provider.chatCompletion.mock.calls[0][0]).not.toHaveProperty('cache_enabled');
});
