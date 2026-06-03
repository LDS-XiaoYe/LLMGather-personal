<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';
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
const Refresh = bind(app, 'Refresh');
const Sunny = bind(app, 'Sunny');
const SwitchButton = bind(app, 'SwitchButton');
const User = bind(app, 'User');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const selectedModel = bind(app, 'selectedModel');
const isLoadingModels = bind(app, 'isLoadingModels');
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
</script>

<template>
        <div class="page-header">
          <div class="header-left">
            <el-select v-model="selectedModel" placeholder="选择模型" filterable :style="{ width: '240px' }">
              <el-option label="🤖 Auto (智能路由)" value="auto">
                <span style="font-weight:600">🤖 Auto</span>
                <el-tag size="small" type="danger" style="margin-left:6px">智能路由</el-tag>
              </el-option>
              <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id">
                <span>{{ model.id }}</span>
                <el-tag v-if="getModelTags(model.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
                <el-tag v-if="getModelTags(model.id).includes('audio')" size="small" type="success" style="margin-left:4px">音频</el-tag>
              </el-option>
            </el-select>
            <el-button :icon="Refresh" :loading="isLoadingModels" @click="loadModels()">刷新模型</el-button>
          </div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
            <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
            <el-dropdown v-else trigger="click" @command="handleUserMenu">
              <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="console"><el-icon><DataAnalysis /></el-icon> 控制台</el-dropdown-item>
                  <el-dropdown-item v-if="userInvitationCode" disabled>
                    <span style="color:#666;">邀请码：{{ userInvitationCode }}</span>
                    <el-button size="small" style="margin-left:8px" @click.stop="copyToClipboard(userInvitationCode)">复制</el-button>
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-tag :type="status.includes('完成') || status.includes('已加载') ? 'success' : undefined">{{ status }}</el-tag>
            </template>
          </div>
        </div>

        <div ref="threadRef" class="thread">
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
                      <el-tag size="small" type="danger">Auto</el-tag>
                      <span style="color:#3b82f6">→</span>
                      <el-tag size="small" :type="msg.routerInfo.intent === 'coding' ? 'warning' : 'primary'">{{ msg.routerInfo.intentLabel }}</el-tag>
                      <span style="color:#64748b;flex:1">{{ msg.routerInfo.model }}</span>
                    </div>
                    <!-- Debug panel per-message -->
                    <div v-if="msg.routerInfo.debug && msg.routerInfo.debug.classifierModel" style="margin-top:6px;padding:8px 10px;background:#fefce8;border:1px dashed #f59e0b;border-radius:4px;font-family:monospace;font-size:11px;line-height:1.6;color:#92400e">
                      <div><strong>分类模型:</strong> {{ msg.routerInfo.debug.classifierModel }}</div>
                      <div><strong>分类器输出:</strong> <code style="background:#fef3c7;padding:1px 4px;border-radius:2px">{{ msg.routerInfo.debug.rawOutput || '(空)' }}</code></div>
                      <div><strong>匹配方式:</strong> {{ msg.routerInfo.debug.matchedBy === 'label' ? '✅ 精确匹配' : msg.routerInfo.debug.matchedBy === 'fuzzy' ? '⚠️ 模糊匹配' : '❌ 降级通用' }}</div>
                      <div style="margin-top:4px"><strong>Prompt:</strong><pre style="margin:2px 0 0;white-space:pre-wrap;font-size:10px;color:#78716c">{{ msg.routerInfo.debug.prompt }}</pre></div>
                    </div>
                  </div>
                  <details v-if="msg.reasoning && !msg.routerInfo" open class="reasoning-box">
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
                <el-text v-if="requestId" type="info" size="small">request id: {{ requestId }}</el-text>
              </div>
              <div class="composer-actions">
                <el-button :icon="Delete" @click="clearChat()">清空</el-button>
                <el-button v-if="isSubmitting" type="danger" :icon="SwitchButton" @click="stopChatGeneration()">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="submitPrompt()" :disabled="!draft.trim()">发送</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
