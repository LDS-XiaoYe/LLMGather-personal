import { Injectable } from '@nestjs/common';
import { ChatService } from '../gateway/chat.service';
import { ChatRequestDto } from '../gateway/dto/chat-request.dto';
import { ProviderRegistryService } from '../providers/provider-registry.service';

export type CollabMode = 'debate' | 'review' | 'divide';

export interface CollabChunk {
  type: string;
  modelId?: string;
  modelName?: string;
  content?: string;
  error?: string;
}

/** Helper: read SSE stream and collect content */
async function readStreamContent(
  upstream: Response | any,
  signal?: AbortSignal,
): Promise<string> {
  const reader = upstream.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let content = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split('\n').filter((l: string) => l.startsWith('data:'));
      for (const line of lines) {
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const j = JSON.parse(d);
          const t = j.choices?.[0]?.delta?.content;
          if (t) content += t;
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  return content;
}

/** Helper: read SSE stream and yield chunks */
async function* streamContent(
  upstream: any,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = upstream.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split('\n').filter((l: string) => l.startsWith('data:'));
      for (const line of lines) {
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const j = JSON.parse(d);
          const t = j.choices?.[0]?.delta?.content;
          if (t) yield t;
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
}

@Injectable()
export class CollabService {
  constructor(
    private readonly chatService: ChatService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  pickModels(count: number, preferred?: string[]): string[] {
    const all = this.providerRegistry.listModels();
    const langModels = all
      .filter((m) => !m.id.includes('vl') && !m.id.includes('tts') && !m.id.includes('voice'))
      .map((m) => m.id);
    if (preferred) {
      const available = preferred.filter((p) => langModels.includes(p));
      if (available.length >= count) return available.slice(0, count);
    }
    const shuffled = [...langModels].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private async callModel(model: string, messages: any[], temp = 0.7): Promise<any> {
    const payload: ChatRequestDto = { model, messages, temperature: temp, stream: true };
    return this.chatService.createCompletionStream(payload);
  }

  /** Mode 1: Parallel Debate */
  async *debate(query: string, models: string[], signal?: AbortSignal): AsyncGenerator<CollabChunk> {
    const participants = models.slice(0, 3);

    // Phase 1: Fire all 3 models concurrently
    const calls = participants.map(async (model) => {
      const upstream = await this.callModel(model, [{ role: 'user', content: query }]);
      const content = await readStreamContent(upstream, signal);
      return { model, content };
    });

    // Emit start events
    for (const m of participants) {
      yield { type: 'model_start', modelId: m, modelName: m };
    }

    // Wait for all
    const results = await Promise.allSettled(calls);

    // Emit done + content for each
    for (let i = 0; i < participants.length; i++) {
      const r = results[i];
      const model = participants[i];
      if (r.status === 'fulfilled') {
        yield { type: 'model_chunk', modelId: model, content: r.value.content || '(空响应)' };
      }
      yield { type: 'model_done', modelId: model };
    }

    if (signal?.aborted) return;

    // Phase 2: Summary
    const summaryModel = this.pickModels(1, ['qwen-max'])[0];
    const debateText = results
      .map((r, i) => {
        if (r.status === 'fulfilled') {
          return `【模型${i + 1}: ${participants[i]}】\n${r.value.content || '(空)'}`;
        }
        return `【模型${i + 1}: ${participants[i]}】\n请求失败`;
      })
      .join('\n\n');

    yield { type: 'summary_start', modelId: summaryModel };
    const upstream = await this.callModel(summaryModel, [
      { role: 'user', content: `以下是${participants.length}个AI模型对问题「${query}」的回答。请综合分析，给出融合各模型优点后最优的回答。\n\n${debateText}` },
    ], 0.5);
    for await (const token of streamContent(upstream, signal)) {
      yield { type: 'summary_chunk', content: token };
    }
    yield { type: 'summary_done' };
  }

  /** Mode 2: Peer Review */
  async *review(query: string, models: string[], signal?: AbortSignal): AsyncGenerator<CollabChunk> {
    const [modelA, modelB] = models.slice(0, 2);

    // Step 1: Model A answers
    yield { type: 'model_start', modelId: modelA, modelName: modelA };
    const upstreamA = await this.callModel(modelA, [{ role: 'user', content: query }]);
    let answerA = '';
    for await (const t of streamContent(upstreamA, signal)) {
      answerA += t;
      yield { type: 'model_chunk', modelId: modelA, content: t };
    }
    yield { type: 'model_done', modelId: modelA };
    if (signal?.aborted) return;

    // Step 2: Model B reviews
    yield { type: 'model_start', modelId: modelB, modelName: `${modelB} (审阅)` };
    const upstreamB = await this.callModel(modelB, [
      { role: 'user', content: `请审阅以下对问题「${query}」的回答，指出问题或可改进之处。简要回答。\n\n回答：${answerA}` },
    ], 0.5);
    let reviewB = '';
    for await (const t of streamContent(upstreamB, signal)) {
      reviewB += t;
      yield { type: 'model_chunk', modelId: modelB, content: t };
    }
    yield { type: 'model_done', modelId: modelB };
    if (signal?.aborted) return;

    // Step 3: Model A revises
    yield { type: 'model_start', modelId: modelA, modelName: `${modelA} (修正)` };
    const upstreamA2 = await this.callModel(modelA, [
      { role: 'user', content: query },
      { role: 'assistant', content: answerA },
      { role: 'user', content: `审阅意见：${reviewB}\n\n请根据审阅意见修正你的回答。` },
    ]);
    for await (const t of streamContent(upstreamA2, signal)) {
      yield { type: 'model_chunk', modelId: modelA, content: t };
    }
    yield { type: 'model_done', modelId: modelA };
  }

  /** Mode 3: Divide & Conquer */
  async *divide(query: string, signal?: AbortSignal): AsyncGenerator<CollabChunk> {
    // Step 1: Planner
    const plannerModel = this.pickModels(1, ['qwen-max'])[0];
    yield { type: 'model_start', modelId: plannerModel, modelName: `${plannerModel} (规划)` };
    const upstreamP = await this.callModel(plannerModel, [
      { role: 'user', content: `将以下任务拆解为2-3个子任务，每个子任务用一行描述。只输出子任务列表。\n\n${query}` },
    ], 0.3);
    let planText = '';
    for await (const t of streamContent(upstreamP, signal)) {
      planText += t;
      yield { type: 'model_chunk', modelId: plannerModel, content: t };
    }
    yield { type: 'model_done', modelId: plannerModel };
    if (signal?.aborted) return;

    const subtasks = planText.split('\n')
      .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
      .filter((l) => l.length > 5)
      .slice(0, 3);

    if (subtasks.length === 0) {
      yield { type: 'error', error: '无法拆解任务' };
      return;
    }

    // Step 2: Execute subtasks sequentially
    const results: string[] = [];
    const specialistModels = this.pickModels(subtasks.length);
    for (let i = 0; i < subtasks.length; i++) {
      if (signal?.aborted) break;
      const model = specialistModels[i] || specialistModels[0];
      yield { type: 'model_start', modelId: `${model}#${i}`, modelName: `${model} (子任务${i + 1})` };
      const upstream = await this.callModel(model, [
        { role: 'user', content: `原始任务：${query}\n子任务：${subtasks[i]}\n请完成这个子任务。` },
      ]);
      let content = '';
      for await (const t of streamContent(upstream, signal)) {
        content += t;
        yield { type: 'model_chunk', modelId: `${model}#${i}`, content: t };
      }
      results.push(`【子任务${i + 1}: ${subtasks[i]}】\n${content || '(空)'}`);
      yield { type: 'model_done', modelId: `${model}#${i}` };
    }
    if (signal?.aborted) return;

    // Step 3: Aggregate
    const aggModel = this.pickModels(1, ['qwen-max'])[0];
    yield { type: 'summary_start', modelId: aggModel };
    const upstreamA = await this.callModel(aggModel, [
      { role: 'user', content: `原始任务：${query}\n\n子任务结果：\n${results.join('\n\n')}\n\n请合并为完整回答。` },
    ], 0.5);
    for await (const t of streamContent(upstreamA, signal)) {
      yield { type: 'summary_chunk', content: t };
    }
    yield { type: 'summary_done' };
  }
}
