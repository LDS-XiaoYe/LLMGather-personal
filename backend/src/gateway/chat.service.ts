import { Injectable } from '@nestjs/common';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ProviderRegistryService } from '../providers/provider-registry.service';

@Injectable()
export class ChatService {
  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  async createCompletion(payload: ChatRequestDto) {
    const provider = this.providerRegistry.resolveProvider(payload.model);
    const startedAt = Date.now();
    console.log(
      JSON.stringify({
        event: 'llm_completion',
        status: 'processing',
        provider: provider.providerName,
        request_model: payload.model,
        message_count: payload.messages.length,
      }),
    );

    try {
      const response = await provider.chatCompletion(payload);
      const latencyMs = Date.now() - startedAt;
      const replyContent = response.choices?.[0]?.message?.content ?? '';

      console.log(
        JSON.stringify({
          event: 'llm_completion',
          status: 'success',
          provider: provider.providerName,
          request_model: payload.model,
          response_model: response.model,
          response_id: response.id,
          finish_reason: response.choices?.[0]?.finish_reason ?? 'unknown',
          usage: response.usage ?? null,
          reply_preview: replyContent.slice(0, 180),
          latency_ms: latencyMs,
        }),
      );

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      console.error(
        JSON.stringify({
          event: 'llm_completion',
          status: 'failed',
          provider: provider.providerName,
          request_model: payload.model,
          latency_ms: latencyMs,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  async createCompletionStream(payload: ChatRequestDto) {
    const provider = this.providerRegistry.resolveProvider(payload.model);
    const startedAt = Date.now();
    console.log(
      JSON.stringify({
        event: 'llm_completion_stream',
        status: 'processing',
        provider: provider.providerName,
        request_model: payload.model,
        message_count: payload.messages.length,
      }),
    );

    try {
      const response = await provider.chatCompletionStream(payload);
      const latencyMs = Date.now() - startedAt;

      console.log(
        JSON.stringify({
          event: 'llm_completion_stream',
          status: 'stream_open',
          provider: provider.providerName,
          request_model: payload.model,
          latency_ms: latencyMs,
        }),
      );

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      console.error(
        JSON.stringify({
          event: 'llm_completion_stream',
          status: 'failed',
          provider: provider.providerName,
          request_model: payload.model,
          latency_ms: latencyMs,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }
}
