import { Body, Controller, Inject, Post, Res, UseGuards, forwardRef } from '@nestjs/common';
import { SettingsThrottle } from '../common/settings-throttle.decorator';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';
import { Response } from 'express';
import { BillingService } from '../billing/billing.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatService } from './chat.service';
import { CacheService } from '../cache/cache.service';
import { RouterService } from '../router/router.service';
import { extractContentDelta } from '../common/stream-utils';
import { AgentsService } from '../agents/agents.service';
import { RouteDecision } from '../router/router.service';
import { RunAgentDto } from '../agents/dto/agent.dto';
import { ProviderKeyAuditInfo } from '../providers/provider.types';

function flushSse(res: Response): void {
  (res as Response & { flush?: () => void }).flush?.();
}

function writeSse(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  flushSse(res);
}

function writeStreamError(res: Response, model: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  writeSse(res, {
    id: `stream-error-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content: `请求失败：${message}` }, finish_reason: 'error' }],
  });
  res.write('data: [DONE]\n\n');
  flushSse(res);
}

function readProviderKeyAuditHeader(response: globalThis.Response): ProviderKeyAuditInfo | undefined {
  const raw = response.headers.get('x-provider-key-audit');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw.startsWith('{') ? raw : decodeURIComponent(raw)) as ProviderKeyAuditInfo;
    return parsed?.provider ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readProviderKeyAuditCompletion(completion: unknown): ProviderKeyAuditInfo | undefined {
  return (completion as { _providerKeyAudit?: ProviderKeyAuditInfo } | null)?._providerKeyAudit;
}

@Controller('chat')
@UseGuards(ApiKeyOrJwtGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly billingService: BillingService,
    private readonly cacheService: CacheService,
    private readonly routerService: RouterService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
  ) {}

  @Post('completions')
  @SettingsThrottle('rate_limit_relay')
  @UseGuards(SettingsThrottleGuard)
  async completions(
    @Body() payload: ChatRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    // ── Auto routing: if model is 'auto', classify intent and pick best model ──
    if (payload.model === 'auto') {
      return this.handleAutoRoute(payload, user, res);
    }

    // Extract last user message for cache lookup (works for both stream + non-stream)
    const lastUserMsg = [...payload.messages].reverse().find((m) => m.role === 'user');
    const queryText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // Check semantic cache for both stream and non-stream
    if (queryText) {
      const cached = await this.cacheService.lookup(user.id, queryText, payload.model);
      if (cached) {
        if (payload.stream) {
          // Stream the cached response as SSE
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('x-cache-hit', 'true');
          res.setHeader('x-cache-tokens-saved', String(cached.tokensSaved));
          res.setHeader('x-credit-balance', '0.0000');

          const words = cached.response.split(/(\s+)/);
          for (let i = 0; i < words.length; i++) {
            const chunk = {
              id: `cache-${cached.id}`,
              object: 'chat.completion.chunk',
              model: payload.model,
              choices: [{ index: 0, delta: { content: words[i] }, finish_reason: i === words.length - 1 ? 'cache' : null }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        // Non-stream: return JSON directly
        res.setHeader('x-cache-hit', 'true');
        res.setHeader('x-cache-tokens-saved', String(cached.tokensSaved));
        res.setHeader('x-credit-balance', '0.0000');
        res.json({
          id: 'cache-' + cached.id,
          object: 'chat.completion',
          model: payload.model,
          choices: [{ index: 0, message: { role: 'assistant', content: cached.response }, finish_reason: 'cache' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
        return;
      }
    }

    if (payload.stream) {
      const usageEstimate = this.billingService.reserveForStream(user.id, payload);
      const upstream = await this.chatService.createCompletionStream(payload);
      const providerAudit = readProviderKeyAuditHeader(upstream);
      const reader = upstream.body?.getReader();
      if (!reader) {
        res.status(502).json({ error: { message: 'Upstream stream unavailable' } });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const rotationHeader = upstream.headers.get('x-provider-key-rotation');
      if (rotationHeader) res.setHeader('x-provider-key-rotation', rotationHeader);
      res.flushHeaders?.();

      const decoder = new TextDecoder();
      let generatedText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          generatedText += extractContentDelta(chunkText);
          res.write(chunkText);
          flushSse(res);
        }
      } catch (error) {
        writeStreamError(res, payload.model, error);
        res.end();
        return;
      } finally {
        reader.releaseLock();
      }

      const finalUsage = {
        prompt_tokens: usageEstimate.prompt_tokens,
        completion_tokens: Math.max(1, Math.ceil(generatedText.length / 4)),
        total_tokens: 0,
      };
      finalUsage.total_tokens = finalUsage.prompt_tokens + finalUsage.completion_tokens;

      const updatedUser = await this.billingService.chargeForCompletion(
        user.id, payload, finalUsage, 'chat', {
          provider: providerAudit?.provider,
          providerKeyId: providerAudit?.keyId,
          providerKeyName: providerAudit?.keyName,
          providerKeyPrefix: providerAudit?.keyPrefix,
          providerKeySource: providerAudit?.keySource,
        },
      );
      void updatedUser;

      // Store in cache
      if (queryText && generatedText) {
        const tokensSaved = finalUsage.total_tokens;
        const costSaved = 0; // Actual cost is already charged, cache is for future savings
        this.cacheService.store(user.id, queryText, payload.model, generatedText, tokensSaved, costSaved).catch(() => {});
      }

      res.end();
      return;
    }

    const completion = await this.chatService.createCompletion(payload);
    const providerAudit = readProviderKeyAuditCompletion(completion);
    const updatedUser = await this.billingService.chargeForCompletion(
      user.id, payload, completion.usage, 'chat', {
        provider: providerAudit?.provider,
        providerKeyId: providerAudit?.keyId,
        providerKeyName: providerAudit?.keyName,
        providerKeyPrefix: providerAudit?.keyPrefix,
        providerKeySource: providerAudit?.keySource,
      },
    );
    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));
    const rotation = (completion as typeof completion & { _providerKeyRotation?: unknown })._providerKeyRotation;
    if (rotation) res.setHeader('x-provider-key-rotation', JSON.stringify(rotation));

    // Store in cache
    const replyContent = completion.choices?.[0]?.message?.content ?? '';
    if (queryText && replyContent) {
      const tokens = (completion.usage?.total_tokens) ?? 0;
      this.cacheService.store(user.id, queryText, payload.model, replyContent, tokens, 0).catch(() => {});
    }

    res.json(completion);
  }

  /** Handle 'auto' model: classify intent via LLM → route to best model */
  private async handleAutoRoute(
    payload: ChatRequestDto,
    user: AuthenticatedRequestUser,
    res: Response,
  ) {
    const startedAt = Date.now();

    // 1. Route
    let decision;
    try {
      const result = await this.routerService.route(payload);
      decision = result.decision;
      payload = { ...payload, model: result.model };
    } catch (error) {
      res.status(500).json({ error: { message: `Router failed: ${error instanceof Error ? error.message : error}` } });
      return;
    }

    if (decision.targetType === 'builtin_agent' && decision.agentKey) {
      return this.handleAutoAgentRoute(payload, user, res, decision);
    }

    if (payload.stream) {
      const usageEstimate = this.billingService.reserveForStream(user.id, payload);
      const upstream = await this.chatService.createCompletionStream(payload);
      const providerAudit = readProviderKeyAuditHeader(upstream);
      const reader = upstream.body?.getReader();
      if (!reader) {
        res.status(502).json({ error: { message: 'Upstream stream unavailable' } });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('x-router-intent', decision.intent);
      res.setHeader('x-router-model', decision.selectedModel);
      res.setHeader('x-router-reason', encodeURIComponent(decision.reason));
      const rotationHeader = upstream.headers.get('x-provider-key-rotation');
      if (rotationHeader) res.setHeader('x-provider-key-rotation', rotationHeader);
      res.flushHeaders?.();

      // Send router decision as first SSE event
      res.write(`data: ${JSON.stringify({ router_decision: decision })}\n\n`);
      flushSse(res);

      const decoder = new TextDecoder();
      let generatedText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          generatedText += extractContentDelta(chunkText);
          res.write(chunkText);
          flushSse(res);
        }
      } catch (error) {
        writeStreamError(res, payload.model, error);
        res.end();
        return;
      } finally {
        reader.releaseLock();
      }

      const finalUsage = {
        prompt_tokens: usageEstimate.prompt_tokens,
        completion_tokens: Math.max(1, Math.ceil(generatedText.length / 4)),
        total_tokens: 0,
      };
      finalUsage.total_tokens = finalUsage.prompt_tokens + finalUsage.completion_tokens;

      const updatedUser = await this.billingService.chargeForCompletion(user.id, payload, finalUsage, 'chat', {
        provider: providerAudit?.provider,
        providerKeyId: providerAudit?.keyId,
        providerKeyName: providerAudit?.keyName,
        providerKeyPrefix: providerAudit?.keyPrefix,
        providerKeySource: providerAudit?.keySource,
      });
      void updatedUser;

      const latencyMs = Date.now() - startedAt;
      this.routerService.recordCompletion(decision.selectedModel, latencyMs, true, decision.intent);

      res.end();
      return;
    }

    // Non-streaming
    const completion = await this.chatService.createCompletion(payload);
    const providerAudit = readProviderKeyAuditCompletion(completion);
    const updatedUser = await this.billingService.chargeForCompletion(user.id, payload, completion.usage, 'chat', {
      provider: providerAudit?.provider,
      providerKeyId: providerAudit?.keyId,
      providerKeyName: providerAudit?.keyName,
      providerKeyPrefix: providerAudit?.keyPrefix,
      providerKeySource: providerAudit?.keySource,
    });

    const latencyMs = Date.now() - startedAt;
    this.routerService.recordCompletion(decision.selectedModel, latencyMs, true, decision.intent);

    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));
    res.setHeader('x-router-intent', decision.intent);
    res.setHeader('x-router-model', decision.selectedModel);
    const rotation = (completion as typeof completion & { _providerKeyRotation?: unknown })._providerKeyRotation;
    if (rotation) res.setHeader('x-provider-key-rotation', JSON.stringify(rotation));
    res.json({ ...completion, router_decision: decision });
  }

  private async handleAutoAgentRoute(
    payload: ChatRequestDto,
    user: AuthenticatedRequestUser,
    res: Response,
    decision: RouteDecision,
  ) {
    const agentKey = decision.agentKey;
    if (!agentKey) {
      res.status(500).json({ error: { message: 'Router selected agent target without agentKey' } });
      return;
    }
    const startedAt = Date.now();
    const runDto = this.chatPayloadToAgentRun(payload);
    if (payload.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('x-router-intent', decision.intent);
      res.setHeader('x-router-model', decision.selectedModel);
      res.setHeader('x-router-reason', encodeURIComponent(decision.reason));
      res.flushHeaders?.();

      let decisionSent = false;
      const sendDecision = (runId?: string) => {
        if (decisionSent) return;
        decisionSent = true;
        writeSse(res, {
          router_decision: {
            ...decision,
            runId,
            traceAvailable: Boolean(runId),
          },
        });
      };

      try {
        const run = await this.agentsService.runBuiltinAgent(user.id, agentKey, runDto, payload.model, (event) => {
          if (event.type === 'run_created') {
            sendDecision(event.run.id);
            return;
          }
          if (event.type === 'llm_delta') {
            const chunk = {
              id: event.runId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: payload.model,
              choices: [{ index: 0, delta: { content: event.delta }, finish_reason: null }],
            };
            writeSse(res, chunk);
            return;
          }
          if (event.type === 'error') {
            writeStreamError(res, payload.model, event.error);
          }
        });
        sendDecision(run.id);
        this.routerService.recordCompletion(decision.selectedModel, Date.now() - startedAt, run.status === 'succeeded', decision.intent);
        res.write('data: [DONE]\n\n');
        flushSse(res);
      } catch (error) {
        sendDecision();
        writeStreamError(res, payload.model, error);
      } finally {
        res.end();
      }
      return;
    }

    try {
      const run = await this.agentsService.runBuiltinAgent(user.id, agentKey, runDto, payload.model);
      this.routerService.recordCompletion(decision.selectedModel, Date.now() - startedAt, run.status === 'succeeded', decision.intent);
      res.setHeader('x-router-intent', decision.intent);
      res.setHeader('x-router-model', decision.selectedModel);
      res.json({
        id: run.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: payload.model,
        choices: [{ index: 0, message: { role: 'assistant', content: run.output || run.error }, finish_reason: run.status === 'failed' ? 'error' : 'stop' }],
        usage: { prompt_tokens: run.promptTokens, completion_tokens: run.completionTokens, total_tokens: run.totalTokens },
        router_decision: { ...decision, runId: run.id, traceAvailable: true },
      });
    } catch (error) {
      res.status(500).json({ error: { message: error instanceof Error ? error.message : String(error) } });
    }
  }

  private chatPayloadToAgentRun(payload: ChatRequestDto): RunAgentDto {
    const lastUserIndex = [...payload.messages].map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === 'user')?.index ?? payload.messages.length - 1;
    const lastUser = payload.messages[lastUserIndex];
    const extracted = this.extractMessageContent(lastUser?.content);
    const history = payload.messages
      .slice(0, lastUserIndex)
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-20)
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: this.extractMessageContent(message.content).text }));
    return {
      input: extracted.text || '',
      messages: history,
      imageUrls: extracted.imageUrls,
      maxSteps: 6,
      approvedToolIds: [],
    };
  }

  private extractMessageContent(content: string | unknown[]): { text: string; imageUrls: string[] } {
    if (typeof content === 'string') return { text: content, imageUrls: [] };
    if (!Array.isArray(content)) return { text: '', imageUrls: [] };
    const text: string[] = [];
    const imageUrls: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as Record<string, unknown>;
      if (record.type === 'text' && typeof record.text === 'string') text.push(record.text);
      if (record.type === 'image_url' && record.image_url && typeof record.image_url === 'object') {
        const url = (record.image_url as Record<string, unknown>).url;
        if (typeof url === 'string') imageUrls.push(url);
      }
    }
    return { text: text.join('\n'), imageUrls };
  }
}
