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

const DataAnalysis = bind(app, 'DataAnalysis');
const Delete = bind(app, 'Delete');
const Promotion = bind(app, 'Promotion');
const Refresh = bind(app, 'Refresh');
const SwitchButton = bind(app, 'SwitchButton');
const User = bind(app, 'User');
const UserFilled = bind(app, 'UserFilled');
const getModelLogo = bind(app, 'getModelLogo');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const models = bind(app, 'models');
const isLoadingModels = bind(app, 'isLoadingModels');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isComposing = bind(app, 'isComposing');
const groupPrompt = bind(app, 'groupPrompt');
const isGrouping = bind(app, 'isGrouping');
const groupMessages = bind(app, 'groupMessages');
const groupThreadRef = bind(app, 'groupThreadRef');
const isAuthenticated = bind(app, 'isAuthenticated');
const loadModels = bind(app, 'loadModels');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const startGroupChat = bind(app, 'startGroupChat');
const clearGroupChat = bind(app, 'clearGroupChat');
const stopGroupChat = bind(app, 'stopGroupChat');
const groupModelList = bind(app, 'groupModelList');
const copyToClipboard = bind(app, 'copyToClipboard');
</script>

<template>
        <div class="page-header">
          <div class="header-left">
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
            <el-tag :type="isGrouping ? undefined : 'success'">{{ isGrouping ? '群聊进行中...' : `${groupModelList.length} 个参与模型` }}</el-tag>
            </template>
          </div>
        </div>

        <div ref="groupThreadRef" class="thread group-thread">
          <div v-if="groupMessages.length === 0" class="group-empty">
            <el-empty description="输入消息，AI 们将依次讨论回复。" :image-size="96">
              <template #image>
                <el-icon :size="44" style="color: #0ea5e9"><UserFilled /></el-icon>
              </template>
            </el-empty>
          </div>

          <template v-for="msg in groupMessages" :key="msg.id">
            <div v-if="msg.role === 'user'" class="chat-bubble is-user">
              <el-avatar :size="36" :icon="User" style="background-color:#1677ff;flex-shrink:0" />
              <div class="bubble-body">
                <div class="bubble-name">你</div>
                <p>{{ msg.content }}</p>
              </div>
            </div>

            <div v-else class="chat-bubble">
              <el-avatar
                :size="36"
                :src="getModelLogo(msg.model || '').url || undefined"
                :style="{ backgroundColor: getModelLogo(msg.model || '').color, flexShrink: 0 }"
              >
                {{ getModelLogo(msg.model || '').name.charAt(0).toUpperCase() }}
              </el-avatar>
              <div class="bubble-body">
                <div class="bubble-name">
                  {{ msg.model }}
                  <el-tag v-if="msg.status === 'streaming'" size="small" effect="dark" class="streaming-dot">生成中</el-tag>
                </div>
                <div
                  class="markdown-content group-content"
                  :class="{ 'is-streaming-update': msg.status === 'streaming' }"
                  v-html="renderMarkdown(msg.content || '正在生成回复...')"
                ></div>
              </div>
            </div>
          </template>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <el-input
              v-model="groupPrompt"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="输入消息，所有模型将逐个回复"
              :disabled="isGrouping"
              @keydown.enter.exact.prevent="startGroupChat()"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
            <div class="composer-bar">
              <div class="composer-meta">
                <el-text type="info" size="small">{{ models.length }} 个模型</el-text>
              </div>
              <div class="composer-actions">
                <el-button :icon="Delete" @click="clearGroupChat()">清空</el-button>
                <el-button v-if="isGrouping" type="danger" :icon="SwitchButton" @click="stopGroupChat()">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="startGroupChat()" :disabled="!groupPrompt.trim()">发送</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
