<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';
import type { PageMode } from '../../types';
import ChatModule from './pages/ChatModule.vue';
import AgentModule from './pages/AgentModule.vue';
import RagModule from './pages/RagModule.vue';
import BattleModule from './pages/BattleModule.vue';
import GroupModule from './pages/GroupModule.vue';
import VisionModule from './pages/VisionModule.vue';
import TtsModule from './pages/TtsModule.vue';
import MultimodalModule from './pages/MultimodalModule.vue';
import CollabModule from './pages/CollabModule.vue';
import RouterModule from './pages/RouterModule.vue';
import DocsModule from './pages/DocsModule.vue';
import ConsoleModule from './pages/ConsoleModule.vue';
import ApiModule from './pages/ApiModule.vue';
import AdminModule from './pages/AdminModule.vue';

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
const ChatDotRound = bind(app, 'ChatDotRound');
const DataAnalysis = bind(app, 'DataAnalysis');
const Delete = bind(app, 'Delete');
const Document = bind(app, 'Document');
const Headset = bind(app, 'Headset');
const Lightning = bind(app, 'Lightning');
const MoreFilled = bind(app, 'MoreFilled');
const Monitor = bind(app, 'Monitor');
const PictureFilled = bind(app, 'PictureFilled');
const Plus = bind(app, 'Plus');
const Setting = bind(app, 'Setting');
const Star = bind(app, 'Star');
const TrendCharts = bind(app, 'TrendCharts');
const UserFilled = bind(app, 'UserFilled');
const VideoCamera = bind(app, 'VideoCamera');
const MagicStick = bind(app, 'MagicStick');
const theme = bind(app, 'theme');
const chatThinkingMode = bind(app, 'chatThinkingMode');
const menuBgColor = bind(app, 'menuBgColor');
const menuTextColor = bind(app, 'menuTextColor');
const menuActiveColor = bind(app, 'menuActiveColor');
const isSettingsOpen = bind(app, 'isSettingsOpen');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const isAuthenticated = bind(app, 'isAuthenticated');
const authMode = bind(app, 'authMode');
const authUsername = bind(app, 'authUsername');
const authPassword = bind(app, 'authPassword');
const authEmail = bind(app, 'authEmail');
const authVerificationCode = bind(app, 'authVerificationCode');
const authInvitationCode = bind(app, 'authInvitationCode');
const authLoading = bind(app, 'authLoading');
const authError = bind(app, 'authError');
const codeCountdown = bind(app, 'codeCountdown');
const rechargeDialogVisible = bind(app, 'rechargeDialogVisible');
const rechargeAmount = bind(app, 'rechargeAmount');
const rechargeLoading = bind(app, 'rechargeLoading');
const rechargeQrCode = bind(app, 'rechargeQrCode');
const rechargeOrderId = bind(app, 'rechargeOrderId');
const rechargeError = bind(app, 'rechargeError');
const rechargeChecking = bind(app, 'rechargeChecking');
const agents = bind(app, 'agents');
const activeAgentId = bind(app, 'activeAgentId');
const agentLoading = bind(app, 'agentLoading');
const settingsMemories = bind(app, 'settingsMemories');
const settingsMemoryLoading = bind(app, 'settingsMemoryLoading');
const settingsMemorySaving = bind(app, 'settingsMemorySaving');
const settingsMemoryForm = bind(app, 'settingsMemoryForm');
const sessions = bind(app, 'sessions');
const activeSessionId = bind(app, 'activeSessionId');
const pageMode = bind(app, 'pageMode');
const sidebarSessions = bind(app, 'sidebarSessions');
const isAdmin = bind(app, 'isAdmin');
const createAgentDraft = bind(app, 'createAgentDraft');
const selectAgent = bind(app, 'selectAgent');
const removeAgent = bind(app, 'removeAgent');
const loadSettingsMemories = bind(app, 'loadSettingsMemories');
const createSettingsMemory = bind(app, 'createSettingsMemory');
const deleteSettingsMemory = bind(app, 'deleteSettingsMemory');
const forgetAllSettingsMemories = bind(app, 'forgetAllSettingsMemories');
const submitAuth = bind(app, 'submitAuth');
const onAuthDialogClosed = bind(app, 'onAuthDialogClosed');
const handleSendCode = bind(app, 'handleSendCode');
const submitRecharge = bind(app, 'submitRecharge');
const stopRechargePolling = bind(app, 'stopRechargePolling');
const handleCheckPayment = bind(app, 'handleCheckPayment');
const closeRechargeDialog = bind(app, 'closeRechargeDialog');
const createNewChat = bind(app, 'createNewChat');
const handleSoftDeleteSession = bind(app, 'handleSoftDeleteSession');
const switchPage = bind(app, 'switchPage');
</script>

