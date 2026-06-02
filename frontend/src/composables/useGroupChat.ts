import { ref } from 'vue';
import { streamCompletion } from '../api';
import type { GroupChatMessage, ChatSession } from '../types';
import { models } from './state';
import { shuffleArray, createId } from '../utils';

const groupPrompt = ref('');
const isGrouping = ref(false);
const groupMessages = ref<GroupChatMessage[]>([]);
let groupAbortController: AbortController | null = null;

export function useGroupChat() {
  async function startGroupChat(
    addSession: (session: ChatSession) => void,
    baseUrl: string,
  ) {
    const prompt = groupPrompt.value.trim();
    if (!prompt || isGrouping.value || models.value.length === 0) return;

    groupPrompt.value = '';
    isGrouping.value = true;
    groupAbortController = new AbortController();
    const sig = groupAbortController.signal;

    const userId = createId('group-user');
    groupMessages.value.push({ id: userId, role: 'user', content: prompt });

    const filtered = models.value;
    if (filtered.length === 0) { isGrouping.value = false; return; }

    for (const model of shuffleArray(filtered)) {
      if (sig.aborted) break;

      const discussionMessages = groupMessages.value.filter((m) => m.content.trim().length > 0);
      const aid = createId('group-assistant');
      groupMessages.value.push({ id: aid, role: 'assistant', model: model.id, content: '', status: 'streaming' });

      let content = '';
      try {
        await streamCompletion(
          {
            model: model.id,
            messages: [
              { role: 'system', content: `你正在一个AI群组讨论中回答用户的问题。群组中还有其他AI模型。请参考其他AI的发言来完善你的回答。你的名字是「${model.id}」。直接回复内容即可，不要在回复开头加上自己的名字或任何前缀。` },
              ...discussionMessages.map((m) =>
                m.role === 'user'
                  ? ({ role: 'user' as const, content: m.content })
                  : ({ role: 'assistant' as const, content: m.content }),
              ),
            ],
            temperature: 0.7,
          },
          {
            onChunk: (chunk) => {
              const t = chunk.choices?.[0]?.delta?.content;
              if (t) { content += t; groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content, status: 'streaming' } : m); }
            },
            onDone: () => { groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: content || '(空响应)', status: 'done' } : m); },
            onAbort: () => { groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: content || '(已停止)', status: 'done' } : m); },
          },
          baseUrl,
          sig,
        );
      } catch {
        groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: '请求失败', status: 'error' } : m);
      }
    }

    isGrouping.value = false;
    groupAbortController = null;

    if (groupMessages.value.length > 0) {
      addSession({
        id: createId('group'),
        title: groupMessages.value[0]?.content.slice(0, 40) || '群组讨论',
        chatType: 'group',
        messages: groupMessages.value.map((m) => ({ id: m.id, role: m.role, content: m.content, model: m.model })),
        updatedAt: Date.now(),
      });
    }
  }

  function clearGroupChat() { groupMessages.value = []; }
  function stopGroupChat() { groupAbortController?.abort(); }

  return { groupPrompt, isGrouping, groupMessages, startGroupChat, clearGroupChat, stopGroupChat };
}
