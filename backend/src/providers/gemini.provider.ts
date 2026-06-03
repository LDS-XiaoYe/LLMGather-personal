import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ApiKeyPool } from './api-key-pool';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ContentPart,
  ModelDescriptor,
  ProviderAdapter,
} from './provider.types';

export interface GeminiProviderConfig {
  providerName: string;
  baseUrl: string;
  models: string[];
  timeoutMs?: number;
  retryCount?: number;
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { mime_type?: string; file_uri: string } };

type GeminiContent = {
  role?: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
    safetyRatings?: Array<{ category?: string; probability?: string }>;
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{ category?: string; probability?: string }>;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

export class GeminiProvider implements ProviderAdapter {
  public readonly providerName: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private keyPool: ApiKeyPool | null = null;

  constructor(private readonly config: GeminiProviderConfig) {
    this.providerName = config.providerName;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.retryCount = config.retryCount ?? 2;
  }

  setKeyPool(pool: ApiKeyPool): void {
    this.keyPool = pool;
  }

  isModelSupported(model: string): boolean {
    const normalized = this.normalizeModel(model);
    return this.config.models.includes(normalized);
  }

  listModels(): ModelDescriptor[] {
    return this.config.models.map((model) => ({
      id: model,
      object: 'model',
      owned_by: this.providerName,
    }));
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { response } = await this.fetchWithRetry(request, false);
    if (!response.ok) throw await this.buildProviderException(response);
    const data = (await response.json()) as GeminiResponse;
    return this.toOpenAiResponse(request, data);
  }

  async chatCompletionStream(request: ChatCompletionRequest): Promise<Response> {
    const { response } = await this.fetchWithRetry(request, true);
    if (!response.ok) throw await this.buildProviderException(response);
    if (!response.body) throw new ServiceUnavailableException(`${this.providerName} stream unavailable`);
    return this.toOpenAiStream(request, response);
  }

  private async fetchWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
  ): Promise<{ response: Response }> {
    if (!this.keyPool) throw new ServiceUnavailableException(`${this.providerName} API key pool is not configured`);
    let currentKey = this.keyPool.getRandomKey();
    let lastError = 'unknown error';
    const maxAttempts = stream ? 0 : this.retryCount;
    const requestTimeoutMs = stream ? Math.min(Math.max(this.timeoutMs, 45000), 50000) : this.timeoutMs;

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const model = encodeURIComponent(this.normalizeModel(request.model));
        const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
        const separator = method.includes('?') ? '&' : '?';
        const url = `${this.config.baseUrl.replace(/\/$/, '')}/models/${model}:${method}${separator}key=${encodeURIComponent(currentKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.toGeminiRequest(request)),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 429 && attempt < maxAttempts) {
          this.keyPool.markRateLimited(currentKey);
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        if (response.status >= 500 && attempt < maxAttempts) {
          this.keyPool.markRetryableFailure(currentKey);
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        return { response };
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          const detail = stream
            ? `stream did not start within ${requestTimeoutMs}ms: ${lastError}`
            : `request failed after retries: ${lastError}`;
          throw new ServiceUnavailableException(`${this.providerName} ${detail}`);
        }
        this.keyPool.markRetryableFailure(currentKey);
        currentKey = this.keyPool.getRandomKey();
      }
    }

    throw new ServiceUnavailableException(`${this.providerName} request failed: ${lastError}`);
  }

  private toGeminiRequest(request: ChatCompletionRequest): Record<string, unknown> {
    const systemInstructionParts: GeminiPart[] = [];
    const contents: GeminiContent[] = [];

    for (const message of request.messages) {
      const parts = this.toGeminiParts(message);
      if (message.role === 'system') {
        systemInstructionParts.push(...parts);
        continue;
      }
      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.top_p !== undefined) generationConfig.topP = request.top_p;
    if (request.max_tokens !== undefined) generationConfig.maxOutputTokens = request.max_tokens;

    const payload: Record<string, unknown> = { contents };
    if (systemInstructionParts.length) payload.systemInstruction = { parts: systemInstructionParts };
    if (Object.keys(generationConfig).length) payload.generationConfig = generationConfig;
    return payload;
  }

  private toGeminiParts(message: ChatMessage): GeminiPart[] {
    if (typeof message.content === 'string') return [{ text: message.content }];
    return message.content.map((part) => this.toGeminiPart(part));
  }

  private toGeminiPart(part: ContentPart): GeminiPart {
    if (part.type === 'text') return { text: part.text };
    const url = part.image_url.url;
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { inline_data: { mime_type: match[1], data: match[2] } };
    }
    return { file_data: { file_uri: url } };
  }

  private toOpenAiResponse(request: ChatCompletionRequest, data: GeminiResponse): ChatCompletionResponse {
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (!content) {
      throw new BadGatewayException(this.describeEmptyResponse(data));
    }
    const usage = data.usageMetadata;
    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: this.normalizeFinishReason(candidate?.finishReason),
      }],
      usage: usage
        ? {
            prompt_tokens: usage.promptTokenCount ?? 0,
            completion_tokens: usage.candidatesTokenCount ?? 0,
            total_tokens: usage.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  private toOpenAiStream(request: ChatCompletionRequest, response: Response): Response {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const model = request.model;
    const providerName = this.providerName;
    const describeEmptyResponse = this.describeEmptyResponse.bind(this);
    let buffer = '';
    let emittedText = false;
    let lastEmptyReason = '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response.body!.getReader();
        const emitChunk = (content: string, finishReason: string | null = null) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: `gemini-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: { content }, finish_reason: finishReason }],
          })}\n\n`));
        };
        const parseEventPayloads = (event: string): string[] => {
          const dataLines = event
            .split(/\r?\n/)
            .filter((line) => line.trimStart().startsWith('data:'))
            .map((line) => line.slice(line.indexOf('data:') + 5).trim())
            .filter(Boolean);
          if (dataLines.length > 0) return dataLines;
          const trimmed = event.trim();
          return trimmed ? [trimmed] : [];
        };
        const handlePayload = (dataLine: string) => {
          if (dataLine === '[DONE]') return;
          try {
            const data = JSON.parse(dataLine) as GeminiResponse;
            if (data.error?.message) {
              lastEmptyReason = data.error.message;
              emitChunk(`Gemini 请求失败：${data.error.message}`, 'error');
              emittedText = true;
              return;
            }
            const candidate = data.candidates?.[0];
            if (!candidate?.content?.parts?.length || candidate.finishReason || data.promptFeedback?.blockReason) {
              lastEmptyReason = describeEmptyResponse(data);
            }
            const text = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
            if (!text) return;
            emittedText = true;
            emitChunk(text);
          } catch {
            // Ignore malformed SSE fragments.
          }
        };
        const handleEvent = (event: string) => {
          for (const payload of parseEventPayloads(event)) {
            handlePayload(payload);
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n+/);
            buffer = events.pop() || '';
            for (const event of events) {
              handleEvent(event);
            }
          }
          const trailing = buffer.trim();
          if (trailing) handleEvent(trailing);
          if (!emittedText) {
            const message = lastEmptyReason || `${providerName} returned an empty response`;
            emitChunk(message, 'error');
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  private async buildProviderException(response: Response): Promise<BadGatewayException> {
    let detail = response.statusText;
    try {
      const data = (await response.json()) as GeminiResponse;
      if (data.error?.message) detail = data.error.message;
    } catch {}
    return new BadGatewayException(`${this.providerName} request failed (${response.status}): ${detail}`);
  }

  private normalizeModel(model: string): string {
    return model.startsWith('models/') ? model.slice('models/'.length) : model;
  }

  private normalizeFinishReason(reason?: string): string {
    if (!reason) return 'stop';
    if (reason === 'STOP') return 'stop';
    if (reason === 'MAX_TOKENS') return 'length';
    return reason.toLowerCase();
  }

  private describeEmptyResponse(data: GeminiResponse): string {
    const candidate = data.candidates?.[0];
    const parts: string[] = [`${this.providerName} returned no text`];
    if (data.promptFeedback?.blockReason) {
      parts.push(`prompt blocked: ${data.promptFeedback.blockReason}`);
    }
    if (candidate?.finishReason) {
      parts.push(`finish reason: ${candidate.finishReason}`);
    }
    const safety = candidate?.safetyRatings || data.promptFeedback?.safetyRatings || [];
    const activeSafety = safety
      .filter((item) => item.category || item.probability)
      .map((item) => `${item.category || 'unknown'}=${item.probability || 'unknown'}`)
      .slice(0, 4);
    if (activeSafety.length) {
      parts.push(`safety: ${activeSafety.join(', ')}`);
    }
    if (data.error?.message) {
      parts.push(data.error.message);
    }
    return parts.join('; ');
  }
}
