import { ref, computed, watch, nextTick } from 'vue';
import {
  deleteConversation,
  fetchConversations,
  syncConversations,
  type ConversationSession,
} from '../api';
import type { ChatMessage, ChatSession } from '../types';
import { authUser, isSessionLoaded, sessions as stateSessions, activeSessionId } from './state';
import { createId, buildSessionTitle } from '../utils';

let sessionsSyncTimer: number | null = null;

// We expose a computed from the shared state
const sessions = computed(() => stateSessions.value);
const sidebarSessions = computed(() => sessions.value.filter((s) => !s.isDraft));

const activeSession = computed(
  () => sessions.value.find((s) => s.id === activeSessionId.value) ?? sessions.value[0],
);
const activeMessages = computed(() => activeSession.value?.messages ?? []);

export function useSessions() {
  function createNewChat() {
    const next: ChatSession = {
      id: createId('session'),
      title: '新对话',
      chatType: 'direct',
      messages: [],
      updatedAt: Date.now(),
      isDraft: true,
    };
    stateSessions.value = [next, ...stateSessions.value];
    activeSessionId.value = next.id;
  }

  function upsertActiveSession(nextMessages: ChatMessage[], titleHint?: string) {
    const session = activeSession.value;
    if (!session) return;

    const hasUserMessage = nextMessages.some((m) => m.role === 'user');

    stateSessions.value = stateSessions.value
      .map((s) => {
        if (s.id !== session.id) return s;
        const title = s.title === '新对话' || s.title === '欢迎对话'
          ? buildSessionTitle(titleHint ?? nextMessages.find((m) => m.role === 'user')?.content ?? '')
          : s.title;
        return { ...s, title, messages: nextMessages, updatedAt: Date.now(), ...(hasUserMessage && s.isDraft ? { isDraft: false } : {}) };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function handleSoftDeleteSession(sessionId: string, baseUrl: string) {
    try {
      await deleteConversation(sessionId, baseUrl);
      stateSessions.value = stateSessions.value.filter((s) => s.id !== sessionId);
      if (activeSessionId.value === sessionId) {
        activeSessionId.value = stateSessions.value[0]?.id ?? '';
      }
      if (stateSessions.value.length === 0) createNewChat();
    } catch { /* handled by caller */ }
  }

  function triggerSync(baseUrl: string) {
    if (!authUser.value || !isSessionLoaded.value) return;
    if (sessionsSyncTimer !== null) {
      window.clearTimeout(sessionsSyncTimer);
      sessionsSyncTimer = null;
    }
    const nonDraft = stateSessions.value.filter((s) => !s.isDraft);
    if (nonDraft.length === 0) return;
    const toSync = nonDraft.map(({ isDraft, ...rest }) => rest as ConversationSession);
    syncConversations(toSync, baseUrl).catch((err) => { console.error('[triggerSync] failed:', err); });
  }

  async function loadUserData(baseUrl: string) {
    try {
      const remote = await fetchConversations(baseUrl);
      if (remote.length > 0) {
        const mapped = remote.map((s) => ({
          ...s,
          chatType: (s.chatType || 'direct') as 'direct' | 'battle' | 'group',
          updatedAt: typeof s.updatedAt === 'string' ? Number(s.updatedAt) : s.updatedAt,
          messages: Array.isArray(s.messages)
            ? s.messages.map((m) => ({ ...m, id: String(m.id), content: m.content ?? '' }))
            : [],
        }));
        const draft = { id: createId('session'), title: '新对话', chatType: 'direct' as const, messages: [] as ChatMessage[], updatedAt: Date.now(), isDraft: true };
        stateSessions.value = [draft, ...mapped];
        activeSessionId.value = draft.id;
      }
    } catch (e) { console.error('[loadUserData] conversations failed:', e); }
    isSessionLoaded.value = true;
  }

  // Auto-sync watcher
  watch(
    sessions,
    () => {
      if (!authUser.value || !isSessionLoaded.value) return;
      if (sessionsSyncTimer !== null) window.clearTimeout(sessionsSyncTimer);
      sessionsSyncTimer = window.setTimeout(() => {
        const nonDraft = stateSessions.value.filter((s) => !s.isDraft);
        if (nonDraft.length === 0) return;
        syncConversations(nonDraft.map(({ isDraft, ...rest }) => rest as ConversationSession), '').catch(() => {});
      }, 1000);
    },
    { deep: true },
  );

  return {
    sessions, sidebarSessions, activeSession, activeMessages,
    activeSessionId, isSessionLoaded,
    createNewChat, upsertActiveSession, handleSoftDeleteSession,
    triggerSync, loadUserData,
  };
}
