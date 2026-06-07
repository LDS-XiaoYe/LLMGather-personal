import { Body, Controller, Get, Inject, Post, Res, UseGuards, forwardRef } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { BillingService } from '../billing/billing.service';
import { ChatService } from '../gateway/chat.service';
import { ChatRequestDto } from '../gateway/dto/chat-request.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { extractContentDelta } from '../common/stream-utils';
import { AgentsService } from '../agents/agents.service';
import { RunAgentDto } from '../agents/dto/agent.dto';
import { RouteDecision, RouterService } from './router.service';

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
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
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

    if (decision.targetType === 'builtin_agent' && decision.agentKey) {
      return this.handleAutoAgentRoute(routedPayload, user, res, decision, startedAt);
    }

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
      void updatedUser;

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

  private async handleAutoAgentRoute(
    payload: ChatRequestDto,
    user: AuthenticatedRequestUser,
    res: Response,
    decision: RouteDecision,
    startedAt: number,
  ) {
    const agentKey = decision.agentKey;
    if (!agentKey) {
      res.status(500).json({ error: { message: 'Router selected agent target without agentKey' } });
      return;
    }
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
        writeSse(res, { router_decision: { ...decision, runId, traceAvailable: Boolean(runId) } });
      };
      try {
        const run = await this.agentsService.runBuiltinAgent(user.id, agentKey, runDto, payload.model, (event) => {
          if (event.type === 'run_created') {
            sendDecision(event.run.id);
            return;
          }
          if (event.type === 'llm_delta') {
            writeSse(res, {
              id: event.runId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: payload.model,
              choices: [{ index: 0, delta: { content: event.delta }, finish_reason: null }],
            });
          }
        });
        sendDecision(run.id);
        await this.routerService.recordCompletion(decision.selectedModel, Date.now() - startedAt, run.status === 'succeeded', decision.intent);
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

    const run = await this.agentsService.runBuiltinAgent(user.id, agentKey, runDto, payload.model);
    await this.routerService.recordCompletion(decision.selectedModel, Date.now() - startedAt, run.status === 'succeeded', decision.intent);
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
  }

  private chatPayloadToAgentRun(payload: ChatRequestDto): RunAgentDto {
    const lastUserIndex = [...payload.messages].map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === 'user')?.index ?? payload.messages.length - 1;
    const lastUser = payload.messages[lastUserIndex];
    const extracted = this.extractMessageContent(lastUser?.content);
    const extra = payload.extra_body && typeof payload.extra_body === 'object' ? payload.extra_body as Record<string, unknown> : {};
    const approvedToolIds = Array.isArray(extra.approvedToolIds)
      ? extra.approvedToolIds.filter((id): id is string => typeof id === 'string')
      : [];
    return {
      input: extracted.text || '',
      messages: payload.messages
        .slice(0, lastUserIndex)
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-20)
        .map((message) => ({ role: message.role as 'user' | 'assistant', content: this.extractMessageContent(message.content).text })),
      imageUrls: extracted.imageUrls,
      maxSteps: 6,
      approvedToolIds,
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