<template>
  <el-container class="app-container">
    <!-- ====== SIDEBAR ====== -->
    <el-aside width="270px" class="app-aside">
      <div class="aside-logo">
        <el-icon :size="24" style="color: #7b68ee"><Cpu /></el-icon>
        <span>LLM Gather</span>
      </div>

      <el-menu
        :default-active="pageMode"
        @select="(key: string | number) => switchPage(key as PageMode)"
        class="aside-menu"
        :background-color="menuBgColor"
        :text-color="menuTextColor"
        :active-text-color="menuActiveColor"
      >
        <el-menu-item index="chat">
          <el-icon><ChatDotRound /></el-icon>
          <span>聊天</span>
        </el-menu-item>
        <el-menu-item index="agent">
          <el-icon><Star /></el-icon>
          <span>Agent 工作台</span>
        </el-menu-item>
        <el-menu-item index="rag">
          <el-icon><Document /></el-icon>
          <span>知识库</span>
        </el-menu-item>
        <el-sub-menu index="toolbox">
          <template #title>
            <el-icon><MagicStick /></el-icon>
            <span>玩具箱</span>
          </template>
          <el-menu-item index="battle">
            <el-icon><Lightning /></el-icon>
            <span>对战</span>
          </el-menu-item>
          <el-menu-item index="group">
            <el-icon><UserFilled /></el-icon>
            <span>群组</span>
          </el-menu-item>
          <el-menu-item index="collab">
            <el-icon><TrendCharts /></el-icon>
            <span>协同推理</span>
          </el-menu-item>
          <el-menu-item index="vision">
            <el-icon><Monitor /></el-icon>
            <span>视觉理解</span>
          </el-menu-item>
          <el-menu-item index="tts">
            <el-icon><Headset /></el-icon>
            <span>语音生成</span>
          </el-menu-item>
          <el-menu-item index="multimodal">
            <el-icon><PictureFilled /></el-icon>
            <span>全模态 Beta</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="console">
          <el-icon><DataAnalysis /></el-icon>
          <span>控制台</span>
        </el-menu-item>
        <el-menu-item index="api">
          <el-icon><Document /></el-icon>
          <span>API 用法</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="admin">
          <el-icon><Setting /></el-icon>
          <span>管理后台</span>
        </el-menu-item>
      </el-menu>

      <!-- Session list (chat only) -->
      <div v-if="pageMode === 'chat'" class="aside-sessions">
        <el-button type="primary" plain :icon="Plus" @click="createNewChat" class="new-chat-btn">新建对话</el-button>
        <el-scrollbar class="session-list">
          <div
            v-for="session in sidebarSessions"
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === activeSessionId }"
            @click="activeSessionId = session.id"
          >
            <el-icon :size="14"><Document /></el-icon>
            <span class="session-title">{{ session.title }}</span>
            <el-dropdown trigger="click" class="session-menu" @command="(cmd: string | number) => { if (cmd === 'delete') handleSoftDeleteSession(session.id); }" @click.stop>
              <el-icon :size="14" class="session-menu-icon"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" style="color: #ef4444">
                    <el-icon><Delete /></el-icon> 删除会话
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-scrollbar>
      </div>
      <div v-else-if="pageMode === 'agent'" class="aside-sessions">
        <el-button type="primary" plain :icon="Plus" @click="createAgentDraft" class="new-chat-btn">新建 Agent</el-button>
        <el-scrollbar class="session-list">
          <div
            v-for="agent in agents"
            :key="agent.id"
            class="session-item"
            :class="{ active: agent.id === activeAgentId }"
            @click="selectAgent(agent)"
          >
            <el-icon :size="14"><Star /></el-icon>
            <span class="session-title">{{ agent.name }}</span>
            <el-tag v-if="agent.runCount > 0" size="small" type="info">{{ agent.runCount }}</el-tag>
            <el-dropdown trigger="click" class="session-menu" @command="(cmd: string | number) => { if (cmd === 'delete') removeAgent(agent); }" @click.stop>
              <el-icon :size="14" class="session-menu-icon"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" style="color: #ef4444">
                    <el-icon><Delete /></el-icon> 删除 Agent
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <el-empty v-if="!agentLoading && agents.length === 0" description="还没有 Agent" :image-size="64" />
        </el-scrollbar>
      </div>
      <div v-else-if="pageMode === 'rag'" class="aside-hint">
        <el-empty description="管理知识库、写入文档、测试 RAG 检索，再绑定给 Agent。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #2563eb"><Document /></el-icon>
          </template>
        </el-empty>
      </div>

      <!-- Hints -->
      <div v-else-if="pageMode === 'battle'" class="aside-hint">
        <el-empty description="指定两个模型并发回答，或留空随机选择。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #2563eb"><Lightning /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'console'" class="aside-hint">
        <el-empty description="查看账户余额、充值、计费规则和用量明细。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #6366f1"><DataAnalysis /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'api'" class="aside-hint">
        <el-empty description="创建 API Key，查看中转接口用法和示例代码。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #059669"><Document /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'admin'" class="aside-hint">
        <el-empty description="管理用户、定价映射，查看平台数据统计。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #f59e0b"><TrendCharts /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'vision'" class="aside-hint">
        <el-empty description="上传图片，使用视觉模型进行理解和问答。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #8b5cf6"><Cpu /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'tts'" class="aside-hint">
        <el-empty description="输入文本，选择音色和风格，生成语音并试听。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #ec4899"><ChatDotRound /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else-if="pageMode === 'multimodal'" class="aside-hint">
        <el-empty description="视频理解、自动驾驶仿真、图文检索与多模态对话。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #8b5cf6"><VideoCamera /></el-icon>
          </template>
        </el-empty>
      </div>
      <div v-else class="aside-hint">
        <el-empty description="所有 AI 将逐个回复，后面的 AI 可以看到前面的讨论。" :image-size="72">
          <template #image>
            <el-icon :size="36" style="color: #0ea5e9"><UserFilled /></el-icon>
          </template>
        </el-empty>
      </div>

      <div class="aside-bottom">
        <el-button text :icon="Setting" @click="isSettingsOpen = true" class="settings-btn">设置</el-button>
      </div>
    </el-aside>

    <!-- ====== MAIN CONTENT ====== -->
    <el-main class="app-main">

      <!-- ========== CHAT PAGE ========== -->
      <ChatModule v-if="pageMode === 'chat'" :app="app" />

      <!-- ========== AGENT PAGE ========== -->
      <AgentModule v-else-if="pageMode === 'agent'" :app="app" />

      <!-- ========== RAG PAGE ========== -->
      <RagModule v-else-if="pageMode === 'rag'" :app="app" />

      <!-- ========== BATTLE PAGE ========== -->
      <BattleModule v-else-if="pageMode === 'battle'" :app="app" />

      <!-- ========== GROUP PAGE ========== -->
      <GroupModule v-else-if="pageMode === 'group'" :app="app" />

      <!-- ========== VISION PAGE ========== -->
      <VisionModule v-else-if="pageMode === 'vision'" :app="app" />

      <!-- ========== TTS PAGE ========== -->
      <TtsModule v-else-if="pageMode === 'tts'" :app="app" />

      <!-- ========== MULTIMODAL BETA PAGE ========== -->
      <MultimodalModule v-else-if="pageMode === 'multimodal'" :app="app" />

      <!-- ========== COLLAB PAGE ========== -->
      <CollabModule v-else-if="pageMode === 'collab'" :app="app" />

      <!-- ========== ROUTER PAGE ========== -->
      <RouterModule v-else-if="pageMode === 'router'" :app="app" />

      <!-- ========== DOCS PAGE ========== -->
      <DocsModule v-else-if="pageMode === 'docs'" :app="app" />

      <!-- ========== CONSOLE PAGE ========== -->
      <ConsoleModule v-else-if="pageMode === 'console'" :app="app" />

      <!-- ========== API DOCS PAGE ========== -->
      <ApiModule v-else-if="pageMode === 'api'" :app="app" />

      <!-- ========== ADMIN PAGE ========== -->
      <AdminModule v-else-if="pageMode === 'admin'" :app="app" />

    </el-main>

    <!-- ====== SETTINGS DRAWER ====== -->
    <el-drawer v-model="isSettingsOpen" title="设置" direction="rtl" :size="360" @open="loadSettingsMemories()">
      <el-form class="settings-body" label-position="top">
        <el-form-item label="主题" class="settings-label-wrap">
          <el-segmented
            v-model="theme"
            :options="[
              { label: '浅色', value: 'light' },
              { label: '暗色', value: 'dark' },
              { label: '自动', value: 'auto' },
            ]"
          />
        </el-form-item>
        <el-divider />
        <div class="settings-section-head">
          <strong>记忆管理</strong>
          <div>
            <el-button size="small" :loading="settingsMemoryLoading" @click="loadSettingsMemories()">刷新</el-button>
            <el-button size="small" type="danger" plain :disabled="!settingsMemories.length" @click="forgetAllSettingsMemories()">忘记所有</el-button>
          </div>
        </div>
        <el-empty v-if="!isAuthenticated" description="登录后管理记忆" :image-size="48" />
        <template v-else>
          <el-form-item label="新增记忆">
            <el-input v-model="settingsMemoryForm.content" type="textarea" :rows="3" placeholder="写入一条长期记忆" />
          </el-form-item>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
            <el-select v-model="settingsMemoryForm.memoryType" size="small" style="width:110px">
              <el-option label="事实" value="fact" />
              <el-option label="偏好" value="preference" />
              <el-option label="流程" value="procedure" />
              <el-option label="片段" value="episode" />
            </el-select>
            <el-input-number v-model="settingsMemoryForm.importance" size="small" :min="1" :max="5" />
            <el-button size="small" type="primary" :loading="settingsMemorySaving" :disabled="!settingsMemoryForm.content.trim()" @click="createSettingsMemory()">新增</el-button>
          </div>
          <div v-loading="settingsMemoryLoading" class="settings-memory-list">
            <el-empty v-if="!settingsMemories.length" description="暂无记忆" :image-size="48" />
            <div v-for="memory in settingsMemories" :key="memory.id" class="settings-memory-item">
              <div class="settings-memory-meta">
                <el-tag size="small" type="info">{{ memory.memoryType }}</el-tag>
                <el-tag v-if="memory.agentId" size="small" type="success">Agent</el-tag>
                <span>重要性 {{ memory.importance }}</span>
              </div>
              <div class="settings-memory-content">{{ memory.content }}</div>
              <el-button size="small" type="danger" text :icon="Delete" @click="deleteSettingsMemory(memory)">删除</el-button>
            </div>
          </div>
        </template>
      </el-form>
    </el-drawer>

    <el-dialog v-model="isAuthDialogOpen" :close-on-click-modal="false" title="登录 / 注册" width="420px" @closed="onAuthDialogClosed">
      <el-form label-position="top" class="settings-body">
        <el-segmented
          v-model="authMode"
          :options="[
            { label: '登录', value: 'login' },
            { label: '注册', value: 'register' },
          ]"
        />
        <el-form-item label="用户名">
          <el-input v-model="authUsername" placeholder="输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="authPassword" type="password" show-password placeholder="输入密码" @keyup.enter="submitAuth()" />
        </el-form-item>
        <el-form-item v-if="authMode === 'register'" label="邮箱">
          <el-input v-model="authEmail" placeholder="输入邮箱地址" />
        </el-form-item>
        <el-form-item v-if="authMode === 'register'" label="验证码">
          <div style="display:flex;gap:8px;width:100%;">
            <el-input v-model="authVerificationCode" placeholder="输入6位验证码" maxlength="6" style="flex:1;" />
            <el-button
              :disabled="codeCountdown > 0 || !authEmail.trim()"
              @click="handleSendCode"
              style="white-space:nowrap;"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item v-if="authMode === 'register'" label="邀请码（选填）">
          <el-input v-model="authInvitationCode" placeholder="填写邀请码，双方都可获得额度" maxlength="6" />
        </el-form-item>

        <el-alert v-if="authError" type="error" show-icon :closable="false" :title="authError" />
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="authLoading" @click="submitAuth()">{{ authMode === 'register' ? '注册并登录' : '登录' }}</el-button>
      </template>
    </el-dialog>

    <!-- Alipay Recharge Dialog -->
    <el-dialog v-model="rechargeDialogVisible" title="支付宝当面付充值" width="420px" @closed="closeRechargeDialog()">
      <div v-if="!rechargeQrCode">
        <el-form label-position="top">
          <el-form-item label="充值金额（元）">
            <el-input-number v-model="rechargeAmount" :min="1" :max="5000" :step="10" style="width:100%" />
          </el-form-item>
        </el-form>
        <el-alert v-if="rechargeError" type="error" show-icon :closable="false" :title="rechargeError" style="margin-bottom:16px" />
        <el-button type="primary" :loading="rechargeLoading" @click="submitRecharge()" style="width:100%">
          生成支付二维码
        </el-button>
        <p style="color:#999;font-size:12px;margin-top:12px;text-align:center">使用支付宝扫描二维码支付，金额 1-5000 元</p>
      </div>
      <div v-else>
        <p style="margin-bottom:12px;font-size:15px;text-align:center">请使用支付宝扫码支付 <strong>￥{{ rechargeAmount }}</strong></p>
        <div style="text-align:center">
          <div style="background:#fff;padding:16px;display:inline-block;border:1px solid #eee;border-radius:8px">
            <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(rechargeQrCode)" alt="支付二维码" style="width:200px;height:200px;display:block" />
          </div>
        </div>
        <el-alert v-if="rechargeError" type="error" show-icon :closable="false" :title="rechargeError" style="margin-top:12px" />
        <p style="color:#999;font-size:12px;margin-top:12px;text-align:center">支付完成后点击下方按钮查询支付状态</p>
        <div style="margin-top:12px">
          <el-button type="success" :loading="rechargeChecking" @click="handleCheckPayment()" style="width:100%">
            查询支付状态
          </el-button>
        </div>
        <div style="margin-top:4px">
          <el-button @click="stopRechargePolling(); rechargeQrCode = ''; rechargeOrderId = ''; rechargeError = ''" style="width:100%">
            重新选择金额
          </el-button>
        </div>
      </div>
    </el-dialog>
  </el-container>
</template>

<style scoped>
.settings-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.settings-memory-list {
  display: grid;
  gap: 8px;
}

.settings-memory-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-fill-color-blank);
}

.settings-memory-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}

.settings-memory-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.5;
}
</style>
