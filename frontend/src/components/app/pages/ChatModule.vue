<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref, onMounted, onUnmounted, watch } from 'vue';
import WorkspaceHeader from '../../ui/WorkspaceHeader.vue';
import type { PageMode } from '../../../types';

const props = defineProps<{ app: Record<string, any> }>();
const app = props.app;
const bind = (target: Record<string, any>, key: string) => vueComputed({
  get: () => unref(target[key]),
  set: (value) => {
    if (isRef(target[key])) target[key].value = value;
    else target[key] = value;
  },
});

const Cpu = bind(app, 'Cpu');
const DataAnalysis = bind(app, 'DataAnalysis');
const Delete = bind(app, 'Delete');
const Promotion = bind(app, 'Promotion');
const Sunny = bind(app, 'Sunny');
const SwitchButton = bind(app, 'SwitchButton');
const User = bind(app, 'User');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const selectedModel = bind(app, 'selectedModel');
const chatThinkingMode = bind(app, 'chatThinkingMode');
const isLoadingModels = bind(app, 'isLoadingModels');
const modelRefreshError = bind(app, 'modelRefreshError');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const draft = bind(app, 'draft');
const isComposing = bind(app, 'isComposing');
const isSubmitting = bind(app, 'isSubmitting');
const requestId = bind(app, 'requestId');
const threadRef = bind(app, 'threadRef');
const activeMessages = bind(app, 'activeMessages');
const isAuthenticated = bind(app, 'isAuthenticated');
const loadModels = bind(app, 'loadModels');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const submitPrompt = bind(app, 'submitPrompt');
const stopChatGeneration = bind(app, 'stopChatGeneration');
const clearChat = bind(app, 'clearChat');
const getModelTags = bind(app, 'getModelTags');
const chatModels = bind(app, 'chatModels');
const copyToClipboard = bind(app, 'copyToClipboard');
const openAgentRunTrace = bind(app, 'openAgentRunTrace');
const switchPage = bind(app, 'switchPage');

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastRefreshAt = -Infinity;
let lastRefreshScope = '';
function refreshChatModels(open: boolean | Event = true) {
  if (!open || !isAuthenticated.value || document.visibilityState !== 'visible' || isSubmitting.value || isLoadingModels.value) return;
  const scope = `${unref(app.authUser)?.id}|${unref(app.backendBaseUrl)}`;
  if (scope === lastRefreshScope && Date.now() - lastRefreshAt < 5000) return;
  lastRefreshScope = scope;
  lastRefreshAt = Date.now();
  void loadModels.value({ silent: true });
}
watch([() => unref(app.authUser)?.id, () => unref(app.backendBaseUrl)], () => refreshChatModels());
onMounted(() => {
  refreshChatModels();
  refreshTimer = setInterval(() => refreshChatModels(), 60_000);
  window.addEventListener('focus', refreshChatModels);
  document.addEventListener('visibilitychange', refreshChatModels);
});
onUnmounted(() => {
  if (refreshTimer !== null) clearInterval(refreshTimer);
  window.removeEventListener('focus', refreshChatModels);
  document.removeEventListener('visibilitychange', refreshChatModels);
});
</script>

