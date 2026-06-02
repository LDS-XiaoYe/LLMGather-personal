import { ref } from 'vue';
import { streamCompletion } from '../api';
import type { BattlePanelState, ChatSession } from '../types';
import type { ModelDescriptor } from '../api';
import { models, status } from './state';
import { pickTwoRandomModels, createId } from '../utils';

const battlePrompt = ref('');
const isBattling = ref(false);
const battleStatus = ref('等待开始');
const battlePanels = ref<[BattlePanelState, BattlePanelState]>([
  { model: '-', content: '', reasoning: '', requestId: '', status: '待机' },
  { model: '-', content: '', reasoning: '', requestId: '', status: '待机' },
]);
let battleAbortController: AbortController | null = null;

export function useBattle() {
  function battleStatusTagType(): 'success' | 'danger' | 'info' | undefined {
    const s = battleStatus.value;
    if (s === '完成') return 'success';
    if (s === '生成中' || s === '对战进行中') return undefined;
    if (s === '已停止' || s === '失败') return 'danger';
    return 'info';
  }

  function panelStatusTagType(s: string): 'success' | 'danger' | 'info' | undefined {
    if (s === '完成') return 'success';
    if (s === '生成中') return undefined;
    if (s === '已停止' || s === '失败') return 'danger';
    return 'info';
  }

  async function startBattle(
    addSession: (session: ChatSession) => void,
    baseUrl: string,
  ) {
    const prompt = battlePrompt.value.trim();
    if (!prompt || isBattling.value) return;

    battlePrompt.value = '';
    const selected = pickTwoRandomModels(models.value);
    if (!selected) { battleStatus.value = '可用模型不足 2 个'; return; }

    const [left, right] = selected;
    isBattling.value = true;
    battleStatus.value = '对战进行中';
    battlePanels.value = [
      { model: left, content: '', reasoning: '', requestId: '', status: '生成中' },
      { model: right, content: '', reasoning: '', requestId: '', status: '生成中' },
    ];

    battleAbortController = new AbortController();
    const sig = battleAbortController.signal;

    async function runOne(index: 0 | 1, model: string) {
      let content = '', reasoning = '';
      await streamCompletion(
        { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, extra_body: { enable_thinking: true } },
        {
          onRequestId: (rid) => {
            const p = [...battlePanels.value]; p[index] = { ...p[index], requestId: rid }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
          },
          onChunk: (chunk) => {
            const d = chunk.choices?.[0]?.delta;
            if (d?.content) content += d.content;
            if (d?.reasoning_content) reasoning += d.reasoning_content;
            const p = [...battlePanels.value]; p[index] = { ...p[index], content, reasoning, status: '生成中' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
          },
          onDone: () => {
            const p = [...battlePanels.value]; p[index] = { ...p[index], content: content || '(空响应)', reasoning, status: '完成' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
          },
          onAbort: () => {
            const p = [...battlePanels.value]; p[index] = { ...p[index], content: content || '(已停止)', reasoning, status: '已停止' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
          },
        },
        baseUrl,
        sig,
      );
    }

    try {
      await Promise.all([runOne(0, left), runOne(1, right)]);
      battleStatus.value = '对战完成';
      addSession({
        id: createId('battle'),
        title: prompt.slice(0, 40),
        chatType: 'battle',
        messages: [
          { id: createId('user'), role: 'user', content: prompt },
          { id: createId('assistant'), role: 'assistant', content: battlePanels.value[0].content, model: left },
          { id: createId('assistant'), role: 'assistant', content: battlePanels.value[1].content, model: right },
        ],
        updatedAt: Date.now(),
      });
    } catch (error) {
      battleStatus.value = error instanceof Error ? error.message : '对战失败';
      const p = [...battlePanels.value];
      p[0] = { ...p[0], status: '失败' };
      p[1] = { ...p[1], status: '失败' };
      battlePanels.value = p as [BattlePanelState, BattlePanelState];
    } finally {
      isBattling.value = false;
      battleAbortController = null;
    }
  }

  function stopBattle() { battleAbortController?.abort(); }

  return { battlePrompt, isBattling, battleStatus, battlePanels, battleStatusTagType, panelStatusTagType, startBattle, stopBattle };
}
