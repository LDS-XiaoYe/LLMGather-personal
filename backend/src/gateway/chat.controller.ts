import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
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

@Controller('chat')
@UseGuards(ApiKeyOrJwtGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly billingService: BillingService,
    private readonly cacheService: CacheService,
    private readonly routerService: RouterService,
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
      const cached = await this.cacheService.lookup(queryText, payload.model);
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
      const reader = upstream.body?.getReader();
      if (!reader) {
        res.status(502).json({ error: { message: 'Upstream stream unavailable' } });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
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
        user.id, payload, finalUsage, 'chat',
      );
      void updatedUser;

      // Store in cache
      if (queryText && generatedText) {
        const tokensSaved = finalUsage.total_tokens;
        const costSaved = 0; // Actual cost is already charged, cache is for future savings
        this.cacheService.store(queryText, payload.model, generatedText, tokensSaved, costSaved).catch(() => {});
      }

      res.end();
      return;
    }

    const completion = await this.chatService.createCompletion(payload);
    const updatedUser = await this.billingService.chargeForCompletion(
      user.id, payload, completion.usage, 'chat',
    );
    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));

    // Store in cache
    const replyContent = completion.choices?.[0]?.message?.content ?? '';
    if (queryText && replyContent) {
      const tokens = (completion.usage?.total_tokens) ?? 0;
      this.cacheService.store(queryText, payload.model, replyContent, tokens, 0).catch(() => {});
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

    if (payload.stream) {
      const usageEstimate = this.billingService.reserveForStream(user.id, payload);
      const upstream = await this.chatService.createCompletionStream(payload);
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

      const updatedUser = await this.billingService.chargeForCompletion(user.id, payload, finalUsage, 'chat');
      void updatedUser;

      const latencyMs = Date.now() - startedAt;
      this.routerService.recordCompletion(decision.selectedModel, latencyMs, true, decision.intent);

      res.end();
      return;
    }

    // Non-streaming
    const completion = await this.chatService.createCompletion(payload);
    const updatedUser = await this.billingService.chargeForCompletion(user.id, payload, completion.usage, 'chat');

    const latencyMs = Date.now() - startedAt;
    this.routerService.recordCompletion(decision.selectedModel, latencyMs, true, decision.intent);

    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));
    res.setHeader('x-router-intent', decision.intent);
    res.setHeader('x-router-model', decision.selectedModel);
    res.json({ ...completion, router_decision: decision });
  }
}
