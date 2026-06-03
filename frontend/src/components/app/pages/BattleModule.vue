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
const Lightning = bind(app, 'Lightning');
const Refresh = bind(app, 'Refresh');
const Sunny = bind(app, 'Sunny');
const SwitchButton = bind(app, 'SwitchButton');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const isLoadingModels = bind(app, 'isLoadingModels');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isComposing = bind(app, 'isComposing');
const requestId = bind(app, 'requestId');
const battlePrompt = bind(app, 'battlePrompt');
const isBattling = bind(app, 'isBattling');
const battleStatus = bind(app, 'battleStatus');
const battleLeftModel = bind(app, 'battleLeftModel');
const battleRightModel = bind(app, 'battleRightModel');
const battlePanels = bind(app, 'battlePanels');
const isAuthenticated = bind(app, 'isAuthenticated');
const battleStatusTagType = bind(app, 'battleStatusTagType');
const panelStatusTagType = bind(app, 'panelStatusTagType');
const loadModels = bind(app, 'loadModels');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const startBattle = bind(app, 'startBattle');
const stopBattle = bind(app, 'stopBattle');
const getModelTags = bind(app, 'getModelTags');
const battleModels = bind(app, 'battleModels');
const copyToClipboard = bind(app, 'copyToClipboard');
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <el-select v-model="battleLeftModel" placeholder="左侧模型（可选）" clearable filterable style="width:200px">
              <el-option v-for="m in battleModels" :key="m.id" :label="m.id" :value="m.id">
                <span>{{ m.id }}</span>
                <el-tag v-if="getModelTags(m.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
              </el-option>
            </el-select>
            <span style="color:#909399;font-weight:600">VS</span>
            <el-select v-model="battleRightModel" placeholder="右侧模型（可选）" clearable filterable style="width:200px">
              <el-option v-for="m in battleModels" :key="m.id" :label="m.id" :value="m.id">
                <span>{{ m.id }}</span>
                <el-tag v-if="getModelTags(m.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
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
            <el-tag :type="battleStatusTagType()">{{ battleStatus }}</el-tag>
            </template>
          </div>
        </div>

        <div class="battle-board">
          <el-card v-for="(panel, idx) in battlePanels" :key="idx" class="battle-card" shadow="hover">
            <div class="battle-card-head">
              <div class="head-left">
                <el-avatar :size="28" :icon="Cpu" :style="{ backgroundColor: idx === 0 ? '#1677ff' : '#7b68ee' }" />
                <el-tag size="small">{{ panel.model }}</el-tag>
              </div>
              <el-tag :type="panelStatusTagType(panel.status)" size="small">{{ panel.status }}</el-tag>
            </div>
            <div class="battle-body">
              <details v-if="panel.reasoning" open class="reasoning-box">
                <summary><el-icon><Sunny /></el-icon> 思考过程</summary>
                <p>{{ panel.reasoning }}</p>
              </details>
              <div
                class="markdown-content"
                :class="{ 'is-streaming-update': panel.status === '生成中' }"
                v-html="renderMarkdown(panel.content || (isBattling ? '正在生成回复...' : '等待回答'))"
              ></div>
            </div>
            <div v-if="panel.requestId" class="battle-foot">request id: {{ panel.requestId }}</div>
          </el-card>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <el-input
              v-model="battlePrompt"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="输入一个问题，两个模型并发回答（可在上方指定模型，留空则随机）"
              @keydown.enter.exact.prevent="startBattle()"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
            <div class="composer-bar">
              <div class="composer-meta">
                <el-text type="info" size="small">{{ battleLeftModel && battleRightModel ? battleLeftModel + ' vs ' + battleRightModel : '随机挑选 2 个模型并发回答' }}</el-text>
              </div>
              <div class="composer-actions">
                <el-button v-if="isBattling" type="danger" :icon="SwitchButton" @click="stopBattle()">停止对战</el-button>
                <el-button v-else type="primary" :icon="Lightning" @click="startBattle()" :disabled="!battlePrompt.trim()">开始 Battle</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
