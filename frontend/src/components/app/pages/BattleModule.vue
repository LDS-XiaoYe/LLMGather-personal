<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';
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
        <WorkspaceHeader title="模型对战" :app="app"><el-select aria-label="左侧模型" v-model="battleLeftModel" placeholder="左侧模型（可选）" clearable filterable style="width:200px">
              <el-option v-for="m in battleModels" :key="m.id" :label="m.id" :value="m.id">
                <span>{{ m.id }}</span>
                <el-tag v-if="getModelTags(m.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
              </el-option>
            </el-select><span style="color:#909399;font-weight:600">VS</span><el-select aria-label="右侧模型" v-model="battleRightModel" placeholder="右侧模型（可选）" clearable filterable style="width:200px">
              <el-option v-for="m in battleModels" :key="m.id" :label="m.id" :value="m.id">
                <span>{{ m.id }}</span>
                <el-tag v-if="getModelTags(m.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
              </el-option>
            </el-select><el-button :icon="Refresh" :loading="isLoadingModels" @click="loadModels()">刷新模型</el-button><template #status><span v-if="isBattling" class="ui-header-caption" role="status">进行中</span></template></WorkspaceHeader>

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
              placeholder="输入同一个问题，比较两个模型的回答"
              @keydown.enter.exact.prevent="startBattle()"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
            <div class="composer-bar">
              <div class="composer-meta">
                <el-text type="info" size="small">{{ battleLeftModel && battleRightModel ? battleLeftModel + ' vs ' + battleRightModel : '未指定模型时随机选择两项' }}</el-text>
              </div>
              <div class="composer-actions">
                <el-button v-if="isBattling" type="danger" :icon="SwitchButton" @click="stopBattle()">停止对战</el-button>
                <el-button v-else type="primary" :icon="Lightning" @click="startBattle()" :disabled="!battlePrompt.trim()">开始对比</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
