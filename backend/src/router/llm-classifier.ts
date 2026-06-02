import { ChatService } from '../gateway/chat.service';
import { ChatRequestDto } from '../gateway/dto/chat-request.dto';

const FALLBACK_CLASSIFIER_MODEL = 'qwen-plus';
const FALLBACK_INTENTS = ['coding', 'translation', 'creative', 'reasoning', 'vision', 'summary', 'data', 'general'];

export interface ClassifierDebug {
  classifierModel: string;
  rawOutput: string;
  matchedBy: 'label' | 'fuzzy' | 'fallback';
  prompt: string;
}

export async function classifyIntentByLLM(
  query: string,
  chatService: ChatService,
  classifierModel?: string,
  availableIntents?: string[],
): Promise<{ intent: string; debug: ClassifierDebug }> {
  const model = classifierModel || FALLBACK_CLASSIFIER_MODEL;
  const intents = (availableIntents && availableIntents.length > 0) ? availableIntents : FALLBACK_INTENTS;
  const intentList = intents.join(', ');

  const prompt = `Classify the user message into exactly ONE category from this list: ${intentList}.
Reply with ONLY the category name, no explanation, no punctuation.

User message: "${query.slice(0, 500)}"
Category:`;

  const payload: ChatRequestDto = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 10,
    stream: false,
  };

  const makeDebug = (raw: string, matchedBy: ClassifierDebug['matchedBy']): ClassifierDebug => ({
    classifierModel: model,
    rawOutput: raw,
    matchedBy,
    prompt: prompt.slice(0, 300),
  });

  try {
    const completion = await chatService.createCompletion(payload);
    const raw = (completion.choices?.[0]?.message?.content ?? '').trim().toLowerCase();

    // 1. Exact match against all available intents
    for (const label of intents) {
      if (raw.includes(label)) return { intent: label, debug: makeDebug(raw, 'label') };
    }

    // 2. Fuzzy match for well-known intents (only if they exist in available intents)
    const fuzzyMap: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /code|program|debug|function|开发|编程|代码/, intent: 'coding' },
      { pattern: /translat|翻译/, intent: 'translation' },
      { pattern: /creat|write|创作|写/, intent: 'creative' },
      { pattern: /reason|logic|math|推理|逻辑|数学/, intent: 'reasoning' },
      { pattern: /vision|image|图片|视觉/, intent: 'vision' },
      { pattern: /summar|总结|摘要/, intent: 'summary' },
      { pattern: /data|数据|分析/, intent: 'data' },
      { pattern: /medical|health|医疗|健康/, intent: 'medical' },
      { pattern: /legal|law|法律|合同/, intent: 'legal' },
      { pattern: /finance|金融|理财|股票/, intent: 'finance' },
      { pattern: /education|教育|学习|教学/, intent: 'education' },
    ];
    for (const { pattern, intent } of fuzzyMap) {
      if (intents.includes(intent) && pattern.test(raw)) {
        return { intent, debug: makeDebug(raw, 'fuzzy') };
      }
    }

    // 3. Fallback to general
    return { intent: 'general', debug: makeDebug(raw, 'fallback') };
  } catch (err) {
    return { intent: 'general', debug: { classifierModel: model, rawOutput: `ERROR: ${err instanceof Error ? err.message : err}`, matchedBy: 'fallback', prompt: prompt.slice(0, 300) } };
  }
}

/** Get human-readable label for an intent */
export function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    coding: '编程开发',
    translation: '翻译',
    creative: '创意写作',
    reasoning: '逻辑推理',
    vision: '视觉理解',
    summary: '摘要总结',
    data: '数据分析',
    general: '通用对话',
  };
  return labels[intent] ?? intent;
}
