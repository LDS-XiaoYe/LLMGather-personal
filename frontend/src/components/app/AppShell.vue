<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref, ref, watch } from 'vue';
import WorkspaceNavigation from '../ui/WorkspaceNavigation.vue';
import WorkspaceSessions from '../ui/WorkspaceSessions.vue';
import WorkspaceAccount from '../ui/WorkspaceAccount.vue';
import { Menu, QuestionFilled } from '@element-plus/icons-vue';
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
const mobileNavigationOpen = ref(false);
watch(() => unref(app.pageMode), () => { mobileNavigationOpen.value = false; });
function openPreferences() { mobileNavigationOpen.value = false; if (isRef(app.isSettingsOpen)) app.isSettingsOpen.value = true; else app.isSettingsOpen = true; }
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
const menuBgColor = bind(app, 'menuBgColor');
const menuTextColor = bind(app, 'menuTextColor');
const menuActiveColor = bind(app, 'menuActiveColor');
const isSettingsOpen = bind(app, 'isSettingsOpen');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const isAuthenticated = bind(app, 'isAuthenticated');
const authMode = bind(app, 'authMode');
const authUsername = bind(app, 'authUsername');
const authPassword = bind(app, 'authPassword');
const authRememberMe = bind(app, 'authRememberMe');
const authEmail = bind(app, 'authEmail');
const authVerificationCode = bind(app, 'authVerificationCode');
const authInvitationCode = bind(app, 'authInvitationCode');
const authTosAccepted = bind(app, 'authTosAccepted');
const authTosDialogOpen = bind(app, 'authTosDialogOpen');
const authLoading = bind(app, 'authLoading');
const authError = bind(app, 'authError');
const authCaptchaRequired = bind(app, 'authCaptchaRequired');
const authCaptchaImage = bind(app, 'authCaptchaImage');
const authCaptchaCode = bind(app, 'authCaptchaCode');
const authCaptchaLoading = bind(app, 'authCaptchaLoading');
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
const memoryTypeOptions = bind(app, 'memoryTypeOptions');
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
const refreshAuthCaptcha = bind(app, 'refreshAuthCaptcha');
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
  <el-container class="app-container" :class="{'knowledge-shell': pageMode === 'rag'}">
    <!-- ====== SIDEBAR ====== -->
    <el-aside width="270px" class="app-aside">
      <div class="aside-logo">
        <el-icon :size="24" style="color: #7b68ee"><Cpu /></el-icon>
        <span>LLM Gather</span>
      </div>

      <WorkspaceNavigation :app="app" />
      <WorkspaceSessions :app="app" />
      <div class="ui-sidebar-footer">
        <div class="aside-bottom">
          <el-button text :icon="QuestionFilled" :class="{ 'is-current': pageMode === 'docs' }" :aria-current="pageMode === 'docs' ? 'page' : undefined" @click="switchPage('docs')" class="settings-btn">功能说明</el-button>
          <el-button text :icon="Setting" @click="isSettingsOpen = true" class="settings-btn">设置</el-button>
        </div>
        <WorkspaceAccount :app="app" />
      </div>
    </el-aside>

    <el-button class="ui-mobile-menu" :icon="Menu" aria-label="打开导航" aria-controls="mobile-workspace-nav" :aria-expanded="mobileNavigationOpen" @click="mobileNavigationOpen = true" />
    <el-drawer id="mobile-workspace-nav" v-model="mobileNavigationOpen" direction="ltr" size="min(320px, 90vw)" title="导航" class="ui-navigation-drawer">
      <WorkspaceNavigation :app="app" @navigate="mobileNavigationOpen = false" />
      <WorkspaceSessions :app="app" @navigate="mobileNavigationOpen = false" />
      <div class="ui-sidebar-footer">
        <div class="aside-bottom"><el-button text :icon="QuestionFilled" :class="{ 'is-current': pageMode === 'docs' }" :aria-current="pageMode === 'docs' ? 'page' : undefined" @click="switchPage('docs'); mobileNavigationOpen = false">功能说明</el-button><el-button text :icon="Setting" @click="openPreferences">设置</el-button></div>
        <WorkspaceAccount :app="app" @navigate="mobileNavigationOpen = false" />
      </div>
    </el-drawer>
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
          <p class="ui-muted">聊天会按相关性和重要程度引用用户级记忆；Agent 专属记忆仅供对应 Agent 使用。</p>
          <el-form-item label="新增用户级记忆">
            <el-input v-model="settingsMemoryForm.content" type="textarea" :rows="3" placeholder="写入一条长期记忆" />
          </el-form-item>
          <div class="settings-memory-options">
            <el-form-item label="记忆类型">
              <el-select v-model="settingsMemoryForm.memoryType" size="small" aria-label="记忆类型">
                <el-option v-for="item in memoryTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="重要程度">
              <el-input-number v-model="settingsMemoryForm.importance" size="small" :min="1" :max="5" :step="1" step-strictly :precision="0" controls-position="right" aria-label="记忆重要程度" aria-describedby="settings-memory-importance-help" />
            </el-form-item>
            <el-button size="small" type="primary" :loading="settingsMemorySaving" :disabled="!settingsMemoryForm.content.trim()" @click="createSettingsMemory()">新增</el-button>
          </div>
          <p id="settings-memory-importance-help" class="ui-muted settings-memory-help">重要程度 1–5，默认 3；数值越大，引用优先级越高。</p>
          <div v-loading="settingsMemoryLoading" class="settings-memory-list">
            <el-empty v-if="!settingsMemories.length" description="暂无记忆" :image-size="48" />
            <div v-for="memory in settingsMemories" :key="memory.id" class="settings-memory-item">
              <div class="settings-memory-meta">
                <el-tag size="small" type="info">{{ memory.memoryType }}</el-tag>
                <el-tag v-if="memory.agentId" size="small" type="success">Agent 专属</el-tag>
                <el-tag v-else size="small" type="info">用户级 · 聊天可用</el-tag>
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
        <el-form-item v-if="authMode === 'login'">
          <div>
            <el-checkbox v-model="authRememberMe" :disabled="authLoading">30 天内保持登录</el-checkbox>
            <div class="auth-remember-note" style="font-size:12px;line-height:1.5;color:var(--el-text-color-secondary)">仅在个人设备上勾选；公共设备请取消勾选并在使用后退出。</div>
          </div>
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
        <el-form-item v-if="authMode === 'register'">
          <el-checkbox v-model="authTosAccepted">
            我已阅读并同意
            <el-button link type="primary" @click.stop="authTosDialogOpen = true">服务条款和个人信息保护政策</el-button>
          </el-checkbox>
        </el-form-item>
        <el-form-item v-if="authCaptchaRequired" label="图形验证码">
          <div style="display:flex;gap:8px;width:100%;align-items:center;">
            <el-input v-model="authCaptchaCode" placeholder="输入图形验证码" maxlength="8" style="flex:1;" @keyup.enter="submitAuth()" />
            <button type="button" class="captcha-image-button" :disabled="authCaptchaLoading" @click="refreshAuthCaptcha()">
              <img v-if="authCaptchaImage" :src="authCaptchaImage" alt="图形验证码" />
              <span v-else>刷新</span>
            </button>
          </div>
        </el-form-item>

        <el-alert v-if="authError" type="error" show-icon :closable="false" :title="authError" />
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="authLoading" :disabled="authMode === 'register' && !authTosAccepted" @click="submitAuth()">{{ authMode === 'register' ? '注册并登录' : '登录' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="authTosDialogOpen" title="服务条款和个人信息保护政策" width="680px">
      <div class="tos-content">
        <h4>服务条款</h4>
        <p>你需要对账号下的使用行为负责，不得使用本平台生成、传播违法、侵权、欺诈、恶意攻击、绕过安全限制或明显损害他人权益的内容。</p>
        <p>平台提供模型调用、Agent、工具、知识库和工作流等能力。AI 输出可能不准确，你需要自行判断结果是否适合用于生产、医疗、法律、金融等高风险场景。</p>
        <p>平台可能根据资源消耗、模型价格和滥用风险调整额度、限流、功能可用性或服务策略。</p>
        <h4>个人信息保护政策</h4>
        <p>注册和登录会处理用户名、邮箱、验证码、安全挑战、基础行为数据、IP 和 User-Agent，用于身份认证、风控、防刷和安全审计。</p>
        <p>你在聊天、Agent、知识库、文件库和工具调用中提交的内容会用于提供对应功能，并可能产生运行记录、追踪日志、计费明细和必要的错误日志。</p>
        <p>为实现模型调用、计费、风控、故障排查、额度管理和功能优化，平台会在必要范围内保存和使用上述信息，不会将你的个人信息用于与平台服务无关的目的。</p>
        <p>你可以在平台内访问、更正、删除可管理的数据；因安全审计、交易记录、计费结算、合规要求或争议处理需要保留的记录，会按系统策略和适用规则保存。</p>
        <p>请不要上传无权处理的敏感个人信息、密钥、商业机密或违法内容。涉及他人个人信息时，你应确保已获得合法授权。</p>
      </div>
      <template #footer>
        <el-button @click="authTosDialogOpen = false">关闭</el-button>
        <el-button type="primary" @click="authTosAccepted = true; authTosDialogOpen = false">同意并继续</el-button>
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
