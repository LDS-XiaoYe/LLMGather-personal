import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { BillingService } from '../billing/billing.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatService } from './chat.service';
import { extractContentDelta } from '../common/stream-utils';
import { SystemSettingsService } from '../common/system-settings.service';
import { SettingsThrottle } from '../common/settings-throttle.decorator';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';

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
    choices: [{ index: 0, delta: { content: `Stream failed: ${message}` }, finish_reason: 'error' }],
  });
  res.write('data: [DONE]\n\n');
  flushSse(res);
}

interface AnthropicMessageBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessageRequest {
  model: string;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string | AnthropicMessageBlock[] }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

@Controller('relay')
@UseGuards(ApiKeyOrJwtGuard)
export class RelayController {
  constructor(
    private readonly chatService: ChatService,
    private readonly billingService: BillingService,
    private readonly settings: SystemSettingsService,
  ) {}

  @Post('openai/chat/completions')
  @SettingsThrottle('rate_limit_relay')
  @UseGuards(SettingsThrottleGuard)
  async openAi(
    @Body() payload: ChatRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    // ensure temperature default from system settings
    if (payload.temperature === undefined || payload.temperature === null) {
      const def = this.settings.getNumber('default_temperature', NaN);
      if (Number.isFinite(def)) payload.temperature = def;
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
        user.id,
        payload,
        finalUsage,
        'openai',
      );
      writeSse(res, { billing: { creditBalance: updatedUser.credits.toFixed(6) } });
      res.end();
      return;
    }

    const completion = await this.chatService.createCompletion(payload);
    const updatedUser = await this.billingService.chargeForCompletion(
      user.id,
      payload,
      completion.usage,
      'openai',
    );
    res.setHeader('x-credit-balance', updatedUser.credits.toFixed(6));
    res.json(completion);
  }

  @Post('anthropic/messages')
  @SettingsThrottle('rate_limit_relay')
  @UseGuards(SettingsThrottleGuard)
  async anthropic(
    @Body() payload: AnthropicMessageRequest,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const mapped: ChatRequestDto = {
      model: payload.model,
      messages: [],
      temperature: payload.temperature ?? this.settings.getNumber('default_temperature', NaN),
      top_p: payload.top_p,
      max_tokens: payload.max_tokens,
      stream: false,
    };

    if (payload.system) {
      mapped.messages.push({ role: 'system', content: payload.system });
    }

    for (const msg of payload.messages) {
      const text = Array.isArray(msg.content)
        ? msg.content
            .filter((item) => item.type === 'text')
            .map((item) => item.text)
            .join('\n')
        : msg.content;
      mapped.messages.push({ role: msg.role, content: text });
    }

    const completion = await this.chatService.createCompletion(mapped);
    await this.billingService.chargeForCompletion(user.id, mapped, completion.usage, 'anthropic');

    return {
      id: completion.id,
      type: 'message',
      role: 'assistant',
      model: completion.model,
      content: [
        {
          type: 'text',
          text: completion.choices?.[0]?.message?.content ?? '',
        },
      ],
      stop_reason: completion.choices?.[0]?.finish_reason ?? 'end_turn',
      usage: {
        input_tokens: completion.usage?.prompt_tokens ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  }
}