<template>
        <WorkspaceHeader title="聊天" :app="app"><template #status><span v-if="isSubmitting" class="ui-header-caption" role="status">进行中</span></template></WorkspaceHeader>

        <div ref="threadRef" class="thread">
          <div v-if="!activeMessages.length" class="ui-empty-conversation"><h2>开始一段对话</h2><p>直接提问，或选择适合任务的模型。</p></div>
          <div
            v-for="msg in activeMessages"
            :key="msg.id"
            class="chat-bubble"
            :class="msg.role === 'user' ? 'is-user' : ''"
          >
            <el-avatar
              :size="36"
              :icon="msg.role === 'user' ? User : Cpu"
              :style="{ backgroundColor: msg.role === 'user' ? '#1677ff' : '#7b68ee', flexShrink: 0 }"
            />
            <div class="bubble-body">
              <div class="bubble-name">{{ msg.role === 'user' ? '你' : '助手' }}</div>

              <template v-if="msg.role === 'assistant'">
                <div class="assistant-content-stack">
                  <!-- Auto routing status -->
                  <div v-if="msg.routerInfo" style="padding:4px 10px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;margin-bottom:4px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <el-tag size="small" type="danger">自动</el-tag>
                      <span style="color:#3b82f6">→</span>
                      <el-tag size="small" :type="msg.routerInfo.targetType === 'builtin_agent' ? 'success' : (msg.routerInfo.intent === 'coding' ? 'warning' : 'primary')">
                        {{ msg.routerInfo.targetType === 'builtin_agent' ? 'Agent' : msg.routerInfo.intentLabel }}
                      </el-tag>
                      <span style="color:#64748b;flex:1">{{ msg.routerInfo.model }}</span>
                      <el-button
                        v-if="msg.routerInfo.traceAvailable && msg.routerInfo.runId"
                        size="small"
                        text
                        type="primary"
                        @click="switchPage('agent'); openAgentRunTrace(msg.routerInfo.runId)"
                      >追踪</el-button>
                    </div>
                    <!-- Debug panel per-message -->
                    <details v-if="msg.routerInfo.debug && msg.routerInfo.debug.classifierModel" class="ui-routing-details"><summary>路由详情</summary>
                      <div><strong>分类模型:</strong> {{ msg.routerInfo.debug.classifierModel }}</div>
                      <div><strong>分类器输出:</strong> <code style="background:#fef3c7;padding:1px 4px;border-radius:2px">{{ msg.routerInfo.debug.rawOutput || '(空)' }}</code></div>
                      <div><strong>匹配方式:</strong> {{ msg.routerInfo.debug.matchedBy === 'label' ? '精确匹配' : msg.routerInfo.debug.matchedBy === 'fuzzy' ? '模糊匹配' : '降级通用' }}</div>
                      <div style="margin-top:4px"><strong>提示词:</strong><pre style="margin:2px 0 0;white-space:pre-wrap;font-size:10px;color:#78716c">{{ msg.routerInfo.debug.prompt }}</pre></div>
                    </details>
                  </div>
                  <details v-if="msg.reasoning && !msg.routerInfo" class="reasoning-box">
                    <summary><el-icon><Sunny /></el-icon> 思考过程</summary>
                    <p>{{ msg.reasoning }}</p>
                  </details>
                  <div
                    v-if="msg.content"
                    class="markdown-content"
                    :class="{ 'is-streaming-update': isSubmitting && msg.id === activeMessages[activeMessages.length - 1]?.id }"
                    v-html="renderMarkdown(msg.content)"
                  ></div>
                  <div v-else-if="isSubmitting" class="streaming-placeholder">正在生成回复...</div>
                </div>
              </template>
              <template v-else>
                <p>{{ msg.content }}</p>
              </template>
            </div>
          </div>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <el-input
              v-model="draft"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="给 LLM Gather 发送消息…"
              @keydown.enter.exact.prevent="submitPrompt()"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
            <div class="composer-bar">
              <div class="composer-meta">
                <el-segmented
                  v-model="chatThinkingMode"
                  class="chat-mode-select"
                  aria-label="回答模式"
                  name="chat-response-mode"
                  :options="[{ label: '思考', value: true }, { label: '直答', value: false }]"
                  :disabled="isSubmitting"
                  :title="isSubmitting ? '回复生成中，结束后可切换' : '选择是否启用模型思考'"
                />
                <el-text v-if="requestId" :title="requestId" type="info" size="small">请求 ID：{{ requestId }}</el-text>
              </div>
              <div class="composer-actions">
                <el-select class="chat-model-select" aria-label="聊天模型" v-model="selectedModel" placeholder="选择模型" filterable :loading="isLoadingModels" :disabled="isSubmitting" @visible-change="refreshChatModels">
                  <el-option label="自动选择（智能路由）" value="auto">
                    <span style="font-weight:600">自动选择</span>
                    <el-tag size="small" type="info" style="margin-left:6px">智能路由</el-tag>
                  </el-option>
                  <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id">
                    <span>{{ model.id }}</span>
                    <el-tag v-if="getModelTags(model.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
                    <el-tag v-if="getModelTags(model.id).includes('audio')" size="small" type="success" style="margin-left:4px">音频</el-tag>
                  </el-option>
                </el-select>
                <el-button :icon="Delete" @click="clearChat()">清空</el-button>
                <el-button v-if="isSubmitting" type="danger" :icon="SwitchButton" @click="stopChatGeneration()">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="submitPrompt()" :disabled="!draft.trim()">发送</el-button>
              </div>
            </div>
            <el-text v-if="modelRefreshError" class="chat-model-error" type="danger" size="small" role="status">{{ modelRefreshError }}</el-text>
          </el-card>
        </div>
</template>

<style scoped>
.chat-mode-select {
  --el-border-radius-base: 999px;
  --el-segmented-item-selected-bg-color: color-mix(in srgb, var(--el-color-primary) 14%, var(--el-fill-color-blank));
  --el-segmented-item-selected-color: var(--el-color-primary);
  --el-segmented-item-selected-disabled-bg-color: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  flex: 0 0 auto;
  width: 132px;
  height: 32px;
  font-size: 13px;
}
.chat-mode-select :deep(.el-segmented__item.is-selected) { font-weight: 500; }
.chat-mode-select :deep(.el-segmented__item.is-disabled) { color: var(--el-text-color-placeholder); }
.composer-meta { min-width: 0; flex: 1 1 180px; gap: 12px; }
.composer-meta :deep(.el-text) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composer-actions { display: grid; grid-template-columns: minmax(140px, 240px) auto auto; align-items: center; flex: 0 1 auto; }
.chat-model-select { width: 100%; min-width: 0; }
.chat-model-error { display: block; margin-top: 8px; }
.composer-actions :deep(.el-button) { margin: 0; }
@media (max-width: 480px) {
  .composer-bar { gap: 8px; }
  .composer-meta { flex: 1 1 100%; }
  .composer-meta :deep(.el-text) { display: none; }
  .composer-actions { gap: 6px; width: 100%; grid-template-columns: minmax(0, 1fr) auto auto; }
  .composer-actions :deep(.el-button) { padding: 8px 12px; }
}
</style>
