import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { BillingService } from '../billing/billing.service';
import { ChatService } from '../gateway/chat.service';
import { ChatRequestDto } from '../gateway/dto/chat-request.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { extractContentDelta } from '../common/stream-utils';
import { RouterService } from './router.service';

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

@Controller('router')
@UseGuards(ApiKeyOrJwtGuard)
export class RouterController {
  constructor(
    private readonly routerService: RouterService,
    private readonly chatService: ChatService,
    private readonly billingService: BillingService,
  ) {}

  @Get('rules')
  async getRules() {
    return { data: await this.routerService.getRules() };
  }

  @Get('metrics')
  async getMetrics() {
    return { data: await this.routerService.getMetrics() };
  }

  // ── Admin: CRUD router rules ──

  @Get('admin/rules')
  async getRulesRaw() {
    return { data: await this.routerService.getRulesRaw() };
  }

  @Post('admin/rules')
  async saveRule(@Body() body: { intent: string; models: string[] }) {
    await this.routerService.updateRule(body.intent, body.models);
    return { ok: true };
  }

  @Post('admin/rules/delete')
  async deleteRule(@Body() body: { intent: string }) {
    await this.routerService.deleteRule(body.intent);
    return { ok: true };
  }

  @Post('chat/completions')
  async completions(
    @Body() payload: ChatRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    // 1. Route the request
    const { provider, model, decision } = await this.routerService.route(payload);

    // 2. Override the model in payload with the routed model
    const routedPayload = { ...payload, model };

    const startedAt = Date.now();

    if (payload.stream) {
      const usageEstimate = this.billingService.reserveForStream(user.id, routedPayload);
      const upstream = await this.chatService.createCompletionStream(routedPayload);
      const reader = upstream.body?.getReader();
      if (!reader) {
        res.status(502).json({ error: { message: 'Upstream stream unavailable' } });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      // Inject routing decision as custom header
      res.setHeader('x-router-intent', decision.intent);
      res.setHeader('x-router-model', decision.selectedModel);
      res.setHeader('x-router-reason', encodeURIComponent(decision.reason));
      res.flushHeaders?.();

      // Send routing info as first SSE event
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
        writeStreamError(res, routedPayload.model, error);
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
        user.id, routedPayload, finalUsage, 'chat',
      );
      writeSse(res, { billing: { creditBalance: updatedUser.credits.toFixed(6) } });

      // Record routing metric
      const latencyMs = Date.now() - startedAt;
      await this.routerService.recordCompletion(model, latencyMs, true, decision.intent);

      res.end();
      return;
    }

    // Non-streaming
    const completion = await this.chatService.createCompletion(routedPayload);
    const updatedUser = await this.billingService.chargeForCompletion(
      user.id, routedPayload, completion.usage, 'chat',
    );

    const latencyMs = Date.now() - startedAt;
    await this.routerService.recordCompletion(model, latencyMs, true, decision.intent);

    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));
    res.setHeader('x-router-intent', decision.intent);
    res.setHeader('x-router-model', decision.selectedModel);
    res.json({ ...completion, router_decision: decision });
  }
}
