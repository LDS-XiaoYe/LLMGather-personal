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
const Star = bind(app, 'Star');
const SwitchButton = bind(app, 'SwitchButton');
const TrendCharts = bind(app, 'TrendCharts');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const models = bind(app, 'models');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isComposing = bind(app, 'isComposing');
const collabMode = bind(app, 'collabMode');
const collabPrompt = bind(app, 'collabPrompt');
const collabRunning = bind(app, 'collabRunning');
const collabSelectedModels = bind(app, 'collabSelectedModels');
const collabPanels = bind(app, 'collabPanels');
const collabSummary = bind(app, 'collabSummary');
const collabSummaryStatus = bind(app, 'collabSummaryStatus');
const getCollabModelLogo = bind(app, 'getCollabModelLogo');
const isAuthenticated = bind(app, 'isAuthenticated');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const startCollab = bind(app, 'startCollab');
const clearCollab = bind(app, 'clearCollab');
const stopCollab = bind(app, 'stopCollab');
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>协同推理</strong>
            <el-radio-group v-model="collabMode" size="small" :disabled="collabRunning">
              <el-radio-button value="debate">并行辩论</el-radio-button>
              <el-radio-button value="review">同行评审</el-radio-button>
              <el-radio-button value="divide">分工协作</el-radio-button>
            </el-radio-group>
          </div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
              <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
              <el-dropdown v-else trigger="click" @command="handleUserMenu">
                <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="console"><el-icon><DataAnalysis /></el-icon> 控制台</el-dropdown-item>
                    <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </div>
        </div>

        <div class="thread" style="flex:1">
          <div v-if="collabPanels.length === 0 && !collabRunning" class="group-empty">
            <el-empty description="输入问题，多个AI模型将协同推理并返回最优结果。" :image-size="96">
              <template #image><el-icon :size="44" style="color:#8b5cf6"><TrendCharts /></el-icon></template>
            </el-empty>
          </div>

          <div v-else style="display:flex;flex-direction:column;gap:16px">
            <!-- Model panels with logos -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
              <el-card v-for="p in collabPanels" :key="p.modelId" shadow="hover" :style="{ borderLeft: `3px solid ${p.status === 'done' ? '#22c55e' : p.status === 'streaming' ? '#3b82f6' : '#d1d5db'}`, transition: 'border-color .3s' }">
                <template #header>
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:8px">
                      <el-avatar :size="24" :style="{ backgroundColor: getCollabModelLogo(p.modelId).color, fontSize:'11px', fontWeight:700 }">{{ getCollabModelLogo(p.modelId).initial }}</el-avatar>
                      <span style="font-weight:600;font-size:13px">{{ p.modelName }}</span>
                    </div>
                    <el-tag :type="p.status === 'done' ? 'success' : p.status === 'streaming' ? 'warning' : 'info'" size="small">{{ p.status === 'done' ? '✓ 完成' : p.status === 'streaming' ? '◉ 生成中' : '○ 等待' }}</el-tag>
                  </div>
                </template>
                <div class="markdown-content" v-html="renderMarkdown(p.content || (p.status === 'streaming' ? '▌' : '等待回复'))" style="font-size:13px;line-height:1.7;min-height:20px"></div>
              </el-card>
            </div>

            <!-- Continue / Refine button -->
            <div v-if="collabPanels.length > 0 && collabSummaryStatus === 'done' && !collabRunning" style="display:flex;gap:8px;justify-content:center">
              <el-button size="small" @click="startCollab('请综合以上结果，给出最终建议')">📋 继续讨论</el-button>
              <el-button size="small" @click="startCollab('请指出以上回答中可能存在的问题')">🔍 质疑分析</el-button>
              <el-button size="small" @click="startCollab('请用一句话总结以上讨论')">📝 一句话总结</el-button>
            </div>

            <!-- Summary panel -->
            <el-card v-if="collabSummaryStatus !== 'idle'" shadow="hover" style="border-left:3px solid #8b5cf6">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-icon color="#8b5cf6"><Star /></el-icon>
                  <strong style="font-size:13px">汇总结果</strong>
                  <el-tag v-if="collabSummaryStatus === 'streaming'" type="warning" size="small">生成中</el-tag>
                  <el-tag v-else type="success" size="small">完成</el-tag>
                </div>
              </template>
              <div class="markdown-content" v-html="renderMarkdown(collabSummary || '正在汇总...')" style="font-size:14px;line-height:1.7"></div>
            </el-card>
          </div>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <!-- Model selector -->
            <div style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span style="font-size:11px;color:#909399;flex-shrink:0">模型:</span>
              <el-select v-model="collabSelectedModels" multiple filterable placeholder="自动选择" size="small" style="flex:1;min-width:200px" :disabled="collabRunning" collapse-tags collapse-tags-tooltip>
                <el-option v-for="m in models.filter(x => !x.id.includes('vl') && !x.id.includes('tts') && !x.id.includes('voice'))" :key="m.id" :label="m.id" :value="m.id" />
              </el-select>
            </div>
            <el-input v-model="collabPrompt" type="textarea" :rows="2" resize="vertical" placeholder="输入问题，多个模型将协同推理..." :disabled="collabRunning" @keydown.enter.exact.prevent="startCollab()" @compositionstart="isComposing = true" @compositionend="isComposing = false" />
            <div class="composer-bar">
              <div class="composer-meta">
                <span class="meta-text">{{ collabSelectedModels.length > 0 ? `已选${collabSelectedModels.length}个模型` : '自动选择最佳模型' }}</span>
              </div>
              <div class="composer-actions">
                <el-button :icon="Delete" @click="clearCollab()" size="small">清空</el-button>
                <el-button v-if="collabRunning" type="danger" @click="stopCollab()" size="small">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="startCollab()" :disabled="!collabPrompt.trim()" size="small">发送</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
