import type { ModelDescriptor } from './api';

export const BASE_URL_KEY = 'llm_gather_base_url';

export function getModelLogo(modelId: string): { url: string; color: string; name: string } {
  const lower = modelId.toLowerCase();
  if (lower.includes('gpt') || lower.includes('openai')) return { url: '/logos/chatgpt.png?v=2', color: '#10a37f', name: 'ChatGPT' };
  if (lower.includes('glm') || lower.includes('zhipu') || lower.includes('chatglm')) return { url: '/logos/glm5.png?v=2', color: '#7b68ee', name: 'GLM' };
  if (lower.includes('deepseek')) return { url: '/logos/deepseek.png?v=2', color: '#ffffff', name: 'DeepSeek' };
  if (lower.includes('qwen') || lower.includes('alibaba') || lower.includes('通义')) return { url: '/logos/qwen.png?v=2', color: '#6236ff', name: 'Qwen' };
  return { url: '', color: '#6b7280', name: modelId };
}
