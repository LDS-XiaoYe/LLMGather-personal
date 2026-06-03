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
const Promotion = bind(app, 'Promotion');
const SwitchButton = bind(app, 'SwitchButton');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const models = bind(app, 'models');
const selectedModel = bind(app, 'selectedModel');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const draft = bind(app, 'draft');
const isComposing = bind(app, 'isComposing');
const isSubmitting = bind(app, 'isSubmitting');
const routerEnabled = bind(app, 'routerEnabled');
const routerIntent = bind(app, 'routerIntent');
const routerConfidence = bind(app, 'routerConfidence');
const routerSelectedModel = bind(app, 'routerSelectedModel');
const routerReason = bind(app, 'routerReason');
const routerFallbacks = bind(app, 'routerFallbacks');
const routerRules = bind(app, 'routerRules');
const routerLoading = bind(app, 'routerLoading');
const isAuthenticated = bind(app, 'isAuthenticated');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const stopChatGeneration = bind(app, 'stopChatGeneration');
const loadRouterRules = bind(app, 'loadRouterRules');
const submitRouterPrompt = bind(app, 'submitRouterPrompt');
</script>

<template>
        <div class="page-header">
          <div class="header-left"><strong>智能路由</strong></div>
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
          <el-empty v-if="!isAuthenticated" description="请先登录以使用智能路由" :image-size="96" />

          <div v-else style="display:flex;flex-direction:column;gap:24px;max-width:860px;margin:0 auto;width:100%">
            <!-- Route Decision Card -->
            <el-card shadow="hover">
              <template #header><strong>路由决策</strong></template>
              <div v-if="!routerIntent && !routerLoading" style="color:#909399;font-size:13px;text-align:center;padding:20px">
                向下方输入框发送消息，查看智能路由的决策过程
              </div>
              <div v-else style="display:flex;flex-direction:column;gap:12px">
                <div style="display:flex;gap:24px;flex-wrap:wrap">
                  <div>
                    <span style="font-size:12px;color:#909399">检测意图</span>
                    <el-tag size="small" :type="routerIntent ? 'success' : 'info'" style="margin-left:8px">{{ routerIntent || '等待中' }}</el-tag>
                  </div>
                  <div>
                    <span style="font-size:12px;color:#909399">置信度</span>
                    <span style="margin-left:8px;font-weight:600">{{ (routerConfidence * 100).toFixed(0) }}%</span>
                  </div>
                  <div>
                    <span style="font-size:12px;color:#909399">选中模型</span>
                    <el-tag size="small" type="warning" style="margin-left:8px">{{ routerSelectedModel || '-' }}</el-tag>
                  </div>
                </div>
                <div v-if="routerFallbacks.length > 0" style="font-size:12px;color:#909399">
                  备选: {{ routerFallbacks.join(', ') }}
                </div>
                <div v-if="routerReason" style="font-size:12px;color:#606266;background:#f8fafc;padding:8px 12px;border-radius:6px">
                  {{ routerReason }}
                </div>
              </div>
            </el-card>

            <!-- Router Rules Overview -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong>路由规则</strong>
                  <el-button size="small" @click="loadRouterRules()" :loading="routerLoading">刷新</el-button>
                </div>
              </template>
              <div v-if="Object.keys(routerRules).length === 0" style="color:#909399;font-size:13px;text-align:center;padding:12px">
                点击"刷新"加载路由规则
              </div>
              <div v-else style="display:flex;flex-direction:column;gap:8px">
                <div v-for="(models, intent) in routerRules" :key="intent" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
                  <el-tag size="small" type="primary" style="min-width:80px;text-align:center">{{ intent }}</el-tag>
                  <span style="font-size:13px;color:#606266">{{ models.join(' → ') }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </div>

        <div class="composer">
          <el-card class="composer-card" shadow="never">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <span style="font-size:12px;color:#909399">智能路由</span>
              <el-switch v-model="routerEnabled" size="small" />
              <span style="font-size:12px;color:#909399" v-if="routerEnabled">开启 — 自动选择最佳模型</span>
              <span style="font-size:12px;color:#909399" v-else>关闭 — 使用下方选择的模型</span>
            </div>
            <div v-if="!routerEnabled" style="margin-bottom:8px">
              <el-select v-model="selectedModel" filterable placeholder="选择模型" style="width:100%">
                <el-option v-for="m in models" :key="m.id" :label="m.id" :value="m.id" />
              </el-select>
            </div>
            <el-input
              v-model="draft"
              type="textarea"
              :rows="2"
              resize="vertical"
              placeholder="输入消息，智能路由将自动分析意图并选择最佳模型..."
              :disabled="isSubmitting || routerLoading"
              @keydown.enter.exact.prevent="submitRouterPrompt()"
              @compositionstart="isComposing = true"
              @compositionend="isComposing = false"
            />
            <div class="composer-bar">
              <div class="composer-meta">
                <span class="meta-text">{{ models.length }} 个模型可用</span>
              </div>
              <div class="composer-actions">
                <el-button v-if="isSubmitting" type="danger" :icon="SwitchButton" @click="stopChatGeneration()">停止</el-button>
                <el-button v-else type="primary" :icon="Promotion" @click="submitRouterPrompt()" :disabled="!draft.trim()">发送</el-button>
              </div>
            </div>
          </el-card>
        </div>
</template>
