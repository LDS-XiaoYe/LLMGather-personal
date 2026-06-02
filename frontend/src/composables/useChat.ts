import { ref } from 'vue';
import { streamCompletion } from '../api';
import type { ChatMessage } from '../types';
import { selectedModel, models, status } from './state';
import { createId } from '../utils';

const draft = ref('');
const isSubmitting = ref(false);
const requestId = ref('');
let chatAbortController: AbortController | null = null;

export function useChat() {
  async function submitPrompt(
    upsertActiveSession: (msgs: ChatMessage[], hint?: string) => void,
    getActiveMessages: () => ChatMessage[],
    triggerSync: () => void,
    baseUrl: string,
  ) {
    const content = draft.value.trim();
    if (!content || isSubmitting.value) return;
    if (!selectedModel.value || models.value.length === 0) {
      status.value = '请先加载模型列表并选择模型';
      return;
    }

    const baseMsgs = [...getActiveMessages()];
    const userMsg: ChatMessage = { id: createId('user'), role: 'user', content };
    const requestMsgs: ChatMessage[] = [...baseMsgs, userMsg];
    const assistantMsgId = createId('assistant');
    const currentModel = selectedModel.value;
    upsertActiveSession([...requestMsgs, { id: assistantMsgId, role: 'assistant', content: '', reasoning: '', model: currentModel }], content);
    draft.value = '';
    isSubmitting.value = true;
    status.value = '正在连接模型';
    requestId.value = '';

    chatAbortController = new AbortController();
    let streamedContent = '';
    let streamedReasoning = '';

    try {
      await streamCompletion(
        {
          model: currentModel,
          messages: requestMsgs.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          extra_body: { enable_thinking: true },
        },
        {
          onRequestId: (rid) => { requestId.value = rid; status.value = '正在流式生成回复'; },
          onChunk: (chunk) => {
            const d = chunk.choices?.[0]?.delta;
            if (d?.content) streamedContent += d.content;
            if (d?.reasoning_content) streamedReasoning += d.reasoning_content;
            upsertActiveSession([...requestMsgs, { id: assistantMsgId, role: 'assistant', content: streamedContent, reasoning: streamedReasoning, model: currentModel }], content);
          },
          onDone: () => { status.value = '回复生成完成'; triggerSync(); },
          onAbort: () => {
            status.value = '已停止生成';
            upsertActiveSession([...requestMsgs, { id: assistantMsgId, role: 'assistant', content: streamedContent || '(已停止)', reasoning: streamedReasoning, model: currentModel }], content);
          },
        },
        baseUrl,
        chatAbortController.signal,
      );
      if (!streamedContent && !chatAbortController.signal.aborted) {
        upsertActiveSession([...requestMsgs, { id: assistantMsgId, role: 'assistant', content: '(空响应)', reasoning: '', model: currentModel }], content);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '请求失败';
      status.value = errMsg;
      upsertActiveSession([...requestMsgs, { id: createId('err'), role: 'assistant', content: `请求失败：${errMsg}`, model: currentModel }], content);
    } finally {
      isSubmitting.value = false;
      chatAbortController = null;
    }
  }

  function stopGeneration() { chatAbortController?.abort(); }

  function clearChat(upsertActiveSession: (msgs: ChatMessage[]) => void) {
    upsertActiveSession([{ id: createId('assistant'), role: 'assistant', content: '聊天已清空，可以继续发起新的请求。' }]);
    requestId.value = '';
    status.value = '聊天已重置';
  }

  return { draft, isSubmitting, requestId, submitPrompt, stopGeneration, clearChat };
}
