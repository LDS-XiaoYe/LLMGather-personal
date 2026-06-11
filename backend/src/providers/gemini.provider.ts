import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ApiKeyPool } from './api-key-pool';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ContentPart,
  ModelDescriptor,
  ProviderAdapter,
  ProviderKeyAuditInfo,
  ProviderKeyRotationInfo,
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
  | { text: string; thought: true }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType?: string; fileUri: string } }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role?: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean; functionCall?: { name?: string; args?: Record<string, unknown> } }> };
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

type GeminiRequest = {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: Record<string, unknown>;
  safetySettings?: unknown[];
  tools?: unknown[];
  toolConfig?: Record<string, unknown>;
  cachedContent?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function firstValue<T = unknown>(record: Record<string, unknown> | undefined, ...keys: string[]): T | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key] as T;
  }
  return undefined;
}

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
    const { response, rotation, audit } = await this.fetchWithRetry(request, false);
    if (!response.ok) throw await this.buildProviderException(response);
    const data = (await response.json()) as GeminiResponse;
    const completion = this.toOpenAiResponse(request, data);
    attachKeyRotation(completion, rotation);
    attachKeyAudit(completion, audit);
    return completion;
  }

  async chatCompletionStream(request: ChatCompletionRequest): Promise<Response> {
    const { response, rotation, audit } = await this.fetchWithRetry(request, true);
    if (!response.ok) throw await this.buildProviderException(response);
    if (!response.body) throw new ServiceUnavailableException(`${this.providerName} stream unavailable`);
    return withProviderAuditHeaders(this.toOpenAiStream(request, response), rotation, audit);
  }

  private async fetchWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
  ): Promise<{ response: Response; rotation?: ProviderKeyRotationInfo; audit?: ProviderKeyAuditInfo }> {
    if (!this.keyPool) throw new ServiceUnavailableException(`${this.providerName} API key pool is not configured`);
    let currentKey = this.keyPool.getRandomKey();
    let lastError = 'unknown error';
    let rotation: ProviderKeyRotationInfo | undefined;
    const maxAttempts = this.retryCount;
    const requestTimeoutMs = stream ? Math.min(Math.max(this.timeoutMs, 45000), 50000) : this.timeoutMs;

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const model = encodeURIComponent(this.normalizeModel(request.model));
        const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
        const url = `${this.config.baseUrl.replace(/\/$/, '')}/models/${model}:${method}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': currentKey,
            ...(stream ? { Accept: 'text/event-stream' } : {}),
          },
          body: JSON.stringify(this.toGeminiRequest(request)),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 429 && attempt < maxAttempts) {
          this.keyPool.markRateLimited(currentKey, `HTTP ${response.status}`);
          rotation = { provider: this.providerName, attempts: attempt + 1, reason: 'rate_limit' };
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        if (attempt < maxAttempts && this.keyPool.usableCount() > 1 && await isBalanceExhaustedResponse(response)) {
          this.keyPool.markBalanceExhausted(currentKey, `HTTP ${response.status}`);
          rotation = { provider: this.providerName, attempts: attempt + 1, reason: 'balance_exhausted' };
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        if ([401, 403].includes(response.status) && attempt < maxAttempts && this.keyPool.usableCount() > 1) {
          this.keyPool.markAuthenticationFailure(currentKey, `HTTP ${response.status}`);
          rotation = { provider: this.providerName, attempts: attempt + 1, reason: 'retryable_failure' };
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        if (response.status >= 500 && attempt < maxAttempts) {
          this.keyPool.markRetryableFailure(currentKey, `HTTP ${response.status}`);
          rotation = { provider: this.providerName, attempts: attempt + 1, reason: 'retryable_failure' };
          currentKey = this.keyPool.getRandomKey();
          continue;
        }

        if (response.ok) {
          this.keyPool.markSuccess(currentKey);
        } else if ([401, 403].includes(response.status)) {
          this.keyPool.markAuthenticationFailure(currentKey, `HTTP ${response.status}`);
        }
        return { response, rotation, audit: this.describeCurrentKey(currentKey) };
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          const detail = stream
            ? `stream did not start within ${requestTimeoutMs}ms: ${lastError}`
            : `request failed after retries: ${lastError}`;
          throw new ServiceUnavailableException(`${this.providerName} ${detail}`);
        }
        this.keyPool.markNetworkFailure(currentKey, lastError);
        rotation = { provider: this.providerName, attempts: attempt + 1, reason: 'network' };
        currentKey = this.keyPool.getRandomKey();
      }
    }

    throw new ServiceUnavailableException(`${this.providerName} request failed: ${lastError}`);
  }

  private describeCurrentKey(key: string): ProviderKeyAuditInfo {
    const descriptor = this.keyPool?.describeKey(key);
    return {
      provider: this.providerName,
      keyId: descriptor?.id ?? null,
      keyName: descriptor?.name ?? '未知 Key',
      keyPrefix: descriptor?.keyPrefix ?? maskKey(key),
      keySource: descriptor?.source ?? 'env',
    };
  }

  private toGeminiRequest(request: ChatCompletionRequest): GeminiRequest {
    const extra = isRecord(request.extra_body) ? request.extra_body : {};
    const rawGemini = firstRecord(extra.gemini, extra.google, extra.geminiRequest);
    const systemInstructionParts: GeminiPart[] = [];
    const contents: GeminiContent[] = [];

    for (const message of request.messages) {
      const parts = this.toGeminiParts(message);
      if (!parts.length) continue;
      if (message.role === 'system') {
        systemInstructionParts.push(...parts);
        continue;
      }
      contents.push({
        role: this.toGeminiRole(message.role),
        parts,
      });
    }

    if (!contents.length && systemInstructionParts.length) {
      contents.push({ role: 'user', parts: systemInstructionParts.splice(0) });
    }
    if (!contents.length) {
      contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    const generationConfig = this.toGenerationConfig(request, extra, rawGemini);
    const payload: GeminiRequest = { contents };
    const rawSystemInstruction = firstValue<{ parts?: GeminiPart[] }>(rawGemini, 'systemInstruction', 'system_instruction')
      || firstValue<{ parts?: GeminiPart[] }>(extra, 'systemInstruction', 'system_instruction');
    if (rawSystemInstruction) payload.systemInstruction = rawSystemInstruction as { parts: GeminiPart[] };
    else if (systemInstructionParts.length) payload.systemInstruction = { parts: systemInstructionParts };
    if (Object.keys(generationConfig).length) payload.generationConfig = generationConfig;

    const safetySettings = firstValue<unknown[]>(rawGemini, 'safetySettings', 'safety_settings')
      || firstValue<unknown[]>(extra, 'safetySettings', 'safety_settings');
    if (Array.isArray(safetySettings)) payload.safetySettings = safetySettings;

    const tools = firstValue<unknown[]>(rawGemini, 'tools') || firstValue<unknown[]>(extra, 'tools') || this.toGeminiTools(request);
    if (Array.isArray(tools) && tools.length) payload.tools = tools;

    const toolConfig = firstRecord(
      firstValue(rawGemini, 'toolConfig', 'tool_config'),
      firstValue(extra, 'toolConfig', 'tool_config'),
      this.toGeminiToolConfig(request),
    );
    if (toolConfig && Object.keys(toolConfig).length) payload.toolConfig = toolConfig;

    const cachedContent = firstValue<string>(rawGemini, 'cachedContent', 'cached_content')
      || firstValue<string>(extra, 'cachedContent', 'cached_content');
    if (cachedContent) payload.cachedContent = cachedContent;

    return payload;
  }

  private toGeminiParts(message: ChatMessage): GeminiPart[] {
    const parts: GeminiPart[] = [];
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        const name = call.function?.name;
        if (!name) continue;
        parts.push({
          functionCall: {
            name,
            args: this.safeJsonObject(call.function?.arguments),
          },
        });
      }
    }
    if (message.role === 'tool') {
      const name = message.name || message.tool_call_id || 'tool_result';
      return [{
        functionResponse: {
          name,
          response: this.toolResponseObject(message.content),
        },
      }];
    }
    if (typeof message.content === 'string') {
      if (message.content) parts.push({ text: message.content });
      return parts;
    }
    parts.push(...message.content.map((part) => this.toGeminiPart(part)).filter((part): part is GeminiPart => Boolean(part)));
    return parts;
  }

  private toGeminiRole(role: ChatMessage['role']): 'user' | 'model' {
    return role === 'assistant' ? 'model' : 'user';
  }

  private toGenerationConfig(
    request: ChatCompletionRequest,
    extra: Record<string, unknown>,
    rawGemini?: Record<string, unknown>,
  ): Record<string, unknown> {
    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.top_p !== undefined) generationConfig.topP = request.top_p;
    if (request.max_tokens !== undefined) generationConfig.maxOutputTokens = request.max_tokens;

    const directMappings: Array<[string, string[]]> = [
      ['topK', ['topK', 'top_k']],
      ['candidateCount', ['candidateCount', 'candidate_count']],
      ['responseMimeType', ['responseMimeType', 'response_mime_type']],
      ['responseSchema', ['responseSchema', 'response_schema']],
      ['seed', ['seed']],
      ['presencePenalty', ['presencePenalty', 'presence_penalty']],
      ['frequencyPenalty', ['frequencyPenalty', 'frequency_penalty']],
      ['responseLogprobs', ['responseLogprobs', 'response_logprobs']],
      ['logprobs', ['logprobs']],
      ['mediaResolution', ['mediaResolution', 'media_resolution']],
    ];
    for (const [geminiKey, aliases] of directMappings) {
      const value = firstValue(rawGemini, ...aliases) ?? firstValue(extra, ...aliases);
      if (value !== undefined) generationConfig[geminiKey] = value;
    }

    const stopSequences = firstValue<string[] | string>((request as unknown as Record<string, unknown>), 'stop')
      ?? firstValue<string[] | string>(rawGemini, 'stopSequences', 'stop_sequences')
      ?? firstValue<string[] | string>(extra, 'stopSequences', 'stop_sequences');
    if (typeof stopSequences === 'string') generationConfig.stopSequences = [stopSequences];
    else if (Array.isArray(stopSequences)) generationConfig.stopSequences = stopSequences;

    const rawGenerationConfig = firstRecord(
      firstValue(rawGemini, 'generationConfig', 'generation_config'),
      firstValue(extra, 'generationConfig', 'generation_config'),
    );
    if (rawGenerationConfig) Object.assign(generationConfig, rawGenerationConfig);

    const thinkingConfig = this.toThinkingConfig(extra, rawGemini);
    if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
    return generationConfig;
  }

  private toThinkingConfig(
    extra: Record<string, unknown>,
    rawGemini?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const raw = firstRecord(
      firstValue(rawGemini, 'thinkingConfig', 'thinking_config'),
      firstValue(extra, 'thinkingConfig', 'thinking_config'),
    );
    const thinkingConfig: Record<string, unknown> = {};
    const thinkingLevel = firstValue<string>(raw, 'thinkingLevel', 'thinking_level')
      ?? firstValue<string>(rawGemini, 'thinkingLevel', 'thinking_level')
      ?? firstValue<string>(extra, 'thinkingLevel', 'thinking_level');
    const thinkingBudget = firstValue<number>(raw, 'thinkingBudget', 'thinking_budget')
      ?? firstValue<number>(rawGemini, 'thinkingBudget', 'thinking_budget')
      ?? firstValue<number>(extra, 'thinkingBudget', 'thinking_budget');
    const includeThoughts = firstValue<boolean>(raw, 'includeThoughts', 'include_thoughts')
      ?? firstValue<boolean>(rawGemini, 'includeThoughts', 'include_thoughts')
      ?? firstValue<boolean>(extra, 'includeThoughts', 'include_thoughts');

    if (raw) {
      for (const [key, value] of Object.entries(raw)) {
        if (['thinkingLevel', 'thinking_level', 'thinkingBudget', 'thinking_budget', 'includeThoughts', 'include_thoughts'].includes(key)) {
          continue;
        }
        thinkingConfig[key] = value;
      }
    }
    if (thinkingLevel !== undefined) thinkingConfig.thinkingLevel = thinkingLevel;
    if (thinkingBudget !== undefined) thinkingConfig.thinkingBudget = thinkingBudget;
    if (includeThoughts !== undefined) thinkingConfig.includeThoughts = includeThoughts;
    if (extra.enable_thinking === true && thinkingConfig.includeThoughts === undefined) {
      thinkingConfig.includeThoughts = true;
    }
    if (extra.enable_thinking === false && thinkingConfig.includeThoughts === undefined) {
      thinkingConfig.includeThoughts = false;
    }
    return Object.keys(thinkingConfig).length ? thinkingConfig : undefined;
  }

  private toGeminiTools(request: ChatCompletionRequest): unknown[] {
    if (!Array.isArray(request.tools) || request.tools.length === 0) return [];
    const functionDeclarations = request.tools
      .filter((tool) => tool?.type === 'function' && tool.function?.name)
      .map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      }));
    return functionDeclarations.length ? [{ functionDeclarations }] : [];
  }

  private toGeminiToolConfig(request: ChatCompletionRequest): Record<string, unknown> | undefined {
    const choice = request.tool_choice;
    if (!choice) return undefined;
    if (choice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
    if (choice === 'auto') return { functionCallingConfig: { mode: 'AUTO' } };
    if (isRecord(choice) && isRecord(choice.function) && typeof choice.function.name === 'string') {
      return {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [choice.function.name],
        },
      };
    }
    return undefined;
  }

  private safeJsonObject(value: unknown): Record<string, unknown> {
    if (isRecord(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : { value: parsed };
    } catch {
      return { value };
    }
  }

  private toolResponseObject(content: ChatMessage['content']): Record<string, unknown> {
    if (typeof content !== 'string') return { content };
    return this.safeJsonObject(content);
  }

  private toGeminiPart(part: ContentPart | Record<string, unknown>): GeminiPart | null {
    if (!isRecord(part)) return null;
    if (part.type === 'text') {
      const text = typeof part.text === 'string' ? part.text : '';
      return text ? { text } : null;
    }
    if ('inlineData' in part || 'fileData' in part || 'functionCall' in part || 'functionResponse' in part) {
      return part as GeminiPart;
    }
    if ('inline_data' in part && isRecord(part.inline_data)) {
      return {
        inlineData: {
          mimeType: String(part.inline_data.mime_type || part.inline_data.mimeType || ''),
          data: String(part.inline_data.data || ''),
        },
      };
    }
    if ('file_data' in part && isRecord(part.file_data)) {
      return {
        fileData: {
          mimeType: part.file_data.mime_type || part.file_data.mimeType ? String(part.file_data.mime_type || part.file_data.mimeType) : undefined,
          fileUri: String(part.file_data.file_uri || part.file_data.fileUri || ''),
        },
      };
    }
    if (part.type !== 'image_url' || !isRecord(part.image_url) || typeof part.image_url.url !== 'string') return null;
    const url = part.image_url.url;
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
    }
    if (!url) return null;
    return { fileData: { fileUri: url } };
  }

  private toOpenAiResponse(request: ChatCompletionRequest, data: GeminiResponse): ChatCompletionResponse {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const content = parts.filter((part) => !part.thought).map((part) => part.text || '').join('');
    const reasoningContent = parts.filter((part) => part.thought).map((part) => part.text || '').join('');
    const toolCalls = parts
      .map((part, index) => part.functionCall?.name
        ? {
            id: `gemini-call-${index}-${Date.now()}`,
            type: 'function' as const,
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          }
        : null)
      .filter((call): call is NonNullable<typeof call> => Boolean(call));
    if (!content && !toolCalls.length) {
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
        message: {
          role: 'assistant',
          content,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
        },
        finish_reason: toolCalls.length ? 'tool_calls' : this.normalizeFinishReason(candidate?.finishReason),
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
    let emittedAny = false;
    let lastEmptyReason = '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response.body!.getReader();
        const emitChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: `gemini-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta, finish_reason: finishReason }],
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
              emitChunk({ content: `Gemini 请求失败：${data.error.message}` }, 'error');
              emittedAny = true;
              return;
            }
            const candidate = data.candidates?.[0];
            if (!candidate?.content?.parts?.length || candidate.finishReason || data.promptFeedback?.blockReason) {
              lastEmptyReason = describeEmptyResponse(data);
            }
            for (const part of candidate?.content?.parts || []) {
              if (part.functionCall?.name) {
                emittedAny = true;
                emitChunk({
                  tool_calls: [{
                    index: 0,
                    id: `gemini-call-${Date.now()}`,
                    type: 'function',
                    function: {
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args || {}),
                    },
                  }],
                }, 'tool_calls');
                continue;
              }
              const text = part.text || '';
              if (!text) continue;
              emittedAny = true;
              emitChunk(part.thought ? { reasoning_content: text } : { content: text });
            }
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
          if (!emittedAny) {
            const message = lastEmptyReason || `${providerName} returned an empty response`;
            emitChunk({ content: message }, 'error');
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
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text) as GeminiResponse;
          detail = data.error?.message || text.slice(0, 500);
        } catch {
          detail = text.slice(0, 500);
        }
      }
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

