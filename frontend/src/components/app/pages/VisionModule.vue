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
const Delete = bind(app, 'Delete');
const Promotion = bind(app, 'Promotion');
const SwitchButton = bind(app, 'SwitchButton');
const User = bind(app, 'User');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isComposing = bind(app, 'isComposing');
const isAuthenticated = bind(app, 'isAuthenticated');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const visionPrompt = bind(app, 'visionPrompt');
const visionImageBase64 = bind(app, 'visionImageBase64');
const visionImageName = bind(app, 'visionImageName');
const visionModel = bind(app, 'visionModel');
const visionMessages = bind(app, 'visionMessages');
const isVisionSubmitting = bind(app, 'isVisionSubmitting');
const visionFileRef = bind(app, 'visionFileRef');
const visionModels = bind(app, 'visionModels');
const handleVisionImageUpload = bind(app, 'handleVisionImageUpload');
const removeVisionImage = bind(app, 'removeVisionImage');
const openImageInNewTab = bind(app, 'openImageInNewTab');
const submitVisionPrompt = bind(app, 'submitVisionPrompt');
const clearVisionChat = bind(app, 'clearVisionChat');
const stopVisionChat = bind(app, 'stopVisionChat');
const copyToClipboard = bind(app, 'copyToClipboard');
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>视觉模型</strong>
            <el-select v-model="visionModel" filterable style="width:240px" :disabled="isVisionSubmitting">
              <el-option v-for="m in visionModels" :key="m.id" :label="m.id" :value="m.id" />
            </el-select>
          </div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
              <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
              <el-dropdown v-else trigger="click" @command="handleUserMenu">
                <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="userInvitationCode" disabled>
                      <span style="color:#666;">邀请码：{{ userInvitationCode }}</span>
                      <el-button size="small" style="margin-left:8px" @click.stop="copyToClipboard(userInvitationCode)">复制</el-button>
                    </el-dropdown-item>
                    <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </div>
        </div>

        <div class="thread" style="flex:1">
          <div v-if="visionMessages.length === 0" class="group-empty">
            <el-empty description="上传图片并提问，视觉模型将理解图片内容并回答。" :image-size="96">
              <template #image>
                <el-icon :size="44" style="color: #8b5cf6"><Cpu /></el-icon>
              </template>
            </el-empty>
          </div>

          <template v-for="msg in visionMessages" :key="msg.id">
            <div class="chat-bubble" :class="msg.role === 'user' ? 'is-user' : ''">
              <el-avatar :size="36" :icon="msg.role === 'user' ? User : Cpu" :style="{ backgroundColor: msg.role === 'user' ? '#1677ff' : '#8b5cf6', flexShrink: 0 }" />
              <div class="bubble-body">
                <div class="bubble-name">{{ msg.role === 'user' ? '你' : visionModel }}</div>
                <div v-if="msg.role === 'user' && msg.image" style="margin-bottom:8px">
                  <img :src="msg.image" style="max-width:300px;max-height:200px;border-radius:8px;cursor:pointer" @click="openImageInNewTab(msg.image)" />
                </div>
                <div v-if="msg.role === 'assistant'" class="markdown-content" v-html="renderMarkdown(msg.content || (isVisionSubmitting ? '正在分析图片...' : ''))"></div>
                <p v-else>{{ msg.content }}</p>
              </div>
            </div>
          </template>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <div v-if="visionImageBase64" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
              <img :src="visionImageBase64" style="height:48px;border-radius:6px" />
              <span style="font-size:12px;color:#909399">{{ visionImageName }}</span>
              <el-button size="small" text type="danger" @click="removeVisionImage()">移除</el-button>
            </div>
            <div style="display:flex;gap:8px">
              <el-input v-model="visionPrompt" type="textarea" :rows="2" resize="vertical" placeholder="上传图片后输入问题…" @keydown.enter.exact.prevent="submitVisionPrompt()" @compositionstart="isComposing = true" @compositionend="isComposing = false" style="flex:1" />
            </div>
            <div class="composer-bar">
              <div class="composer-meta">
                <el-button size="small" @click="visionFileRef?.click()">上传图片</el-button>
                <input :ref="(el: any) => { visionFileRef = el }" type="file" accept="image/*" style="display:none" @change="handleVisionImageUpload" />
              </div>
              <div class="composer-actions">
                <el-button :icon="Delete" @click="clearVisionChat()">清空</el-button>
                <el-button v-if="isVisionSubmitting" type="danger" :icon="SwitchButton" @click="stopVisionChat()">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="submitVisionPrompt()" :disabled="!visionPrompt.trim() || !visionImageBase64">发送</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