function attachKeyRotation(response: ChatCompletionResponse, rotation?: ProviderKeyRotationInfo): void {
  if (!rotation) return;
  Object.defineProperty(response, '_providerKeyRotation', {
    value: rotation,
    enumerable: false,
    configurable: true,
  });
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return '***';
  return `***${key.slice(-4)}`;
}

function attachKeyAudit(response: ChatCompletionResponse, audit?: ProviderKeyAuditInfo): void {
  if (!audit) return;
  Object.defineProperty(response, '_providerKeyAudit', {
    value: audit,
    enumerable: false,
    configurable: true,
  });
}

async function isBalanceExhaustedResponse(response: Response): Promise<boolean> {
  if (![400, 402, 403].includes(response.status)) return false;
  let text = response.statusText || '';
  try {
    text += ` ${await response.clone().text()}`;
  } catch {}
  const normalized = text.toLowerCase();
  return [
    '余额不足',
    '账户余额不足',
    '账号余额不足',
    'insufficient balance',
    'insufficient credit',
    'insufficient credits',
    'credit exhausted',
    'credits exhausted',
    'balance not enough',
    'balance is not enough',
    'prepaid balance',
    'insufficient_quota',
    'quota_exceeded',
  ].some((needle) => normalized.includes(needle));
}

function withProviderAuditHeaders(response: Response, rotation?: ProviderKeyRotationInfo, audit?: ProviderKeyAuditInfo): Response {
  if (!rotation && !audit) return response;
  const headers = new Headers(response.headers);
  if (rotation) headers.set('x-provider-key-rotation', JSON.stringify(rotation));
  if (audit) headers.set('x-provider-key-audit', encodeURIComponent(JSON.stringify(audit)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
