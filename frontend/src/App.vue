<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Cpu, ChatDotRound, DataAnalysis, Delete, Document, EditPen, Headset, InfoFilled, Lightning, MoreFilled, Monitor, Picture, PictureFilled, Plus, Promotion, Refresh, Search, Setting, Star, Sunny, SwitchButton, TrendCharts, User, UserFilled, VideoCamera, Coin } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import {
  clearStoredToken,
  addKnowledgeDocument as apiAddKnowledgeDocument,
  createAgent as apiCreateAgent,
  createApiKey as apiCreateApiKey,
  createKnowledgeBase as apiCreateKnowledgeBase,
  createMemory as apiCreateMemory,
  createSkill as apiCreateSkill,
  createAgentTeam as apiCreateAgentTeam,
  createAgentTestCase as apiCreateAgentTestCase,
  createAgentTestSuite as apiCreateAgentTestSuite,
  createAgentVersion as apiCreateAgentVersion,
  createMcpServer as apiCreateMcpServer,
  createWorkflow as apiCreateWorkflow,
  deleteAdminUser,
  deleteAgent as apiDeleteAgent,
  deleteConversation,
  evaluateAgentRun as apiEvaluateAgentRun,
  exportAdminBillingCsv,
  fetchAdminBilling,
  fetchAdminCheck,
  fetchAdminDailyUsage,
  fetchAdminModelUsage,
  fetchAdminStats,
  fetchAdminTodayStats,
  fetchAdminUsers,
  fetchAgents,
  fetchAgentRuns,
  fetchAgentEvaluations,
  fetchAgentStats,
  fetchBillingLedger,
  fetchBillingRules,
  fetchConversations,
  fetchDailyUsage,
  fetchKnowledgeBases,
  fetchMe,
  fetchMemories,
  fetchModels,
  fetchSkills,
  fetchAgentTeams,
  fetchAgentTestCases,
  fetchAgentTestSuites,
  fetchAgentVersions,
  fetchMcpServers,
  generateAgent as apiGenerateAgent,
  getStoredToken,
  fetchTools,
  fetchWorkflows,
  listApiKeys,
  login,
  logout as apiLogout,
  register,
  resetAdminUserPassword,
  revokeApiKey as apiRevokeApiKey,
  runAgent as apiRunAgent,
  runAgentTeam as apiRunAgentTeam,
  runAgentTestSuite as apiRunAgentTestSuite,
  runWorkflow as apiRunWorkflow,
  sendVerificationCode,
  createRechargeOrder,
  fetchRechargeOrders,
  checkRechargeOrder,
  type RechargeOrder,
  setStoredToken,
  syncConversations,
  streamCompletion,
  topUp,
  updateAgent as apiUpdateAgent,
  updateAgentPublication as apiUpdateAgentPublication,
  restoreAgentVersion as apiRestoreAgentVersion,
  testMcpServer as apiTestMcpServer,
  updateAdminBillingRule,
  updateAdminUser,
  fetchAdminProviderKeys,
  createAdminProviderKey,
  deleteAdminProviderKey,
  fetchAdminProviderConfigs,
  createAdminProviderConfig,
  updateAdminProviderConfig,
  deleteAdminProviderConfig,
  fetchAdminSettings,
  fetchPageModels,
  fetchInvitationCode,
  updateAdminSetting,
  fetchAdminModelTiers,
  updateAdminModelTiers,
  addModelsToTier,
  removeModelFromTier,
  type AdminBillingRow,
  type AdminStats,
  type AdminUser,
  type AgentDefinition,
  type AgentEvaluation,
  type AgentRun,
  type AgentRunStats,
  type AgentTeam,
  type AgentTeamRun,
  type AgentTestCase,
  type AgentTestSuite,
  type AgentVersion,
  type ApiKeyItem,
  type AuthUser,
  type BillingLedgerItem,
  type BillingRule,
  type ConversationSession,
  type DailyUsage,
  type ModelDescriptor,
  type ModelUsageStat,
  type ProviderApiKeyRow,
  type ProviderConfigRow,
  type ProviderConfigInput,
  type SystemSetting,
  type TodayStats,
  type TierPriceInfo,
  type ModelTiersData,
  type KnowledgeBase,
  type MemoryItem,
  type McpServer,
  type SkillDefinition,
  type ToolDefinition,
  type Workflow,
  type WorkflowRun,
  type WorkflowNode,
} from './api';
import type { PageMode, ChatMessage, ChatSession, BattlePanelState, GroupChatMessage } from './types';
import { getModelLogo } from './constants';
import {
  createId, buildSessionTitle, pickTwoRandomModels, shuffleArray,
  formatTime, getStoredValue, setStoredValue, renderMarkdown,
} from './utils';
import { MagicStick } from '@element-plus/icons-vue';

const BASE_URL_KEY = 'llm_gather_base_url';
const THEME_KEY = 'llm_gather_theme';

type ThemeMode = 'light' | 'dark' | 'auto';

function getPreferredTheme(): ThemeMode {
  return (getStoredValue(THEME_KEY) as ThemeMode) || 'auto';
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('dark');
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'auto') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (theme.value === 'auto') root.classList.toggle('dark', e.matches);
    });
  }
  setStoredValue(THEME_KEY, mode);
}

const theme = ref<ThemeMode>(getPreferredTheme());
applyTheme(theme.value);

watch(theme, (mode) => { applyTheme(mode); });

const isDark = computed(() => document.documentElement.classList.contains('dark'));

// Track dark changes from auto mode (media query)
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
darkMediaQuery.addEventListener('change', () => {
  if (theme.value === 'auto') {
    document.documentElement.classList.toggle('dark', darkMediaQuery.matches);
  }
});

const menuBgColor = computed(() => isDark.value ? '#0f172a' : '#f8f9fc');
const menuTextColor = computed(() => isDark.value ? '#94a3b8' : '#4b5563');
const menuActiveColor = computed(() => isDark.value ? '#60a5fa' : '#2563eb');

/* ---------- State ---------- */
const backendBaseUrl = ref(getStoredValue(BASE_URL_KEY) || '/v1');
const isSettingsOpen = ref(false);
const isAuthDialogOpen = ref(false);
const authUser = ref<AuthUser | null>(null);
const authMode = ref<'login' | 'register'>('login');
const authUsername = ref('');
const authPassword = ref('');
const authEmail = ref('');
const authVerificationCode = ref('');
const authInvitationCode = ref('');
const authLoading = ref(false);
const authError = ref('');
const codeCountdown = ref(0);
let codeTimer: ReturnType<typeof setInterval> | null = null;
const userInvitationCode = ref<string | null>(null);
const topUpAmount = ref(10);
const topUpLoading = ref(false);
const rechargeDialogVisible = ref(false);
const rechargeAmount = ref(10);
const rechargeLoading = ref(false);
const rechargeQrCode = ref('');
const rechargeOrderId = ref('');
const rechargeError = ref('');
const rechargeChecking = ref(false);
let rechargePollTimer: ReturnType<typeof setInterval> | null = null;
const rechargeOrders = ref<RechargeOrder[]>([]);
const rechargeOrdersLoading = ref(false);
const billingRules = ref<BillingRule[]>([]);
const billingLedger = ref<BillingLedgerItem[]>([]);

// Agent Studio
const agents = ref<AgentDefinition[]>([]);
const activeAgentId = ref('');
const agentLoading = ref(false);
const agentSaving = ref(false);
const agentPublishing = ref(false);
const agentRunning = ref(false);
const agentGenerating = ref(false);
const agentPrompt = ref('');
const agentImageUrlInput = ref('');
const agentRuns = ref<AgentRun[]>([]);
const activeAgentRun = ref<AgentRun | null>(null);
const agentSideTab = ref<'history' | 'knowledge' | 'memory' | 'skills' | 'team' | 'workflow' | 'eval' | 'versions' | 'tests' | 'mcp'>('history');
const availableTools = ref<ToolDefinition[]>([]);
const knowledgeBases = ref<KnowledgeBase[]>([]);
const agentMemories = ref<MemoryItem[]>([]);
const availableSkills = ref<SkillDefinition[]>([]);
const workflows = ref<Workflow[]>([]);
const agentTeams = ref<AgentTeam[]>([]);
const mcpServers = ref<McpServer[]>([]);
const agentVersions = ref<AgentVersion[]>([]);
const agentTestSuites = ref<AgentTestSuite[]>([]);
const agentTestCases = ref<AgentTestCase[]>([]);
const agentResourceLoading = ref(false);
const knowledgeCreating = ref(false);
const knowledgeDocSaving = ref(false);
const memorySaving = ref(false);
const skillCreating = ref(false);
const workflowCreating = ref(false);
const workflowRunning = ref(false);
const teamCreating = ref(false);
const teamRunning = ref(false);
const mcpSaving = ref(false);
const mcpTesting = ref(false);
const versionSaving = ref(false);
const testSaving = ref(false);
const testRunning = ref(false);
const activeWorkflowId = ref('');
const workflowInput = ref('');
const activeWorkflowRun = ref<WorkflowRun | null>(null);
const activeTeamId = ref('');
const teamInput = ref('');
const activeTeamRun = ref<AgentTeamRun | null>(null);
const activeTestSuiteId = ref('');
const activeTestRun = ref<Record<string, unknown> | null>(null);
const agentEvaluations = ref<AgentEvaluation[]>([]);
const agentStats = ref<AgentRunStats | null>(null);
const agentEvaluationLoading = ref(false);
const agentEvaluationSaving = ref(false);
const evaluationForm = ref({
  expectedOutput: '',
  rubric: '',
});
const generatorForm = ref({
  requirement: '',
});
const agentForm = ref({
  id: '',
  name: '',
  description: '',
  model: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024,
  memoryEnabled: true,
  toolIds: [] as string[],
  knowledgeBaseIds: [] as string[],
  skillIds: [] as string[],
  published: false,
  apiEnabled: false,
  publicSlug: '',
  status: 'active' as 'active' | 'archived',
});
const knowledgeForm = ref({
  name: '',
  description: '',
});
const knowledgeDocForm = ref({
  kbId: '',
  title: '',
  content: '',
});
const memoryForm = ref({
  content: '',
  importance: 3,
});
const skillForm = ref({
  name: '',
  description: '',
  category: 'custom',
  content: '',
});
const teamForm = ref({
  name: '',
  description: '',
  strategy: 'sequential' as AgentTeam['strategy'],
  memberIds: [] as string[],
});
const mcpForm = ref({
  name: 'Notion',
  token: '',
  query: '',
});
const versionForm = ref({
  label: '',
});
const testSuiteForm = ref({
  name: '',
  description: '',
});
const testCaseForm = ref({
  name: '',
  input: '',
  expectedOutput: '',
  rubric: '',
});
type AgentBuilderBlockType = 'identity' | 'model' | 'tools' | 'skills' | 'knowledge' | 'memory' | 'run';
interface AgentBuilderBlock {
  type: AgentBuilderBlockType;
  title: string;
  detail: string;
}
const agentBuilderBlocks: AgentBuilderBlock[] = [
  { type: 'identity', title: '角色', detail: '生成名称、描述和系统提示词' },
  { type: 'model', title: '模型', detail: '绑定当前默认语言模型' },
  { type: 'tools', title: '工具', detail: '挂载时间、计算、文本统计和代码执行工具' },
  { type: 'skills', title: 'Skills', detail: '挂载研究、代码、数据分析能力包' },
  { type: 'knowledge', title: '知识库', detail: '挂载第一个可用知识库' },
  { type: 'memory', title: '记忆', detail: '开启长期记忆' },
  { type: 'run', title: '运行', detail: '生成一条试运行任务' },
];
const agentBuilderCanvas = ref<AgentBuilderBlock[]>([]);
const agentBuilderDragging = ref<AgentBuilderBlockType | ''>('');

const agentPublicEndpoint = computed(() => {
  if (!agentForm.value.publicSlug) return '';
  return `${backendBaseUrl.value}/public/agents/${encodeURIComponent(agentForm.value.publicSlug)}/runs`;
});

const agentApiEndpoint = computed(() => {
  if (!agentForm.value.id) return '';
  return `${backendBaseUrl.value}/agents/${encodeURIComponent(agentForm.value.id)}/invoke`;
});

watch(activeTestSuiteId, () => {
  void loadSelectedTestCases();
});

// API Docs
const apiKeys = ref<Array<{ id: string; name: string; maskedKey: string; fullKey?: string; createdAt: string }>>([]);
const apiKeyLoading = ref(false);
const apiKeyCreateDialog = ref(false);
const apiKeyNewName = ref('');
const errorCodes = [
  { status: 400, code: 'Bad Request', desc: '请求参数错误（如缺少必填字段）' },
  { status: 401, code: 'Unauthorized', desc: '未登录或 Token 已过期，请重新登录获取 Token' },
  { status: 403, code: 'Forbidden', desc: '余额不足或无权访问该资源' },
  { status: 404, code: 'Not Found', desc: '请求的资源不存在（如用户/模型不存在）' },
  { status: 409, code: 'Conflict', desc: '资源冲突（如用户名已存在）' },
  { status: 500, code: 'Internal Error', desc: '服务器内部错误，请查看后端日志' },
  { status: 502, code: 'Bad Gateway', desc: '上游模型服务不可用或超时' },
];

// Models
const models = ref<ModelDescriptor[]>([]);
const selectedModel = ref('');
const pageModelsConfig = ref<Record<string, string>>({});

function getModelStorageKey(): string {
  return authUser.value ? `llmgather_model_${authUser.value.id}` : '';
}
function restoreSelectedModel(): void {
  const key = getModelStorageKey();
  if (key) {
    const saved = getStoredValue(key);
    if (saved) selectedModel.value = saved;
  }
}
function persistSelectedModel(): void {
  const key = getModelStorageKey();
  if (key) setStoredValue(key, selectedModel.value);
}

// Multimodal model persistence
function getMmModelKey(): string {
  return authUser.value ? `llmgather_mm_model_${authUser.value.id}` : '';
}
function restoreMmModel(_models: ModelDescriptor[]): void {
  const key = getMmModelKey();
  if (!key) return;
  const saved = getStoredValue(key);
  const visions = visionModels.value;
  if (saved && visions.some((m) => m.id === saved)) {
    multimodalModel.value = saved;
  } else if (visions.length > 0) {
    multimodalModel.value = visions[0].id;
  }
}
function persistMmModel(): void {
  const key = getMmModelKey();
  if (key && multimodalModel.value) setStoredValue(key, multimodalModel.value);
}

// TTS model persistence
function getTtsModelKey(): string {
  return authUser.value ? `llmgather_tts_model_${authUser.value.id}` : '';
}
function restoreTtsModel(_models: ModelDescriptor[]): void {
  const key = getTtsModelKey();
  if (!key) return;
  const saved = getStoredValue(key);
  const audios = ttsModels.value;
  if (saved && audios.some((m) => m.id === saved)) {
    ttsModel.value = saved;
  } else if (audios.length > 0) {
    ttsModel.value = audios[0].id;
  }
}
function persistTtsModel(): void {
  const key = getTtsModelKey();
  if (key && ttsModel.value) setStoredValue(key, ttsModel.value);
}

// Vision model persistence
function getVisionModelKey(): string {
  return authUser.value ? `llmgather_vision_model_${authUser.value.id}` : '';
}
function restoreVisionModel(_models: ModelDescriptor[]): void {
  const key = getVisionModelKey();
  if (!key) return;
  const saved = getStoredValue(key);
  const visions = visionModels.value;
  if (saved && visions.some((m) => m.id === saved)) {
    visionModel.value = saved;
  } else if (visions.length > 0) {
    visionModel.value = visions[0].id;
  }
}
function persistVisionModel(): void {
  const key = getVisionModelKey();
  if (key && visionModel.value) setStoredValue(key, visionModel.value);
}
const isLoadingModels = ref(false);
const status = ref('等待连接');
const isAuthLoaded = ref(false);

// Chat page
const sessions = ref<ChatSession[]>([{
  id: createId('session'),
  title: '新对话',
  chatType: 'direct',
  messages: [],
  updatedAt: Date.now(),
  isDraft: true,
}]);
const activeSessionId = ref(sessions.value[0].id);
const draft = ref('');
const isComposing = ref(false);
const isSubmitting = ref(false);
const requestId = ref('');
const isSessionLoaded = ref(false);

// Navigation
const pageMode = ref<PageMode>(
  window.location.hash === '#/agent' ? 'agent'
  : window.location.hash === '#/battle' ? 'battle'
  : window.location.hash === '#/group' ? 'group'
  : window.location.hash === '#/console' ? 'console'
  : window.location.hash === '#/api' ? 'api'
  : window.location.hash === '#/vision' ? 'vision'
  : window.location.hash === '#/tts' ? 'tts'
  : window.location.hash === '#/multimodal' ? 'multimodal'
  : window.location.hash === '#/router' ? 'router'
  : window.location.hash === '#/collab' ? 'collab'
  : window.location.hash === '#/docs' ? 'docs'
  : 'chat',
);

// Battle page
const battlePrompt = ref('');
const isBattling = ref(false);
const battleStatus = ref('等待开始');
const battleLeftModel = ref('');
const battleRightModel = ref('');
const battlePanels = ref<[BattlePanelState, BattlePanelState]>([
  { model: '-', content: '', reasoning: '', requestId: '', status: '待机' },
  { model: '-', content: '', reasoning: '', requestId: '', status: '待机' },
]);

// Group page
const groupPrompt = ref('');
const isGrouping = ref(false);
const groupMessages = ref<GroupChatMessage[]>([]);

// Router page
const routerEnabled = ref(true);
const routerIntent = ref('');
const routerConfidence = ref(0);
const routerSelectedModel = ref('');
const routerReason = ref('');
const routerFallbacks = ref<string[]>([]);
const routerDebug = ref<{ classifierModel?: string; rawOutput?: string; matchedBy?: string; prompt?: string } | null>(null);
const routerRules = ref<Record<string, string[]>>({});
const routerLoading = ref(false);

// Collab page
const collabMode = ref<'debate' | 'review' | 'divide'>('debate');
const collabPrompt = ref('');
const collabRunning = ref(false);
const collabModels = ref<string[]>([]);
const collabSelectedModels = ref<string[]>([]);
const collabModelPickerOpen = ref(false);
interface CollabPanel { modelId: string; modelName: string; content: string; status: 'waiting' | 'streaming' | 'done' }
const collabPanels = ref<CollabPanel[]>([]);
const collabSummary = ref('');
const collabSummaryStatus = ref<'idle' | 'streaming' | 'done'>('idle');
let collabAbortController: AbortController | null = null;
let collabLastQuery = '';
let collabLastMode = '';

function getCollabModelLogo(modelId: string): { color: string; initial: string } {
  const lower = modelId.toLowerCase();
  if (lower.includes('deepseek')) return { color: '#4a90d9', initial: 'D' };
  if (lower.includes('qwen')) return { color: '#6236ff', initial: 'Q' };
  if (lower.includes('glm')) return { color: '#7b68ee', initial: 'G' };
  if (lower.includes('minimax') || lower.includes('mimo')) return { color: '#f59e0b', initial: 'M' };
  if (lower.includes('kimi')) return { color: '#22c55e', initial: 'K' };
  if (lower.includes('gui')) return { color: '#8b5cf6', initial: 'G' };
  return { color: '#6b7280', initial: modelId.charAt(0).toUpperCase() };
}

// Admin page
const adminStats = ref<AdminStats | null>(null);
const adminUsers = ref<AdminUser[]>([]);
const adminUsersTotal = ref(0);
const adminUsersPage = ref(1);
const adminUsersSearch = ref('');
const adminBilling = ref<AdminBillingRow[]>([]);
const adminBillingTotal = ref(0);
const adminBillingPage = ref(1);
const adminBillingFilterUserId = ref('');
const adminBillingFilterModel = ref('');
const adminEditUserDialog = ref(false);
const adminEditUserId = ref('');
const adminEditUserCredits = ref(0);
const adminEditUserRole = ref('user');
const adminEditUserUsername = ref('');
const adminTab = ref<'dashboard' | 'users' | 'billing' | 'modelstats' | 'modeltiers' | 'providers' | 'apikeys' | 'settings' | 'router'>('dashboard');
const adminDailyUsage = ref<DailyUsage[]>([]);
const adminChartDays = ref(30);
const adminTodayStats = ref<TodayStats | null>(null);
const adminModelUsage = ref<ModelUsageStat[]>([]);

// User management state
const adminResetPwdDialog = ref(false);
const adminResetPwdUserId = ref('');
const adminResetPwdUsername = ref('');
const adminResetPwdValue = ref('');

// Billing date range state
const adminBillingFromDate = ref('');
const adminBillingToDate = ref('');

// Provider key counts
const adminProviderKeyCounts = ref<Record<string, number>>({});

// API Key provider filter
const adminApiKeyProviderFilter = ref('');

// System settings state
const adminSettings = ref<SystemSetting[]>([]);
const adminEditSettingDialog = ref(false);
const adminEditSettingKey = ref('');
const adminEditSettingValue = ref('');
const adminEditSettingDesc = ref('');
const adminEditSettingModels = ref<string[]>([]);
const adminEditModelTags = ref<Record<string, string[]>>({});

// Model tier management state
const adminModelTiers = ref<ModelTiersData>({ tiers: {}, prices: {}, labels: {} });
const adminTierEditDialog = ref(false);
const adminTierEditKey = ref('');
const adminTierEditLabel = ref('');
const adminTierEditPromptPrice = ref(0);
const adminTierEditCompletionPrice = ref(0);
const adminTierEditDesc = ref('');
const adminTierEditIsNew = ref(false);
const adminEditSettingTagFilter = ref('');
const adminEditSettingTextMode = ref(false);

const filteredModelsForSetting = computed(() => {
  if (!adminEditSettingTagFilter.value) return models.value;
  const filtered = models.value.filter((m) => getModelTags(m.id).includes(adminEditSettingTagFilter.value));
  return filtered;
});
const consoleDailyUsage = ref<DailyUsage[]>([]);
const consoleChartDays = ref(30);

// Provider API key admin state
const adminProviderKeys = ref<ProviderApiKeyRow[]>([]);
const adminAddKeyDialog = ref(false);
const adminNewKeyProvider = ref('qwen');
const adminNewKeyName = ref('');
const adminNewKeyValue = ref('');

// Provider config admin state
const adminProviderConfigs = ref<ProviderConfigRow[]>([]);
const adminEditConfigDialog = ref(false);
const adminEditConfigId = ref('');
const adminEditConfigForm = ref<ProviderConfigInput>({
  providerName: '',
  displayName: '',
  baseUrl: '',
  models: '',
  modelPrefix: '',
  authHeader: 'Authorization',
  authPrefix: 'Bearer',
  timeoutMs: 25000,
  retryCount: 2,
});
const adminIsNewConfig = ref(true);

// Chart instances
let adminChartInstance: echarts.ECharts | null = null;
let consoleChartInstance: echarts.ECharts | null = null;

// Refs
const threadRef = ref<HTMLElement>();
const groupThreadRef = ref<HTMLElement>();

// Abort refs
let chatAbortController: AbortController | null = null;
let battleAbortController: AbortController | null = null;
let groupAbortController: AbortController | null = null;
let sessionsSyncTimer: number | null = null;

/* ---------- Computed ---------- */
const activeSession = computed(
  () => sessions.value.find((s) => s.id === activeSessionId.value) ?? sessions.value[0],
);
const activeMessages = computed(() => activeSession.value?.messages ?? []);
const sidebarSessions = computed(() => sessions.value.filter((s) => !s.isDraft));
const isAuthenticated = computed(() => Boolean(authUser.value));
const isAdmin = computed(() => authUser.value?.role === 'admin');
const activeAgent = computed(() => agents.value.find((agent) => agent.id === activeAgentId.value) ?? null);
const authCreditsText = computed(() => (authUser.value ? Number(authUser.value.credits).toFixed(4) : '0.0000'));
const authSpentText = computed(() => (authUser.value ? Number(authUser.value.totalSpent).toFixed(4) : '0.0000'));
const apiBaseUrl = computed(() => {
  try { return new URL(backendBaseUrl.value || '/v1', window.location.origin).origin + '/v1'; }
  catch { return window.location.origin + '/v1'; }
});

const battleStatusTagType = () => {
  const s = battleStatus.value;
  if (s === '完成') return 'success';
  if (s === '生成中' || s === '对战进行中') return undefined;
  if (s === '已停止' || s === '失败') return 'danger';
  return 'info';
};

const panelStatusTagType = (s: string) => {
  if (s === '完成') return 'success';
  if (s === '生成中') return undefined;
  if (s === '已停止' || s === '失败') return 'danger';
  return 'info';
};

/* ---------- Watchers ---------- */
watch(selectedModel, () => { persistSelectedModel(); });

watch(activeSessionId, (val) => {
  if (!val && sessions.value.length > 0) activeSessionId.value = sessions.value[0].id;
  requestId.value = '';
}, { immediate: true });

watch([activeMessages, isSubmitting], () => {
  void nextTick(() => {
    if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight;
  });
});

watch([groupMessages], () => {
  void nextTick(() => {
    if (groupThreadRef.value) groupThreadRef.value.scrollTop = groupThreadRef.value.scrollHeight;
  });
});

watch(backendBaseUrl, (val) => setStoredValue(BASE_URL_KEY, val));

window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash === '#/agent') pageMode.value = 'agent';
    else if (hash === '#/battle') pageMode.value = 'battle';
    else if (hash === '#/group') pageMode.value = 'group';
    else if (hash === '#/console') pageMode.value = 'console';
    else if (hash === '#/api') pageMode.value = 'api';
    else if (hash === '#/admin') pageMode.value = 'admin';
    else if (hash === '#/vision') pageMode.value = 'vision';
    else if (hash === '#/tts') pageMode.value = 'tts';
    else if (hash === '#/multimodal') pageMode.value = 'multimodal';
    else if (hash === '#/router') pageMode.value = 'router';
    else if (hash === '#/collab') pageMode.value = 'collab';
    else if (hash === '#/docs') pageMode.value = 'docs';
    else pageMode.value = 'chat';
});

watch(pageMode, (mode) => {
  if (!isAuthenticated.value) return;
  if (mode === 'agent') {
    void loadAgents();
  } else if (mode === 'console') {
    onConsoleEnter();
  } else if (mode === 'api') {
    void loadApiKeys();
  } else if (mode === 'admin') {
    void loadAdminStats();
    void loadAdminTodayStats();
    void loadAdminModelUsage();
    void loadAdminDailyUsage();
  }
});

// When auth becomes ready while already on console, load data
watch(isAuthenticated, (authed) => {
  if (authed && pageMode.value === 'console') {
    onConsoleEnter();
  } else if (authed && pageMode.value === 'agent') {
    void loadAgents();
  }
});

function onConsoleEnter() {
  void refreshBillingData();
  void loadConsoleDailyUsage();
  void loadRechargeOrders();
  void fetchMe(backendBaseUrl.value).then(u => { authUser.value = u; }).catch((e) => { console.error('[console] fetchMe failed:', e); });
  // Retry chart render in case DOM wasn't ready
  setTimeout(() => {
    if (consoleDailyUsage.value.length > 0) {
      const el = document.getElementById('console-chart');
      if (el) { consoleChartInstance?.dispose(); consoleChartInstance = renderLineChart(el, consoleDailyUsage.value); }
    }
  }, 300);
}

watch(
  sessions,
  () => {
    if (!isAuthenticated.value || !isSessionLoaded.value) return;
    if (sessionsSyncTimer !== null) {
      window.clearTimeout(sessionsSyncTimer);
    }
    sessionsSyncTimer = window.setTimeout(() => {
      const nonDraftSessions = sessions.value.filter((s) => !s.isDraft);
      if (nonDraftSessions.length === 0) return;
      const sessionsToSync = nonDraftSessions.map(({ isDraft, ...rest }) => rest as ConversationSession);
      syncConversations(sessionsToSync, backendBaseUrl.value)
        .catch((err: unknown) => { console.error('[syncConversations] failed:', err); });
    }, 1000);
  },
  { deep: true },
);

function triggerSync() {
  if (!isAuthenticated.value || !isSessionLoaded.value) return;
  if (sessionsSyncTimer !== null) {
    window.clearTimeout(sessionsSyncTimer);
    sessionsSyncTimer = null;
  }
  const nonDraftSessions = sessions.value.filter((s) => !s.isDraft);
  if (nonDraftSessions.length === 0) return;
  const sessionsToSync = nonDraftSessions.map(({ isDraft, ...rest }) => rest as ConversationSession);
  syncConversations(sessionsToSync, backendBaseUrl.value)
    .catch((err: unknown) => { console.error('[triggerSync] failed:', err); });
}

/* ---------- Methods ---------- */
async function loadModels() {
  if (!isAuthenticated.value) {
    models.value = [];
    status.value = '请先登录以加载模型';
    return;
  }

  isLoadingModels.value = true;
  status.value = '正在加载模型列表';
  try {
    const data = await fetchModels(backendBaseUrl.value);
    models.value = data;
    restoreSelectedModel();
    if (data.length > 0 && !data.some((m) => m.id === selectedModel.value) && selectedModel.value !== 'auto') {
      selectedModel.value = data[0].id;
    }
    restoreMmModel(data);
    restoreTtsModel(data);
    restoreVisionModel(data);
    status.value = `已加载 ${data.length} 个模型`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '加载模型失败';
    if (msg.includes('Token') || msg.includes('API Key') || msg.includes('登录')) {
      status.value = '登录已过期，请重新登录';
      authUser.value = null;
      clearStoredToken();
    } else {
      status.value = msg;
    }
  } finally {
    isLoadingModels.value = false;
  }
}

function resetAgentForm() {
  const defaultModel = selectedModel.value && selectedModel.value !== 'auto'
    ? selectedModel.value
    : (chatModels.value[0]?.id || models.value[0]?.id || '');
  agentForm.value = {
    id: '',
    name: '新建 Agent',
    description: '',
    model: defaultModel,
    systemPrompt: '你是一个可靠的任务型 AI Agent。你会先理解用户目标，再给出清晰、可执行、可复盘的结果。',
    temperature: 0.7,
    maxTokens: 1024,
    memoryEnabled: true,
    toolIds: [],
    knowledgeBaseIds: [],
    skillIds: [],
    published: false,
    apiEnabled: false,
    publicSlug: '',
    status: 'active',
  };
  agentRuns.value = [];
  activeAgentRun.value = null;
  agentMemories.value = [];
}

function fillAgentForm(agent: AgentDefinition) {
  agentForm.value = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    temperature: Number(agent.temperature),
    maxTokens: Number(agent.maxTokens),
    memoryEnabled: agent.memoryEnabled !== false,
    toolIds: [...(agent.toolIds ?? [])],
    knowledgeBaseIds: [...(agent.knowledgeBaseIds ?? [])],
    skillIds: [...(agent.skillIds ?? [])],
    published: agent.published === true,
    apiEnabled: agent.apiEnabled === true,
    publicSlug: agent.publicSlug ?? '',
    status: agent.status,
  };
}

async function refreshAgentStudio() {
  await Promise.all([
    loadAgents(),
    loadAgentResources(),
  ]);
}

async function loadAgentResources() {
  if (!isAuthenticated.value) {
    availableTools.value = [];
    knowledgeBases.value = [];
    availableSkills.value = [];
    workflows.value = [];
    agentTeams.value = [];
    mcpServers.value = [];
    agentVersions.value = [];
    agentTestSuites.value = [];
    agentTestCases.value = [];
    agentMemories.value = [];
    return;
  }

  agentResourceLoading.value = true;
  try {
    const [tools, bases, skills, teamItems, mcpItems, workflowItems] = await Promise.all([
      fetchTools(backendBaseUrl.value),
      fetchKnowledgeBases(backendBaseUrl.value),
      fetchSkills(backendBaseUrl.value),
      fetchAgentTeams(backendBaseUrl.value),
      fetchMcpServers(backendBaseUrl.value),
      fetchWorkflows(backendBaseUrl.value),
    ]);
    availableTools.value = tools;
    knowledgeBases.value = bases;
    availableSkills.value = skills;
    agentTeams.value = teamItems;
    mcpServers.value = mcpItems;
    workflows.value = workflowItems;
    if (!knowledgeDocForm.value.kbId && bases[0]) knowledgeDocForm.value.kbId = bases[0].id;
    if (!activeTeamId.value && teamItems[0]) activeTeamId.value = teamItems[0].id;
    if (!activeWorkflowId.value && workflowItems[0]) activeWorkflowId.value = workflowItems[0].id;
    await loadAgentMemories();
    await loadAgentEvaluations();
    await loadAgentVersions();
    await loadAgentTestSuites();
  } catch (error) {
    console.error('[loadAgentResources] failed:', error);
  } finally {
    agentResourceLoading.value = false;
  }
}

async function loadAgentMemories(agentId = agentForm.value.id) {
  if (!isAuthenticated.value || !agentId) {
    agentMemories.value = [];
    return;
  }
  try {
    agentMemories.value = await fetchMemories(agentId, backendBaseUrl.value);
  } catch (error) {
    console.error('[loadAgentMemories] failed:', error);
  }
}

async function loadAgentEvaluations(agentId = agentForm.value.id) {
  if (!isAuthenticated.value || !agentId) {
    agentEvaluations.value = [];
    agentStats.value = null;
    return;
  }
  agentEvaluationLoading.value = true;
  try {
    const [evaluations, stats] = await Promise.all([
      fetchAgentEvaluations(agentId, backendBaseUrl.value),
      fetchAgentStats(agentId, backendBaseUrl.value),
    ]);
    agentEvaluations.value = evaluations;
    agentStats.value = stats;
  } catch (error) {
    console.error('[loadAgentEvaluations] failed:', error);
  } finally {
    agentEvaluationLoading.value = false;
  }
}

async function loadAgentVersions(agentId = agentForm.value.id) {
  if (!isAuthenticated.value || !agentId) {
    agentVersions.value = [];
    return;
  }
  try {
    agentVersions.value = await fetchAgentVersions(agentId, backendBaseUrl.value);
  } catch (error) {
    console.error('[loadAgentVersions] failed:', error);
  }
}

async function loadAgentTestSuites(agentId = agentForm.value.id) {
  if (!isAuthenticated.value || !agentId) {
    agentTestSuites.value = [];
    agentTestCases.value = [];
    activeTestSuiteId.value = '';
    return;
  }
  try {
    agentTestSuites.value = await fetchAgentTestSuites(agentId, backendBaseUrl.value);
    if (!activeTestSuiteId.value && agentTestSuites.value[0]) {
      activeTestSuiteId.value = agentTestSuites.value[0].id;
    }
    if (activeTestSuiteId.value) {
      agentTestCases.value = await fetchAgentTestCases(activeTestSuiteId.value, backendBaseUrl.value);
    }
  } catch (error) {
    console.error('[loadAgentTestSuites] failed:', error);
  }
}

async function loadAgents() {
  if (!isAuthenticated.value) {
    agents.value = [];
    resetAgentForm();
    return;
  }
  agentLoading.value = true;
  try {
    const data = await fetchAgents(backendBaseUrl.value);
    agents.value = data;
    const existing = activeAgentId.value ? data.find((agent) => agent.id === activeAgentId.value) : null;
    const next = existing ?? data[0] ?? null;
    if (next) {
      activeAgentId.value = next.id;
      fillAgentForm(next);
      await loadAgentRuns(next.id);
      await loadAgentMemories(next.id);
      await loadAgentEvaluations(next.id);
      await loadAgentVersions(next.id);
      await loadAgentTestSuites(next.id);
    } else {
      activeAgentId.value = '';
      resetAgentForm();
    }
    void loadAgentResources();
  } catch (error) {
    status.value = error instanceof Error ? error.message : '加载 Agent 失败';
  } finally {
    agentLoading.value = false;
  }
}

async function loadAgentRuns(agentId = activeAgentId.value) {
  if (!agentId || !isAuthenticated.value) {
    agentRuns.value = [];
    activeAgentRun.value = null;
    return;
  }
  try {
    agentRuns.value = await fetchAgentRuns(agentId, backendBaseUrl.value);
    activeAgentRun.value = agentRuns.value[0] ?? activeAgentRun.value;
  } catch (error) {
    console.error('[loadAgentRuns] failed:', error);
  }
}

function createAgentDraft() {
  activeAgentId.value = '';
  resetAgentForm();
  status.value = '已创建本地 Agent 草稿';
}

function selectAgent(agent: AgentDefinition) {
  activeAgentId.value = agent.id;
  fillAgentForm(agent);
  void loadAgentRuns(agent.id);
  void loadAgentMemories(agent.id);
  void loadAgentEvaluations(agent.id);
  void loadAgentVersions(agent.id);
  void loadAgentTestSuites(agent.id);
}

function startAgentBuilderDrag(block: AgentBuilderBlock) {
  agentBuilderDragging.value = block.type;
}

function dropAgentBuilderBlock() {
  const type = agentBuilderDragging.value;
  if (!type) return;
  const block = agentBuilderBlocks.find((item) => item.type === type);
  if (!block) return;
  if (!agentBuilderCanvas.value.some((item) => item.type === type)) {
    agentBuilderCanvas.value = [...agentBuilderCanvas.value, block];
  }
  agentBuilderDragging.value = '';
}

function removeAgentBuilderBlock(type: AgentBuilderBlockType) {
  agentBuilderCanvas.value = agentBuilderCanvas.value.filter((item) => item.type !== type);
}

function clearAgentBuilderCanvas() {
  agentBuilderCanvas.value = [];
}

function applyAgentBuilder() {
  if (agentBuilderCanvas.value.length === 0) {
    status.value = '请先拖入至少一个 Agent 模块';
    return;
  }

  const selectedTypes = new Set(agentBuilderCanvas.value.map((item) => item.type));
  if (selectedTypes.has('identity')) {
    agentForm.value.name = agentForm.value.id ? agentForm.value.name : '拖拽生成 Agent';
    agentForm.value.description = '由 Agent Builder 组合生成，可继续微调工具、知识库和提示词。';
    agentForm.value.systemPrompt = [
      '你是一个任务型 AI Agent。',
      '你会先理解用户目标，再按步骤调用可用工具、参考知识库和长期记忆。',
      '输出时先给结论，再给关键步骤和可执行结果。',
    ].join('\n');
  }

  if (selectedTypes.has('model')) {
    const defaultModel = selectedModel.value && selectedModel.value !== 'auto'
      ? selectedModel.value
      : (chatModels.value[0]?.id || models.value[0]?.id || '');
    if (defaultModel) agentForm.value.model = defaultModel;
  }

  if (selectedTypes.has('tools')) {
    const preferred = ['current_time', 'calculator', 'text_stats', 'javascript_runner'];
    const preferredIds = availableTools.value
      .filter((tool) => preferred.includes(tool.name))
      .map((tool) => tool.id);
    agentForm.value.toolIds = Array.from(new Set([...agentForm.value.toolIds, ...preferredIds]));
  }

  if (selectedTypes.has('skills')) {
    const preferred = ['Research Planner', 'Code Operator', 'Data Analyst', 'Workflow Orchestrator'];
    const preferredIds = availableSkills.value
      .filter((skill) => preferred.includes(skill.name))
      .map((skill) => skill.id);
    agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, ...preferredIds]));
  }

  if (selectedTypes.has('knowledge')) {
    const kbId = knowledgeBases.value[0]?.id;
    if (kbId && !agentForm.value.knowledgeBaseIds.includes(kbId)) {
      agentForm.value.knowledgeBaseIds = [...agentForm.value.knowledgeBaseIds, kbId];
    }
  }

  if (selectedTypes.has('memory')) {
    agentForm.value.memoryEnabled = true;
  }

  if (selectedTypes.has('run')) {
    agentPrompt.value = '请基于你的角色设定、可用工具、知识库和长期记忆，给出一份当前能力说明和一次示例执行。';
  }

  status.value = `已应用 ${agentBuilderCanvas.value.length} 个 Builder 模块`;
}

async function persistAgent(): Promise<AgentDefinition | null> {
  if (!isAuthenticated.value) {
    isAuthDialogOpen.value = true;
    return null;
  }
  const name = agentForm.value.name.trim();
  const model = agentForm.value.model.trim();
  if (!name || !model) {
    status.value = '请填写 Agent 名称并选择模型';
    return null;
  }

  agentSaving.value = true;
  try {
    const basePayload = {
      name,
      description: agentForm.value.description.trim(),
      model,
      systemPrompt: agentForm.value.systemPrompt.trim(),
      temperature: agentForm.value.temperature,
      maxTokens: agentForm.value.maxTokens,
      memoryEnabled: agentForm.value.memoryEnabled,
      toolIds: [...agentForm.value.toolIds],
      knowledgeBaseIds: [...agentForm.value.knowledgeBaseIds],
      skillIds: [...agentForm.value.skillIds],
    };
    const updatePayload = {
      ...basePayload,
      status: agentForm.value.status,
    };
    const saved = agentForm.value.id
      ? await apiUpdateAgent(agentForm.value.id, updatePayload, backendBaseUrl.value)
      : await apiCreateAgent(basePayload, backendBaseUrl.value);

    const idx = agents.value.findIndex((agent) => agent.id === saved.id);
    if (idx >= 0) agents.value.splice(idx, 1, saved);
    else agents.value.unshift(saved);
    activeAgentId.value = saved.id;
    fillAgentForm(saved);
    status.value = 'Agent 已保存';
    return saved;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '保存 Agent 失败';
    return null;
  } finally {
    agentSaving.value = false;
  }
}

async function saveAgentPublication() {
  if (!agentForm.value.id) {
    status.value = '请先保存 Agent，再配置发布接入';
    return;
  }
  if (agentPublishing.value) return;
  agentPublishing.value = true;
  try {
    const saved = await apiUpdateAgentPublication(agentForm.value.id, {
      published: agentForm.value.published,
      apiEnabled: agentForm.value.apiEnabled,
      publicSlug: agentForm.value.publicSlug || agentForm.value.name,
    }, backendBaseUrl.value);
    const idx = agents.value.findIndex((agent) => agent.id === saved.id);
    if (idx >= 0) agents.value.splice(idx, 1, saved);
    fillAgentForm(saved);
    status.value = 'Agent 发布配置已保存';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '保存发布配置失败';
  } finally {
    agentPublishing.value = false;
  }
}

async function generateAgentFromRequirement() {
  if (!generatorForm.value.requirement.trim() || agentGenerating.value) return;
  const model = agentForm.value.model || selectedModel.value || chatModels.value[0]?.id || models.value[0]?.id || '';
  if (!model || model === 'auto') {
    status.value = '请先选择一个具体模型用于生成 Agent';
    return;
  }
  agentGenerating.value = true;
  try {
    const generated = await apiGenerateAgent({
      requirement: generatorForm.value.requirement.trim(),
      model,
      persist: true,
    }, backendBaseUrl.value);
    const idx = agents.value.findIndex((agent) => agent.id === generated.id);
    if (idx >= 0) agents.value.splice(idx, 1, generated);
    else agents.value.unshift(generated);
    activeAgentId.value = generated.id;
    fillAgentForm(generated);
    generatorForm.value.requirement = '';
    status.value = 'Agent 已自动生成';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '自动生成 Agent 失败';
  } finally {
    agentGenerating.value = false;
  }
}

async function saveAgent() {
  await persistAgent();
}

async function removeAgent(agent: AgentDefinition) {
  if (!window.confirm(`确认删除 Agent「${agent.name}」？运行记录会保留用于审计。`)) return;
  try {
    await apiDeleteAgent(agent.id, backendBaseUrl.value);
    agents.value = agents.value.filter((item) => item.id !== agent.id);
    if (activeAgentId.value === agent.id) {
      const next = agents.value[0] ?? null;
      if (next) {
        selectAgent(next);
      } else {
        activeAgentId.value = '';
        resetAgentForm();
      }
    }
    status.value = 'Agent 已删除';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '删除 Agent 失败';
  }
}

async function runCurrentAgent() {
  const input = agentPrompt.value.trim();
  if (!input || agentRunning.value) return;
  const agent = agentForm.value.id ? activeAgent.value : await persistAgent();
  if (!agent) return;

  agentRunning.value = true;
  activeAgentRun.value = null;
  status.value = 'Agent 正在执行';
  try {
    const imageUrls = agentImageUrlInput.value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const run = await apiRunAgent(agent.id, input, { imageUrls }, backendBaseUrl.value);
    activeAgentRun.value = run;
    agentRuns.value = [run, ...agentRuns.value.filter((item) => item.id !== run.id)].slice(0, 20);
    agentPrompt.value = '';
    status.value = run.status === 'succeeded' ? 'Agent 执行完成' : 'Agent 执行失败';
    try { authUser.value = await fetchMe(backendBaseUrl.value); } catch {}
    try { billingLedger.value = await fetchBillingLedger(backendBaseUrl.value); } catch {}
    void loadAgents();
  } catch (error) {
    status.value = error instanceof Error ? error.message : '运行 Agent 失败';
  } finally {
    agentRunning.value = false;
  }
}

function selectAgentRun(run: AgentRun) {
  activeAgentRun.value = run;
}

function agentRunTagType(statusValue: AgentRun['status'] | AgentRun['steps'][number]['status']) {
  if (statusValue === 'succeeded') return 'success';
  if (statusValue === 'failed') return 'danger';
  return 'warning';
}

function agentEvalTagType(grade: AgentEvaluation['grade']) {
  if (grade === 'excellent' || grade === 'good') return 'success';
  if (grade === 'fair') return 'warning';
  return 'danger';
}

async function evaluateActiveAgentRun() {
  if (!activeAgentRun.value || agentEvaluationSaving.value) return;
  agentEvaluationSaving.value = true;
  try {
    const evaluation = await apiEvaluateAgentRun(activeAgentRun.value.id, {
      expectedOutput: evaluationForm.value.expectedOutput.trim() || undefined,
      rubric: evaluationForm.value.rubric.trim() || undefined,
    }, backendBaseUrl.value);
    agentEvaluations.value = [evaluation, ...agentEvaluations.value.filter((item) => item.id !== evaluation.id)];
    evaluationForm.value.expectedOutput = '';
    evaluationForm.value.rubric = '';
    await loadAgentEvaluations(activeAgentRun.value.agentId);
    status.value = `评测完成：${evaluation.score}/100`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '评测失败';
  } finally {
    agentEvaluationSaving.value = false;
  }
}

function formatAgentDate(value?: string | null) {
  if (!value) return '暂无';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatStepMetadata(raw: string) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

async function createKnowledgeBaseFromForm() {
  const name = knowledgeForm.value.name.trim();
  if (!name || knowledgeCreating.value) return;
  knowledgeCreating.value = true;
  try {
    const kb = await apiCreateKnowledgeBase({
      name,
      description: knowledgeForm.value.description.trim(),
    }, backendBaseUrl.value);
    knowledgeBases.value = [kb, ...knowledgeBases.value.filter((item) => item.id !== kb.id)];
    knowledgeDocForm.value.kbId = kb.id;
    knowledgeForm.value = { name: '', description: '' };
    status.value = '知识库已创建';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建知识库失败';
  } finally {
    knowledgeCreating.value = false;
  }
}

async function addDocumentToKnowledgeBase() {
  const kbId = knowledgeDocForm.value.kbId;
  const title = knowledgeDocForm.value.title.trim();
  const content = knowledgeDocForm.value.content.trim();
  if (!kbId || !title || !content || knowledgeDocSaving.value) return;
  knowledgeDocSaving.value = true;
  try {
    const result = await apiAddKnowledgeDocument(kbId, { title, content }, backendBaseUrl.value);
    if (!agentForm.value.knowledgeBaseIds.includes(kbId)) {
      agentForm.value.knowledgeBaseIds = [...agentForm.value.knowledgeBaseIds, kbId];
    }
    knowledgeDocForm.value.title = '';
    knowledgeDocForm.value.content = '';
    await loadAgentResources();
    status.value = `文档已入库，切分 ${result.chunkCount} 个片段`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '写入知识库失败';
  } finally {
    knowledgeDocSaving.value = false;
  }
}

async function createAgentMemory() {
  const content = memoryForm.value.content.trim();
  if (!content || memorySaving.value) return;
  if (!agentForm.value.id) {
    status.value = '请先保存 Agent，再写入专属记忆';
    return;
  }
  memorySaving.value = true;
  try {
    await apiCreateMemory({
      agentId: agentForm.value.id,
      namespace: 'manual',
      memoryType: 'fact',
      content,
      importance: memoryForm.value.importance,
    }, backendBaseUrl.value);
    memoryForm.value.content = '';
    await loadAgentMemories(agentForm.value.id);
    status.value = '记忆已写入';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '写入记忆失败';
  } finally {
    memorySaving.value = false;
  }
}

async function createSkillFromForm() {
  const name = skillForm.value.name.trim();
  const content = skillForm.value.content.trim();
  if (!name || !content || skillCreating.value) return;
  skillCreating.value = true;
  try {
    const skill = await apiCreateSkill({
      name,
      description: skillForm.value.description.trim(),
      content,
      category: skillForm.value.category.trim() || 'custom',
    }, backendBaseUrl.value);
    availableSkills.value = [skill, ...availableSkills.value.filter((item) => item.id !== skill.id)];
    agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, skill.id]));
    skillForm.value = { name: '', description: '', category: 'custom', content: '' };
    status.value = 'Skill 已创建并挂载到当前 Agent';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建 Skill 失败';
  } finally {
    skillCreating.value = false;
  }
}

async function createTeamFromForm() {
  const name = (teamForm.value.name.trim() || `${agentForm.value.name || 'Agent'} Team`).slice(0, 80);
  const ids = Array.from(new Set([
    agentForm.value.id,
    ...teamForm.value.memberIds,
  ].filter(Boolean)));
  if (ids.length === 0) {
    status.value = '请先保存或选择至少一个 Agent';
    return;
  }
  if (teamCreating.value) return;
  teamCreating.value = true;
  try {
    const team = await apiCreateAgentTeam({
      name,
      description: teamForm.value.description.trim(),
      strategy: teamForm.value.strategy,
      members: ids.map((agentId, index) => ({
        agentId,
        role: index === 0 ? '主执行 Agent' : `协作 Agent ${index + 1}`,
      })),
    }, backendBaseUrl.value);
    agentTeams.value = [team, ...agentTeams.value.filter((item) => item.id !== team.id)];
    activeTeamId.value = team.id;
    teamForm.value.name = '';
    teamForm.value.description = '';
    teamForm.value.memberIds = [];
    status.value = 'Agent Team 已创建';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建 Agent Team 失败';
  } finally {
    teamCreating.value = false;
  }
}

async function runSelectedTeam() {
  if (!activeTeamId.value || !teamInput.value.trim() || teamRunning.value) return;
  teamRunning.value = true;
  try {
    activeTeamRun.value = await apiRunAgentTeam(activeTeamId.value, teamInput.value.trim(), backendBaseUrl.value);
    status.value = `Agent Team 运行完成：${activeTeamRun.value.status}`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '运行 Agent Team 失败';
  } finally {
    teamRunning.value = false;
  }
}

async function createVersionFromForm() {
  if (!agentForm.value.id || versionSaving.value) {
    status.value = '请先保存 Agent，再创建版本';
    return;
  }
  versionSaving.value = true;
  try {
    const version = await apiCreateAgentVersion(agentForm.value.id, versionForm.value.label.trim(), backendBaseUrl.value);
    agentVersions.value = [version, ...agentVersions.value.filter((item) => item.id !== version.id)];
    versionForm.value.label = '';
    status.value = `已创建 Agent 版本 v${version.versionNumber}`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建版本失败';
  } finally {
    versionSaving.value = false;
  }
}

async function restoreVersion(versionId: string) {
  if (!agentForm.value.id || versionSaving.value) return;
  versionSaving.value = true;
  try {
    const restored = await apiRestoreAgentVersion(agentForm.value.id, versionId, backendBaseUrl.value);
    fillAgentForm(restored);
    status.value = 'Agent 版本已恢复';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '恢复版本失败';
  } finally {
    versionSaving.value = false;
  }
}

async function createTestSuiteFromForm() {
  if (!agentForm.value.id || !testSuiteForm.value.name.trim() || testSaving.value) return;
  testSaving.value = true;
  try {
    const suite = await apiCreateAgentTestSuite(agentForm.value.id, {
      name: testSuiteForm.value.name.trim(),
      description: testSuiteForm.value.description.trim(),
    }, backendBaseUrl.value);
    agentTestSuites.value = [suite, ...agentTestSuites.value.filter((item) => item.id !== suite.id)];
    activeTestSuiteId.value = suite.id;
    testSuiteForm.value = { name: '', description: '' };
    agentTestCases.value = [];
    status.value = '测试集已创建';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建测试集失败';
  } finally {
    testSaving.value = false;
  }
}

async function createTestCaseFromForm() {
  if (!activeTestSuiteId.value || !testCaseForm.value.name.trim() || !testCaseForm.value.input.trim() || testSaving.value) return;
  testSaving.value = true;
  try {
    const testCase = await apiCreateAgentTestCase(activeTestSuiteId.value, {
      name: testCaseForm.value.name.trim(),
      input: testCaseForm.value.input.trim(),
      expectedOutput: testCaseForm.value.expectedOutput.trim(),
      rubric: testCaseForm.value.rubric.trim(),
    }, backendBaseUrl.value);
    agentTestCases.value = [...agentTestCases.value, testCase];
    testCaseForm.value = { name: '', input: '', expectedOutput: '', rubric: '' };
    await loadAgentTestSuites();
    status.value = '测试用例已添加';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '添加测试用例失败';
  } finally {
    testSaving.value = false;
  }
}

async function loadSelectedTestCases() {
  if (!activeTestSuiteId.value) {
    agentTestCases.value = [];
    return;
  }
  try {
    agentTestCases.value = await fetchAgentTestCases(activeTestSuiteId.value, backendBaseUrl.value);
  } catch (error) {
    status.value = error instanceof Error ? error.message : '加载测试用例失败';
  }
}

async function runSelectedTestSuite() {
  if (!activeTestSuiteId.value || testRunning.value) return;
  testRunning.value = true;
  try {
    activeTestRun.value = await apiRunAgentTestSuite(activeTestSuiteId.value, backendBaseUrl.value);
    status.value = '回归测试已完成';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '运行回归测试失败';
  } finally {
    testRunning.value = false;
  }
}

async function createMcpServerFromForm() {
  if (!mcpForm.value.token.trim() || mcpSaving.value) return;
  mcpSaving.value = true;
  try {
    const server = await apiCreateMcpServer({
      name: mcpForm.value.name.trim() || 'Notion',
      serverType: 'notion',
      config: { token: mcpForm.value.token.trim() },
      enabled: true,
    }, backendBaseUrl.value);
    mcpServers.value = [server, ...mcpServers.value.filter((item) => item.id !== server.id)];
    mcpForm.value.token = '';
    status.value = 'Notion MCP Server 已保存';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '保存 MCP Server 失败';
  } finally {
    mcpSaving.value = false;
  }
}

async function testMcpServer(serverId: string) {
  if (mcpTesting.value) return;
  mcpTesting.value = true;
  try {
    const result = await apiTestMcpServer(serverId, mcpForm.value.query.trim() || 'test', backendBaseUrl.value);
    status.value = `MCP 测试${result.ok ? '成功' : '失败'}`;
    mcpServers.value = await fetchMcpServers(backendBaseUrl.value);
  } catch (error) {
    status.value = error instanceof Error ? error.message : '测试 MCP 失败';
  } finally {
    mcpTesting.value = false;
  }
}

async function createDefaultWorkflow() {
  if (workflowCreating.value) return;
  workflowCreating.value = true;
  try {
    const nodes: WorkflowNode[] = [];
    if (agentForm.value.memoryEnabled && agentForm.value.id) {
      nodes.push({
        id: createId('wf-memory'),
        type: 'memory',
        name: '长期记忆检索',
        config: { agentId: agentForm.value.id },
      });
    }
    if (agentForm.value.knowledgeBaseIds.length > 0) {
      nodes.push({
        id: createId('wf-knowledge'),
        type: 'knowledge',
        name: '知识库检索',
        config: { kbIds: agentForm.value.knowledgeBaseIds },
      });
    }
    if (agentForm.value.toolIds.length > 0) {
      const textStatsTool = availableTools.value.find((tool) => tool.name === 'text_stats' && agentForm.value.toolIds.includes(tool.id));
      if (textStatsTool) {
        nodes.push({
          id: createId('wf-tool'),
          type: 'tool',
          name: '文本统计',
          config: { toolId: textStatsTool.id, args: { text: '{{input}}' } },
        });
      }
    }
    nodes.push({
      id: createId('wf-prompt'),
      type: 'prompt',
      name: '上下文整理',
      config: { template: '用户原始任务:\n{{originalInput}}\n\n上游节点输出:\n{{input}}' },
    });

    if (agentForm.value.id) {
      nodes.push({
        id: createId('wf-agent'),
        type: 'agent',
        name: 'Agent 执行',
        config: {
          agentId: agentForm.value.id,
          input: '请完成用户原始任务:\n{{originalInput}}\n\n可参考的上游上下文:\n{{input}}',
        },
      });
    }

    const workflow = await apiCreateWorkflow({
      name: `${agentForm.value.name || 'Agent'} Workflow`,
      description: 'Agent Studio 生成的顺序编排',
      nodes,
    }, backendBaseUrl.value);
    workflows.value = [workflow, ...workflows.value.filter((item) => item.id !== workflow.id)];
    activeWorkflowId.value = workflow.id;
    status.value = 'Workflow 已生成';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '生成 Workflow 失败';
  } finally {
    workflowCreating.value = false;
  }
}

async function runSelectedWorkflow() {
  const input = workflowInput.value.trim();
  if (!activeWorkflowId.value || !input || workflowRunning.value) return;
  workflowRunning.value = true;
  activeWorkflowRun.value = null;
  try {
    activeWorkflowRun.value = await apiRunWorkflow(activeWorkflowId.value, input, backendBaseUrl.value);
    workflowInput.value = '';
    status.value = activeWorkflowRun.value.status === 'succeeded' ? 'Workflow 执行完成' : 'Workflow 执行失败';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '运行 Workflow 失败';
  } finally {
    workflowRunning.value = false;
  }
}

async function bootstrapAuth() {
  const token = getStoredToken();
  try {
    authUser.value = await fetchMe(backendBaseUrl.value);
    await loadUserData();
    await fetchUserInvitationCode();
  } catch {
    if (token) { clearStoredToken(); }
    authUser.value = null;
    status.value = '请先登录以使用中转 API';
  } finally {
    isAuthLoaded.value = true;
  }
}

async function fetchUserInvitationCode() {
  try {
    userInvitationCode.value = await fetchInvitationCode(backendBaseUrl.value);
  } catch {
    userInvitationCode.value = null;
  }
}

onMounted(() => { void bootstrapAuth(); });

async function submitAuth() {
  authError.value = '';
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) {
    authError.value = '请输入用户名和密码';
    return;
  }

  if (authMode.value === 'register') {
    const email = authEmail.value.trim();
    if (!email) {
      authError.value = '请输入邮箱';
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      authError.value = '邮箱格式不正确';
      return;
    }
    if (!authVerificationCode.value.trim()) {
      authError.value = '请输入验证码';
      return;
    }
  }

  authLoading.value = true;
  try {
    const invitationCode = authMode.value === 'register' ? authInvitationCode.value.trim() || undefined : undefined;
    const result = authMode.value === 'register'
      ? await register(username, password, authEmail.value.trim(), authVerificationCode.value.trim(), invitationCode, backendBaseUrl.value)
      : await login(username, password, backendBaseUrl.value);
    setStoredToken(result.accessToken);
    authUser.value = result.user;
    authPassword.value = '';
    authEmail.value = '';
    authVerificationCode.value = '';
    authInvitationCode.value = '';
    authError.value = '';
    authLoading.value = false;
    isAuthDialogOpen.value = false;
    status.value = `欢迎回来，${result.user.username}`;
    await loadUserData();
    await fetchUserInvitationCode();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '登录失败';
    authLoading.value = false;
  }
}

async function onAuthDialogClosed() {
  authError.value = '';
  authEmail.value = '';
  authVerificationCode.value = '';
  codeCountdown.value = 0;
  if (codeTimer) { clearInterval(codeTimer); codeTimer = null; }
}

async function handleSendCode() {
  authError.value = '';
  const email = authEmail.value.trim();
  if (!email) {
    authError.value = '请输入邮箱';
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    authError.value = '邮箱格式不正确';
    return;
  }

  try {
    await sendVerificationCode(email, backendBaseUrl.value);
    codeCountdown.value = 60;
    if (codeTimer) clearInterval(codeTimer);
    codeTimer = setInterval(() => {
      codeCountdown.value--;
      if (codeCountdown.value <= 0) {
        codeCountdown.value = 0;
        if (codeTimer) { clearInterval(codeTimer); codeTimer = null; }
      }
    }, 1000);
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '发送验证码失败';
  }
}

async function loadUserData() {
  try {
    const remoteSessions = await fetchConversations(backendBaseUrl.value);
    if (remoteSessions.length > 0) {
      const mapped = remoteSessions.map((s) => ({
        ...s,
        chatType: (s.chatType || 'direct') as 'direct' | 'battle' | 'group',
        updatedAt: typeof s.updatedAt === 'string' ? Number(s.updatedAt) : s.updatedAt,
        messages: Array.isArray(s.messages)
          ? s.messages.map((m) => ({
              ...m,
              id: String(m.id),
              content: m.content ?? '',
            }))
          : [],
      }));
      const draftSession = { id: createId('session'), title: '新对话', chatType: 'direct' as const, messages: [] as ChatMessage[], updatedAt: Date.now(), isDraft: true };
      sessions.value = [draftSession, ...mapped];
      activeSessionId.value = draftSession.id;
    }
  } catch (e) { console.error('[loadUserData] conversations failed:', e); }
  try { billingRules.value = await fetchBillingRules(backendBaseUrl.value); } catch (e) { console.error('[loadUserData] billingRules failed:', e); }
  try { billingLedger.value = await fetchBillingLedger(backendBaseUrl.value); } catch (e) { console.error('[loadUserData] billingLedger failed:', e); }
  try {
    apiKeys.value = (await listApiKeys(backendBaseUrl.value)).map(k => ({
      id: k.id, name: k.name, maskedKey: k.key, createdAt: k.createdAt,
    }));
  } catch (e) { console.error('[loadUserData] apiKeys failed:', e); }
  try { pageModelsConfig.value = await fetchPageModels(backendBaseUrl.value); } catch (e) { console.error('[loadUserData] pageModels failed:', e); }
  try { await loadModels(); } catch (e) { console.error('[loadUserData] loadModels failed:', e); }
  try { await loadAgents(); } catch (e) { console.error('[loadUserData] loadAgents failed:', e); }
  isSessionLoaded.value = true;
}

function handleUserMenu(cmd: string) {
  if (cmd === 'logout') logout();
  else if (cmd === 'console') switchPage('console');
}

function logout() {
  clearStoredToken();
  apiLogout(backendBaseUrl.value).catch(() => {});
  authUser.value = null;
  models.value = [];
  billingRules.value = [];
  billingLedger.value = [];
  apiKeys.value = [];
  agents.value = [];
  activeAgentId.value = '';
  agentRuns.value = [];
  activeAgentRun.value = null;
  availableTools.value = [];
  knowledgeBases.value = [];
  agentMemories.value = [];
  workflows.value = [];
  activeWorkflowId.value = '';
  activeWorkflowRun.value = null;
  isSessionLoaded.value = false;
  isAuthLoaded.value = true;
  sessions.value = [{
    id: createId('session'),
    title: '新对话',
    chatType: 'direct',
    messages: [],
    updatedAt: Date.now(),
    isDraft: true,
  }];
  activeSessionId.value = sessions.value[0].id;
  status.value = '已退出登录';
}

async function handleTopUp() {
  if (!authUser.value || topUpAmount.value <= 0) return;
  topUpLoading.value = true;
  try {
    authUser.value = await topUp(topUpAmount.value, backendBaseUrl.value);
    billingLedger.value = await fetchBillingLedger(backendBaseUrl.value);
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '充值失败';
  } finally {
    topUpLoading.value = false;
  }
}

// ── Alipay Recharge ──

function openRechargeDialog() {
  rechargeAmount.value = 10;
  rechargeQrCode.value = '';
  rechargeOrderId.value = '';
  rechargeError.value = '';
  rechargeDialogVisible.value = true;
}

async function submitRecharge() {
  rechargeError.value = '';
  rechargeQrCode.value = '';
  rechargeLoading.value = true;
  try {
    const order = await createRechargeOrder(rechargeAmount.value, backendBaseUrl.value);
    rechargeOrderId.value = order.id;
    rechargeQrCode.value = order.qrCode || '';
    if (!rechargeQrCode.value) {
      rechargeError.value = '生成二维码失败，请重试';
    } else {
      startRechargePolling();
    }
  } catch (error) {
    rechargeError.value = error instanceof Error ? error.message : '创建订单失败';
  } finally {
    rechargeLoading.value = false;
  }
}

function startRechargePolling() {
  stopRechargePolling();
  rechargePollTimer = setInterval(async () => {
    if (!rechargeOrderId.value) { stopRechargePolling(); return; }
    try {
      const order = await checkRechargeOrder(rechargeOrderId.value, backendBaseUrl.value);
      if (order.status === 'paid') {
        stopRechargePolling();
        fetchMe(backendBaseUrl.value).then((u) => { authUser.value = u; }).catch(() => {});
        loadRechargeOrders();
        closeRechargeDialog();
      }
    } catch { /* ignore poll errors */ }
  }, 4000);
}

function stopRechargePolling() {
  if (rechargePollTimer) { clearInterval(rechargePollTimer); rechargePollTimer = null; }
}

async function loadRechargeOrders() {
  rechargeOrdersLoading.value = true;
  try {
    const result = await fetchRechargeOrders(1, 20, backendBaseUrl.value);
    rechargeOrders.value = result.data;
  } catch {
    rechargeOrders.value = [];
  } finally {
    rechargeOrdersLoading.value = false;
  }
}

async function handleCheckPayment() {
  if (!rechargeOrderId.value) return;
  rechargeChecking.value = true;
  try {
    const order = await checkRechargeOrder(rechargeOrderId.value, backendBaseUrl.value);
    if (order.status === 'paid') {
      rechargeError.value = '';
      fetchMe(backendBaseUrl.value).then((u) => { authUser.value = u; }).catch(() => {});
      loadRechargeOrders();
      closeRechargeDialog();
    } else {
      rechargeError.value = '订单未支付，请完成扫码支付后再查询';
    }
  } catch (error) {
    rechargeError.value = error instanceof Error ? error.message : '查询失败';
  } finally {
    rechargeChecking.value = false;
  }
}

function closeRechargeDialog() {
  stopRechargePolling();
  rechargeDialogVisible.value = false;
  rechargeQrCode.value = '';
  rechargeOrderId.value = '';
  rechargeError.value = '';
  fetchMe(backendBaseUrl.value).then((u) => { authUser.value = u; }).catch(() => {});
  billingLedger.value = [];
  fetchBillingLedger(backendBaseUrl.value).then((l) => { billingLedger.value = l; }).catch(() => {});
  loadRechargeOrders();
}

async function refreshBillingData() {
  if (!isAuthenticated.value) return;
  try {
    billingRules.value = await fetchBillingRules(backendBaseUrl.value);
    billingLedger.value = await fetchBillingLedger(backendBaseUrl.value);
  } catch (e) {
    console.error('[refreshBillingData] failed:', e);
    status.value = '刷新账单数据失败，请检查后端日志';
  }
}

function upsertActiveSession(nextMessages: ChatMessage[], titleHint?: string) {
  const session = activeSession.value;
  if (!session) return;

  const hasUserMessage = nextMessages.some((m) => m.role === 'user');

  sessions.value = sessions.value
    .map((s) => {
      if (s.id !== session.id) return s;
      return {
        ...s,
        title: s.title === '新对话' || s.title === '欢迎对话'
          ? buildSessionTitle(titleHint ?? nextMessages.find((m) => m.role === 'user')?.content ?? '')
          : s.title,
        messages: nextMessages,
        updatedAt: Date.now(),
        ...(hasUserMessage && s.isDraft ? { isDraft: false } : {}),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function submitPrompt() {
  if (isComposing.value) return;
  const content = draft.value.trim();
  if (!content || isSubmitting.value || !activeSession.value) return;
  if (!selectedModel.value || (models.value.length === 0 && selectedModel.value !== 'auto')) {
    status.value = '请先加载模型列表并选择模型'; return;
  }

  const baseMessages = [...activeMessages.value];
  const userMsg: ChatMessage = { id: createId('user'), role: 'user', content };
  const requestMessages: ChatMessage[] = [...baseMessages, userMsg];
  const assistantMsgId = createId('assistant');
  const currentModel = selectedModel.value;
  upsertActiveSession([...requestMessages, { id: assistantMsgId, role: 'assistant', content: '', reasoning: '', model: currentModel }], content);
  draft.value = '';
  isSubmitting.value = true;
  status.value = currentModel === 'auto' ? '智能路由分析中...' : '正在连接模型';
  requestId.value = '';

  chatAbortController = new AbortController();

  let streamedContent = '';
  let streamedReasoning = '';
  let routedModel = currentModel;

  if (currentModel === 'auto') {
    // ── Auto routing: direct fetch with SSE parsing ──
    try {
      const res = await fetch(`${backendBaseUrl.value}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}) },
        body: JSON.stringify({
          model: 'auto',
          messages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          stream: true,
        }),
        signal: chatAbortController.signal,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream unavailable');

      const decoder = new TextDecoder();
      let buffer = '';
      let routeInfo: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const data = dataLine.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            if (json.router_decision) {
              const d = json.router_decision;
              routedModel = d.selectedModel;
              routeInfo = {
                intent: d.intent || '',
                intentLabel: d.intentLabel || '',
                model: d.selectedModel,
                reason: d.reason,
                debug: d.debug || undefined,
              };
              routerIntent.value = routeInfo.intentLabel;
              routerSelectedModel.value = routeInfo.model;
              routerReason.value = routeInfo.reason;
              routerDebug.value = routeInfo.debug || null;
              status.value = `路由: ${routeInfo.intentLabel} → ${routeInfo.model}`;
              // Update the assistant placeholder with routerInfo immediately
              upsertActiveSession([
                ...requestMessages,
                { id: assistantMsgId, role: 'assistant', content: '', model: routedModel, routerInfo: routeInfo },
              ], content);
              continue;
            }
            const token = json.choices?.[0]?.delta?.content;
            if (token) {
              streamedContent += token;
              upsertActiveSession([
                ...requestMessages,
                { id: assistantMsgId, role: 'assistant', content: streamedContent, model: routedModel, routerInfo: routeInfo },
              ], content);
            }
          } catch {}
        }
      }

      if (!streamedContent) {
        upsertActiveSession([
          ...requestMessages,
          { id: assistantMsgId, role: 'assistant', content: '(空响应)', model: routedModel },
        ], content);
      }
      status.value = '路由回复完成';
      triggerSync();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const errMsg = error instanceof Error ? error.message : '路由请求失败';
        status.value = errMsg;
        upsertActiveSession([
          ...requestMessages,
          { id: createId('err'), role: 'assistant', content: `路由请求失败：${errMsg}`, model: 'auto' },
        ], content);
      }
    }
  } else {
    // ── Normal model: use streamCompletion ──
    try {
      await streamCompletion(
        {
          model: currentModel,
          messages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          extra_body: { enable_thinking: true },
        },
        {
          onRequestId: (rid) => { requestId.value = rid; status.value = '正在流式生成回复'; },
          onChunk: (chunk) => {
            const choice = chunk.choices?.[0];
            const d = choice?.delta;
            const token = d?.content ?? '';
            const reason = d?.reasoning_content ?? '';
            if (!token && !reason && !choice?.finish_reason) return;
            if (token) streamedContent += token;
            if (reason) streamedReasoning += reason;
            upsertActiveSession([
              ...requestMessages,
              { id: assistantMsgId, role: 'assistant', content: streamedContent, reasoning: streamedReasoning, model: currentModel },
            ], content);
          },
          onDone: () => { status.value = '回复生成完成'; triggerSync(); },
          onAbort: () => {
            status.value = '已停止生成';
            upsertActiveSession([
              ...requestMessages,
              { id: assistantMsgId, role: 'assistant', content: streamedContent || '(已停止)', reasoning: streamedReasoning, model: currentModel },
            ], content);
          },
        },
        backendBaseUrl.value,
        chatAbortController.signal,
      );
      if (!streamedContent && !chatAbortController.signal.aborted) {
        upsertActiveSession([
          ...requestMessages,
          { id: assistantMsgId, role: 'assistant', content: '(空响应)', reasoning: '', model: currentModel },
        ], content);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '请求失败';
      status.value = errMsg;
      upsertActiveSession([
        ...requestMessages,
        { id: createId('err'), role: 'assistant', content: `请求失败：${errMsg}`, model: currentModel },
      ], content);
    }
  }

  isSubmitting.value = false;
  chatAbortController = null;
}

function stopChatGeneration() { chatAbortController?.abort(); }

/* ---------- Smart Router ---------- */

async function loadRouterRules() {
  routerLoading.value = true;
  try {
    const token = getStoredToken();
    const res = await fetch(`${backendBaseUrl.value}/router/rules`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json() as { data: Record<string, string[]> };
      routerRules.value = data.data ?? {};
    }
  } catch (e) { console.error('[router] loadRules:', e); }
  finally { routerLoading.value = false; }
}

async function submitRouterPrompt() {
  if (isComposing.value) return;
  const content = draft.value.trim();
  if (!content || isSubmitting.value) return;
  if (!isAuthenticated.value) { status.value = '请先登录'; return; }

  const baseMessages = [...activeMessages.value];
  const userMsg: ChatMessage = { id: createId('user'), role: 'user', content };
  const requestMessages: ChatMessage[] = [...baseMessages, userMsg];
  const assistantMsgId = createId('assistant');
  const fallbackModel = selectedModel.value || (models.value[0]?.id ?? '');
  upsertActiveSession([...requestMessages, { id: assistantMsgId, role: 'assistant', content: '', model: fallbackModel }], content);
  draft.value = '';
  isSubmitting.value = true;
  status.value = routerEnabled.value ? '智能路由分析中' : '发送中';

  chatAbortController = new AbortController();
  let streamedContent = '';

  const endpoint = routerEnabled.value
    ? `${backendBaseUrl.value}/router/chat/completions`
    : `${backendBaseUrl.value}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}) },
      body: JSON.stringify({
        model: fallbackModel,
        messages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        stream: true,
      }),
      signal: chatAbortController.signal,
      credentials: 'include',
    });

    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));

    // Read router headers
    if (routerEnabled.value) {
      const intent = res.headers.get('x-router-intent');
      const rmodel = res.headers.get('x-router-model');
      const reason = res.headers.get('x-router-reason');
      if (intent) routerIntent.value = intent;
      if (rmodel) routerSelectedModel.value = rmodel;
      if (reason) routerReason.value = decodeURIComponent(reason);
      routerConfidence.value = 0.8;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Stream unavailable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();
        if (!data) continue;

        // Check for router_decision SSE event
        if (routerEnabled.value && data.startsWith('{') && data.includes('router_decision')) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.router_decision) {
              const d = parsed.router_decision;
              routerIntent.value = d.intentLabel || d.intent;
              routerConfidence.value = d.confidence;
              routerSelectedModel.value = d.selectedModel;
              routerReason.value = d.reason;
              routerFallbacks.value = d.fallbacks || [];
              routerDebug.value = d.debug || null;
            }
          } catch {}
          continue;
        }

        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            streamedContent += token;
            upsertActiveSession([
              ...requestMessages,
              { id: assistantMsgId, role: 'assistant', content: streamedContent, model: routerSelectedModel.value || fallbackModel },
            ], content);
          }
        } catch {}
      }
    }

    if (!streamedContent) {
      upsertActiveSession([
        ...requestMessages,
        { id: assistantMsgId, role: 'assistant', content: '(空响应)', model: routerSelectedModel.value || fallbackModel },
      ], content);
    }
    status.value = '回复完成';
    triggerSync();
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      const errMsg = error instanceof Error ? error.message : '请求失败';
      status.value = errMsg;
      upsertActiveSession([
        ...requestMessages,
        { id: createId('err'), role: 'assistant', content: `请求失败：${errMsg}`, model: fallbackModel },
      ], content);
    }
  } finally {
    isSubmitting.value = false;
    chatAbortController = null;
  }
}

/* ---------- Collaborative Reasoning ---------- */

async function startCollab(refineQuery?: string) {
  if (isComposing.value) return;
  const prompt = (refineQuery || collabPrompt.value).trim();
  if (!prompt || collabRunning.value) return;
  if (!isAuthenticated.value) { status.value = '请先登录'; return; }

  collabLastQuery = refineQuery || prompt;
  collabLastMode = collabMode.value;
  if (!refineQuery) collabPrompt.value = '';
  collabRunning.value = true;

  // When refining, keep existing panels + summary visible, add new ones below
  if (!refineQuery) {
    collabPanels.value = [];
    collabSummary.value = '';
    collabSummaryStatus.value = 'idle';
  }
  collabAbortController = new AbortController();

  try {
    // Build messages: include previous context when refining
    const messages: Array<{ role: string; content: string }> = [];
    if (refineQuery && collabPanels.value.length > 0) {
      // Include previous collab results as context
      const contextParts = collabPanels.value.map((p) =>
        `【${p.modelName}】\n${p.content}`
      );
      if (collabSummary.value) {
        contextParts.push(`【汇总结果】\n${collabSummary.value}`);
      }
      messages.push({
        role: 'user',
        content: `之前的讨论：\n\n${contextParts.join('\n\n')}`,
      });
      messages.push({ role: 'assistant', content: '已了解以上讨论内容。' });
    }
    messages.push({ role: 'user', content: prompt });

    const body: any = {
      messages,
      mode: collabMode.value,
    };
    if (collabSelectedModels.value.length > 0) {
      body.models = collabSelectedModels.value;
    }

    const res = await fetch(`${backendBaseUrl.value}/collab/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}) },
      body: JSON.stringify(body),
      signal: collabAbortController.signal,
      credentials: 'include',
    });

    if (!res.ok) throw new Error(await res.text());

    const modelsHeader = res.headers.get('x-collab-models');
    if (modelsHeader) collabModels.value = modelsHeader.split(',');

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Stream unavailable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        try {
          const chunk = JSON.parse(dataLine.slice(5).trim());
          switch (chunk.type) {
            case 'model_start': {
              const exists = collabPanels.value.find((p) => p.modelId === chunk.modelId);
              if (!exists) {
                collabPanels.value = [...collabPanels.value, { modelId: chunk.modelId!, modelName: chunk.modelName || chunk.modelId!, content: '', status: 'streaming' }];
              } else {
                collabPanels.value = collabPanels.value.map((p) => p.modelId === chunk.modelId ? { ...p, modelName: chunk.modelName || p.modelName, status: 'streaming' } : p);
              }
              break;
            }
            case 'model_chunk': {
              collabPanels.value = collabPanels.value.map((p) => p.modelId === chunk.modelId ? { ...p, content: p.content + (chunk.content || ''), status: 'streaming' } : p);
              break;
            }
            case 'model_done': {
              collabPanels.value = collabPanels.value.map((p) => p.modelId === chunk.modelId ? { ...p, status: 'done' } : p);
              break;
            }
            case 'summary_start': {
              collabSummaryStatus.value = 'streaming';
              break;
            }
            case 'summary_chunk': {
              collabSummary.value += chunk.content || '';
              break;
            }
            case 'summary_done': {
              collabSummaryStatus.value = 'done';
              break;
            }
            case 'error': {
              status.value = chunk.error || '协同推理出错';
              break;
            }
          }
        } catch {}
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      status.value = error instanceof Error ? error.message : '协同推理失败';
    }
  } finally {
    collabRunning.value = false;
    collabAbortController = null;
  }
}

function clearCollab() {
  collabPanels.value = [];
  collabSummary.value = '';
  collabSummaryStatus.value = 'idle';
}

function stopCollab() { collabAbortController?.abort(); }

function createNewChat() {
  const next: ChatSession = {
    id: createId('session'),
    title: '新对话',
    chatType: 'direct',
    messages: [],
    updatedAt: Date.now(),
    isDraft: true,
  };
  sessions.value = [next, ...sessions.value];
  activeSessionId.value = next.id;
  draft.value = '';
  requestId.value = '';
  status.value = '已新建会话';
}

async function handleSoftDeleteSession(sessionId: string) {
  try {
    await deleteConversation(sessionId, backendBaseUrl.value);
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value[0]?.id ?? '';
    }
    if (sessions.value.length === 0) {
      createNewChat();
    }
    status.value = '会话已删除';
  } catch (error) {
    status.value = error instanceof Error ? error.message : '删除会话失败';
  }
}

function clearChat() {
  if (!activeSession.value) return;
  upsertActiveSession([{ id: createId('assistant'), role: 'assistant', content: '聊天已清空，可以继续发起新的请求。' }]);
  requestId.value = '';
  status.value = '聊天已重置';
}

/* ---------- Admin Methods ---------- */

async function loadAdminStats() {
  try {
    adminStats.value = await fetchAdminStats(backendBaseUrl.value);
  } catch (e) {
    console.error('[admin] stats error:', e);
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetchAdminUsers(adminUsersPage.value, 50, adminUsersSearch.value || undefined, backendBaseUrl.value);
    adminUsers.value = res.data;
    adminUsersTotal.value = res.total;
  } catch (e) {
    console.error('[admin] users error:', e);
  }
}

async function loadAdminBilling() {
  try {
    const filters: { userId?: string; model?: string; fromDate?: string; toDate?: string } = {};
    if (adminBillingFilterUserId.value) filters.userId = adminBillingFilterUserId.value;
    if (adminBillingFilterModel.value) filters.model = adminBillingFilterModel.value;
    if (adminBillingFromDate.value) filters.fromDate = adminBillingFromDate.value;
    if (adminBillingToDate.value) filters.toDate = adminBillingToDate.value;
    const res = await fetchAdminBilling(adminBillingPage.value, 50, filters, backendBaseUrl.value);
    adminBilling.value = res.data;
    adminBillingTotal.value = res.total;
  } catch (e) {
    console.error('[admin] billing error:', e);
  }
}

function openEditUser(user: AdminUser) {
  adminEditUserId.value = user.id;
  adminEditUserUsername.value = user.username;
  adminEditUserCredits.value = user.credits;
  adminEditUserRole.value = user.role;
  adminEditUserDialog.value = true;
}

async function saveEditUser() {
  try {
    await updateAdminUser(adminEditUserId.value, {
      credits: adminEditUserCredits.value,
      role: adminEditUserRole.value,
    }, backendBaseUrl.value);
    adminEditUserDialog.value = false;
    await loadAdminUsers();
  } catch (e: any) {
    console.error('[admin] save user error:', e);
  }
}

/* ---------- Provider API Key Admin ---------- */

async function loadAdminProviderKeys() {
  try {
    const provider = adminApiKeyProviderFilter.value || undefined;
    adminProviderKeys.value = await fetchAdminProviderKeys(provider, backendBaseUrl.value);
  } catch (e: any) {
    console.error('[admin] load provider keys error:', e);
  }
}

function openAddProviderKey() {
  adminNewKeyProvider.value = 'qwen';
  adminNewKeyName.value = '';
  adminNewKeyValue.value = '';
  adminAddKeyDialog.value = true;
}

async function saveAddProviderKey() {
  if (!adminNewKeyValue.value.trim()) return;
  try {
    await createAdminProviderKey(
      {
        provider: adminNewKeyProvider.value,
        name: adminNewKeyName.value || 'Default',
        key: adminNewKeyValue.value.trim(),
      },
      backendBaseUrl.value,
    );
    adminAddKeyDialog.value = false;
    await loadAdminProviderKeys();
  } catch (e: any) {
    console.error('[admin] add provider key error:', e);
  }
}

async function deleteProviderKey(id: string) {
  try {
    await deleteAdminProviderKey(id, backendBaseUrl.value);
    await loadAdminProviderKeys();
  } catch (e: any) {
    console.error('[admin] delete provider key error:', e);
  }
}

/* ---------- Provider Config Admin ---------- */

async function loadAdminProviderConfigs() {
  try {
    adminProviderConfigs.value = await fetchAdminProviderConfigs(backendBaseUrl.value);
  } catch (e: any) {
    console.error('[admin] load provider configs error:', e);
  }
}

function openAddConfig() {
  adminIsNewConfig.value = true;
  adminEditConfigId.value = '';
  adminEditConfigForm.value = {
    providerName: '',
    displayName: '',
    baseUrl: '',
    models: '',
    modelPrefix: '',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    timeoutMs: 25000,
    retryCount: 2,
  };
  adminEditConfigDialog.value = true;
}

function openEditConfig(row: ProviderConfigRow) {
  adminIsNewConfig.value = false;
  adminEditConfigId.value = row.id;
  adminEditConfigForm.value = {
    providerName: row.providerName,
    displayName: row.displayName,
    baseUrl: row.baseUrl,
    models: row.models,
    modelPrefix: row.modelPrefix || '',
    authHeader: row.authHeader,
    authPrefix: row.authPrefix,
    timeoutMs: row.timeoutMs,
    retryCount: row.retryCount,
  };
  adminEditConfigDialog.value = true;
}

async function saveConfig() {
  const form = adminEditConfigForm.value;
  if (!form.providerName || !form.displayName || !form.baseUrl || !form.models) return;
  try {
    if (adminIsNewConfig.value) {
      await createAdminProviderConfig(form, backendBaseUrl.value);
    } else {
      await updateAdminProviderConfig(adminEditConfigId.value, form, backendBaseUrl.value);
    }
    adminEditConfigDialog.value = false;
    await loadAdminProviderConfigs();
  } catch (e: any) {
    console.error('[admin] save config error:', e);
  }
}

async function toggleProvider(row: ProviderConfigRow) {
  try {
    await updateAdminProviderConfig(row.id, { enabled: !row.enabled }, backendBaseUrl.value);
    await loadAdminProviderConfigs();
  } catch (e: any) {
    console.error('[admin] toggle provider error:', e);
  }
}

async function deleteProviderConfig(id: string) {
  try {
    await deleteAdminProviderConfig(id, backendBaseUrl.value);
    await loadAdminProviderConfigs();
  } catch (e: any) {
    console.error('[admin] delete config error:', e);
  }
}

/* ---------- New Admin Handlers ---------- */

async function loadAdminTodayStats() {
  try {
    adminTodayStats.value = await fetchAdminTodayStats(backendBaseUrl.value);
  } catch (e) {
    console.error('[admin] today stats error:', e);
  }
}

async function loadAdminModelUsage() {
  try {
    adminModelUsage.value = await fetchAdminModelUsage(backendBaseUrl.value);
    await nextTick();
    await nextTick();
    const el = document.getElementById('admin-model-chart');
    if (el) {
      modelChartInstance?.dispose();
      modelChartInstance = renderModelUsageChart(el, adminModelUsage.value);
    }
  } catch (e) {
    console.error('[admin] model usage error:', e);
  }
}

let modelChartInstance: echarts.ECharts | null = null;

function viewUserBilling(userId: string) {
  adminBillingFilterUserId.value = userId;
  adminBillingPage.value = 1;
  adminTab.value = 'billing';
  loadAdminBilling();
}

function openResetPassword(user: AdminUser) {
  adminResetPwdUserId.value = user.id;
  adminResetPwdUsername.value = user.username;
  adminResetPwdValue.value = '';
  adminResetPwdDialog.value = true;
}

async function saveResetPassword() {
  if (adminResetPwdValue.value.length < 4) return;
  try {
    await resetAdminUserPassword(adminResetPwdUserId.value, adminResetPwdValue.value, backendBaseUrl.value);
    adminResetPwdDialog.value = false;
  } catch (e: any) {
    console.error('[admin] reset password error:', e);
  }
}

async function handleDeleteUser(userId: string) {
  try {
    await deleteAdminUser(userId, backendBaseUrl.value);
    await loadAdminUsers();
    await loadAdminStats();
  } catch (e: any) {
    console.error('[admin] delete user error:', e);
  }
}

function handleExportBillingCsv() {
  const filters: { userId?: string; model?: string; fromDate?: string; toDate?: string } = {};
  if (adminBillingFilterUserId.value) filters.userId = adminBillingFilterUserId.value;
  if (adminBillingFilterModel.value) filters.model = adminBillingFilterModel.value;
  if (adminBillingFromDate.value) filters.fromDate = adminBillingFromDate.value;
  if (adminBillingToDate.value) filters.toDate = adminBillingToDate.value;
  exportAdminBillingCsv(filters, backendBaseUrl.value);
}

function loadAdminBillingWithDates() {
  adminBillingPage.value = 1;
  loadAdminBilling();
}

async function loadAdminProviderKeyCounts() {
  try {
    const configs = await fetchAdminProviderConfigs(backendBaseUrl.value);
    const counts: Record<string, number> = {};
    for (const cfg of configs) {
      const keys = await fetchAdminProviderKeys(cfg.providerName, backendBaseUrl.value);
      counts[cfg.providerName] = keys.length;
    }
    adminProviderKeyCounts.value = counts;
  } catch (e) {
    console.error('[admin] key counts error:', e);
  }
}

async function loadAdminSettings() {
  try {
    adminSettings.value = await fetchAdminSettings(backendBaseUrl.value);
  } catch (e) {
    console.error('[admin] settings error:', e);
  }
}

/* ── Model Tier Management ── */

async function loadAdminModelTiers() {
  try {
    adminModelTiers.value = await fetchAdminModelTiers(backendBaseUrl.value);
  } catch (e) {
    console.error('[admin] model tiers error:', e);
  }
}

function openEditTier(tierKey?: string) {
  if (tierKey) {
    adminTierEditKey.value = tierKey;
    adminTierEditLabel.value = adminModelTiers.value.labels[tierKey] || '';
    const price = adminModelTiers.value.prices[tierKey] || { prompt: 0, completion: 0, description: '' };
    adminTierEditPromptPrice.value = price.prompt;
    adminTierEditCompletionPrice.value = price.completion;
    adminTierEditDesc.value = price.description;
    adminTierEditIsNew.value = false;
  } else {
    adminTierEditKey.value = '';
    adminTierEditLabel.value = '';
    adminTierEditPromptPrice.value = 0;
    adminTierEditCompletionPrice.value = 0;
    adminTierEditDesc.value = '';
    adminTierEditIsNew.value = true;
  }
  adminTierEditDialog.value = true;
}

async function saveTierEdit() {
  try {
    const key = adminTierEditKey.value.trim();
    if (!key) return;

    const newTiers = { ...adminModelTiers.value.tiers };
    if (adminTierEditIsNew.value) {
      newTiers[key] = [];
    }

    const newLabels = { ...adminModelTiers.value.labels };
    newLabels[key] = adminTierEditLabel.value.trim() || key;

    const newPrices = {
      ...adminModelTiers.value.prices,
      [key]: {
        prompt: adminTierEditPromptPrice.value,
        completion: adminTierEditCompletionPrice.value,
        description: adminTierEditDesc.value || `【${key}】`,
      },
    };

    await updateAdminModelTiers({ tiers: newTiers, prices: newPrices, labels: newLabels }, backendBaseUrl.value);
    adminTierEditDialog.value = false;
    await loadAdminModelTiers();
  } catch (e) {
    console.error('[admin] save tier error:', e);
  }
}

async function deleteAdminTier(tierKey: string) {
  try {
    const newTiers = { ...adminModelTiers.value.tiers };
    delete newTiers[tierKey];
    const newPrices = { ...adminModelTiers.value.prices };
    delete newPrices[tierKey];
    await updateAdminModelTiers({ tiers: newTiers, prices: newPrices }, backendBaseUrl.value);
    await loadAdminModelTiers();
  } catch (e) {
    console.error('[admin] delete tier error:', e);
  }
}

// ── Model → Tier Mapping ──

const modelTierSearch = ref('');
const modelTierTagFilter = ref('');

// modelId → tierKey lookup
const modelTierMap = computed(() => {
  const map = new Map<string, string>();
  for (const [tierKey, modelIds] of Object.entries(adminModelTiers.value.tiers)) {
    for (const m of modelIds) map.set(m, tierKey);
  }
  return map;
});

interface ModelTierRow { modelId: string; tierKey: string; promptPrice: number; completionPrice: number }

const allModelTierRows = computed<ModelTierRow[]>(() => {
  return models.value.map((m) => {
    const tierKey = modelTierMap.value.get(m.id) || '';
    const price = adminModelTiers.value.prices[tierKey];
    return {
      modelId: m.id,
      tierKey,
      promptPrice: Number(price?.prompt ?? defaultPricePrompt.value),
      completionPrice: Number(price?.completion ?? defaultPriceCompletion.value),
    };
  });
});

const filteredModelTierRows = computed(() => {
  let rows = allModelTierRows.value;
  if (modelTierTagFilter.value) {
    rows = rows.filter((r) => getModelTags(r.modelId).includes(modelTierTagFilter.value));
  }
  if (modelTierSearch.value) {
    const q = modelTierSearch.value.toLowerCase();
    rows = rows.filter((r) => r.modelId.toLowerCase().includes(q));
  }
  return rows;
});

const unassignedCount = computed(() => allModelTierRows.value.filter((r) => !r.tierKey).length);

async function changeModelTier(modelId: string, newTierKey: string) {
  if (!newTierKey) {
    const currentTier = modelTierMap.value.get(modelId);
    if (currentTier) {
      await removeModelFromTier(currentTier, modelId, backendBaseUrl.value);
    }
  } else {
    await addModelsToTier(newTierKey, [modelId], backendBaseUrl.value);
  }
  await loadAdminModelTiers();
}

// Tier rows for pricing config bar
interface TierRow { key: string; label: string; models: string[]; promptPrice: number; completionPrice: number }

const tierDefaultLabels: Record<string, string> = {
  tier_budget: '入门',
  tier_mainstream: '主流',
  tier_flagship: '旗舰',
  tier_super_flagship: '超旗舰',
  tier_vision: '视觉',
};

const tierRows = computed<TierRow[]>(() => {
  const labels = adminModelTiers.value.labels || {};
  return Object.entries(adminModelTiers.value.tiers).map(([key, models]) => ({
    key,
    label: labels[key] || tierDefaultLabels[key] || key.replace('tier_', ''),
    models,
    promptPrice: Number(adminModelTiers.value.prices[key]?.prompt ?? 0),
    completionPrice: Number(adminModelTiers.value.prices[key]?.completion ?? 0),
  }));
});

function tierTagType(key: string): string {
  if (key.includes('flagship')) return 'danger';
  if (key.includes('mainstream')) return 'warning';
  if (key.includes('budget')) return 'info';
  if (key.includes('vision')) return 'success';
  return 'info';
}

const defaultPricePrompt = computed(() => {
  const rule = billingRules.value.find((r) => r.key === 'default_prompt_price_per_1k');
  return rule ? Number(rule.value) : 0;
});
const defaultPriceCompletion = computed(() => {
  const rule = billingRules.value.find((r) => r.key === 'default_completion_price_per_1k');
  return rule ? Number(rule.value) : 0;
});

const adminDefaultPromptPrice = ref(0);
const adminDefaultCompletionPrice = ref(0);

function initDefaultPriceFields() {
  adminDefaultPromptPrice.value = defaultPricePrompt.value;
  adminDefaultCompletionPrice.value = defaultPriceCompletion.value;
}

async function saveDefaultPrices() {
  try {
    await updateAdminBillingRule('default_prompt_price_per_1k', adminDefaultPromptPrice.value, '默认输入价格（元/千token）', backendBaseUrl.value);
    await updateAdminBillingRule('default_completion_price_per_1k', adminDefaultCompletionPrice.value, '默认输出价格（元/千token）', backendBaseUrl.value);
    await refreshBillingData();
    status.value = '默认价格已保存';
  } catch (e: any) {
    status.value = '保存失败：' + (e?.message || e);
  }
}

const consolePricingRows = computed(() => {
  const tierMap = new Map<string, { prompt: number; completion: number }>();
  for (const r of billingRules.value) {
    const m = r.key.match(/^tier_(.+)_(prompt|completion)$/);
    if (m) {
      const [, tierName, priceType] = m;
      if (!tierMap.has(tierName)) tierMap.set(tierName, { prompt: 0, completion: 0 });
      const entry = tierMap.get(tierName)!;
      if (priceType === 'prompt') entry.prompt = Number(r.value);
      else entry.completion = Number(r.value);
    }
  }

  const defaultLabelMap: Record<string, { label: string; tagType: string }> = {
    budget: { label: '入门', tagType: 'info' },
    mainstream: { label: '主流', tagType: 'warning' },
    flagship: { label: '旗舰', tagType: 'danger' },
    super_flagship: { label: '超旗舰', tagType: 'danger' },
    ultra: { label: '至尊', tagType: 'info' },
    vision: { label: '视觉', tagType: 'success' },
    audio: { label: '音频', tagType: 'success' },
  };

  // Prefer DB labels over hardcoded
  let dbLabels: Record<string, string> = {};
  let tierModels: Record<string, string[]> = {};
  try {
    const raw = pageModelsConfig.value['tier_labels'];
    if (raw) dbLabels = JSON.parse(raw);
    const rawMapping = pageModelsConfig.value['model_tier_mapping'];
    if (rawMapping) tierModels = JSON.parse(rawMapping);
  } catch {}

  return Array.from(tierMap.entries()).map(([name, prices]) => {
    const label = dbLabels[`tier_${name}`] || defaultLabelMap[name]?.label || name;
    const tagType = defaultLabelMap[name]?.tagType || 'info';
    const models = tierModels[`tier_${name}`] || tierModels[name] || [];
    return { key: name, label, tagType, promptPrice: prices.prompt, completionPrice: prices.completion, sampleModels: models.join(', ') };
  }).sort((a, b) => a.label.localeCompare(b.label, 'zh'));
});

function openEditSetting(setting: SystemSetting) {
  // model_tier_mapping has its own dedicated management page
  if (setting.key === 'model_tier_mapping') {
    adminTab.value = 'modeltiers';
    loadAdminModelTiers();
    if (models.value.length === 0) loadModels();
    return;
  }
  adminEditSettingKey.value = setting.key;
  adminEditSettingValue.value = setting.value;
  adminEditSettingDesc.value = setting.description;
  adminEditSettingTextMode.value = false;
  // For page_models_* settings, parse into array for multi-select
  if (setting.key.startsWith('page_models_')) {
    const val = setting.value.trim();
    adminEditSettingModels.value = val === '*' ? [] : val.split(',').map((s) => s.trim()).filter(Boolean);
    adminEditSettingTagFilter.value = '';
    // Ensure models are loaded
    if (models.value.length === 0) loadModels();
  } else {
    adminEditSettingModels.value = [];
  }
  // For model_tags, parse JSON into editable map
  if (setting.key === 'model_tags') {
    try { adminEditModelTags.value = JSON.parse(setting.value); } catch { adminEditModelTags.value = {}; }
  } else {
    adminEditModelTags.value = {};
  }
  adminEditSettingDialog.value = true;
}

function toggleModelTag(modelId: string, tag: string, checked: boolean) {
  const current = adminEditModelTags.value[modelId] || [];
  if (checked) {
    adminEditModelTags.value = { ...adminEditModelTags.value, [modelId]: [...current, tag] };
  } else {
    adminEditModelTags.value = { ...adminEditModelTags.value, [modelId]: current.filter((t) => t !== tag) };
  }
}

function toggleSettingTextMode() {
  if (adminEditSettingTextMode.value) {
    // Switching FROM text TO multi-select: parse textarea into models array
    const raw = adminEditSettingValue.value.trim();
    adminEditSettingModels.value = raw === '*' ? [] : raw.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    // Switching FROM multi-select TO text: join models into textarea
    adminEditSettingValue.value = adminEditSettingModels.value.length > 0
      ? adminEditSettingModels.value.join(',')
      : '*';
  }
  adminEditSettingTextMode.value = !adminEditSettingTextMode.value;
}

async function saveEditSetting() {
  try {
    let value = adminEditSettingValue.value;
    // For page_models_* settings, handle both modes
    if (adminEditSettingKey.value.startsWith('page_models_')) {
      if (adminEditSettingTextMode.value) {
        // Text mode: use textarea value directly
        value = adminEditSettingValue.value.trim() || '*';
      } else {
        // Multi-select mode: join array
        value = adminEditSettingModels.value.length > 0
          ? adminEditSettingModels.value.join(',')
          : '*';
      }
    }
    // For model_tags, convert map to JSON
    if (adminEditSettingKey.value === 'model_tags') {
      value = JSON.stringify(adminEditModelTags.value);
    }
    await updateAdminSetting(adminEditSettingKey.value, value, backendBaseUrl.value);
    adminEditSettingDialog.value = false;
    await loadAdminSettings();
    // Reload page models config for frontend
    pageModelsConfig.value = await fetchPageModels(backendBaseUrl.value);
  } catch (e) {
    console.error('[admin] save setting error:', e);
  }
}

/* ---------- Router Rules Admin ---------- */

const adminRouterRules = ref<Array<{ intent: string; models: string[] }>>([]);
const adminRouterEditDialog = ref(false);
const adminRouterEditIntent = ref('');
const adminRouterEditModels = ref('');

async function loadAdminRouterRules() {
  try {
    const token = getStoredToken();
    const res = await fetch(`${backendBaseUrl.value}/router/admin/rules`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      adminRouterRules.value = data.data ?? [];
    }
  } catch (e) { console.error('[admin] router rules error:', e); }
}

function openAdminRouterEdit(intent?: string, models?: string[]) {
  adminRouterEditIntent.value = intent || '';
  adminRouterEditModels.value = models ? models.join(', ') : '';
  adminRouterEditDialog.value = true;
}

async function saveAdminRouterRule() {
  const intent = adminRouterEditIntent.value.trim();
  const models = adminRouterEditModels.value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!intent || models.length === 0) return;
  try {
    const token = getStoredToken();
    await fetch(`${backendBaseUrl.value}/router/admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ intent, models }),
      credentials: 'include',
    });
    adminRouterEditDialog.value = false;
    await loadAdminRouterRules();
  } catch (e) { console.error('[admin] save router rule error:', e); }
}

async function deleteAdminRouterRule(intent: string) {
  try {
    const token = getStoredToken();
    await fetch(`${backendBaseUrl.value}/router/admin/rules/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ intent }),
      credentials: 'include',
    });
    await loadAdminRouterRules();
  } catch (e) { console.error('[admin] delete router rule error:', e); }
}

/* ---------- Chart Helpers ---------- */

function renderLineChart(container: HTMLElement, data: DailyUsage[]): echarts.ECharts {
  const instance = echarts.init(container, document.documentElement.classList.contains('dark') ? 'dark' : undefined);
  // Robust date parsing: handles "2026-04-16", "2026-04-16T...", "2026-04-16 ...", etc.
  const dates = data.map((d) => {
    const m = d.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}-${m[3]}` : d.date;
  });
  const costs = data.map((d) => Number(d.cost.toFixed(4)));
  const requests = data.map((d) => d.requests);
  const tokens = data.map((d) => d.tokens);

  const darkColor = document.documentElement.classList.contains('dark');
  const labelColor = darkColor ? '#94a3b8' : '#6b7280';
  const gridColor = darkColor ? '#334155' : '#f1f5f9';
  const axisColor = darkColor ? '#475569' : '#d1d5db';

  instance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        const date = items[0]?.axisValue || '';
        const lines = items.map((p: any) => {
          let val = p.value;
          if (p.seriesName === '费用 (元)') val = Number(val).toFixed(4);
          else if (p.seriesName === 'Token 数') val = Number(val).toLocaleString();
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: ${val}`;
        });
        return `<div style="font-weight:600;margin-bottom:4px">${date}</div>${lines.join('<br>')}`;
      },
    },
    legend: { data: ['费用 (元)', '请求数', 'Token 数'], bottom: 0, textStyle: { color: labelColor } },
    grid: { left: 48, right: 48, top: 40, bottom: 40, containLabel: false },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 11, rotate: 0 },
    },
    yAxis: [
      {
        type: 'value',
        name: '元',
        nameTextStyle: { color: labelColor },
        axisLabel: { color: labelColor, fontSize: 11 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      {
        type: 'value',
        name: '次 / Token',
        nameTextStyle: { color: labelColor },
        axisLabel: { color: labelColor, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '费用 (元)',
        type: 'bar',
        data: costs,
        itemStyle: { color: '#6366f1', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: '请求数',
        type: 'line',
        yAxisIndex: 1,
        data: requests,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: 'Token 数',
        type: 'line',
        yAxisIndex: 1,
        data: tokens,
        lineStyle: { color: '#10b981', width: 2, type: 'dashed' },
        itemStyle: { color: '#10b981' },
        symbol: 'diamond',
        symbolSize: 4,
      },
    ],
  });

  return instance;
}

function renderModelUsageChart(container: HTMLElement, data: ModelUsageStat[]): echarts.ECharts {
  const instance = echarts.init(container, document.documentElement.classList.contains('dark') ? 'dark' : undefined);
  const top10 = data.slice(0, 10).reverse();

  const darkColor = document.documentElement.classList.contains('dark');
  const labelColor = darkColor ? '#94a3b8' : '#6b7280';
  const axisColor = darkColor ? '#475569' : '#d1d5db';

  instance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        const lines = items.map((p: any) => {
          const val = p.seriesName === '总费用 (元)' ? '¥' + Number(p.value).toFixed(6) : Number(p.value).toLocaleString();
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: ${val}`;
        });
        return `<div style="font-weight:600;margin-bottom:4px">${items[0]?.name || ''}</div>${lines.join('<br>')}`;
      },
    },
    legend: { data: ['请求数', '总费用 (元)'], bottom: 0, textStyle: { color: labelColor } },
    grid: { left: 120, right: 48, top: 40, bottom: 40, containLabel: false },
    yAxis: {
      type: 'category',
      data: top10.map((r) => r.model),
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 11 },
    },
    xAxis: [
      {
        type: 'value',
        name: '请求数',
        nameTextStyle: { color: labelColor },
        axisLabel: { color: labelColor, fontSize: 11 },
        splitLine: { show: false },
      },
      {
        type: 'value',
        name: '元',
        nameTextStyle: { color: labelColor },
        axisLabel: { color: labelColor, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '请求数',
        type: 'bar',
        data: top10.map((r) => r.requests),
        itemStyle: { color: '#6366f1', borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 16,
      },
      {
        name: '总费用 (元)',
        type: 'bar',
        xAxisIndex: 1,
        data: top10.map((r) => Number(r.totalCost.toFixed(6))),
        itemStyle: { color: '#f59e0b', borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 16,
      },
    ],
  });

  return instance;
}

async function loadAdminDailyUsage() {
  try {
    adminDailyUsage.value = await fetchAdminDailyUsage(adminChartDays.value, backendBaseUrl.value);
    await nextTick();
    await nextTick(); // ensure v-if creates the DOM element
    const el = document.getElementById('admin-chart');
    if (el) {
      adminChartInstance?.dispose();
      adminChartInstance = renderLineChart(el, adminDailyUsage.value);
    }
  } catch (e) {
    console.error('[admin] daily usage error:', e);
  }
}

async function loadConsoleDailyUsage() {
  try {
    consoleDailyUsage.value = await fetchDailyUsage(consoleChartDays.value, backendBaseUrl.value);
    await nextTick();
    await nextTick();
    // Delay to ensure v-if renders the chart container
    await new Promise(r => setTimeout(r, 100));
    const el = document.getElementById('console-chart');
    if (el) {
      consoleChartInstance?.dispose();
      consoleChartInstance = renderLineChart(el, consoleDailyUsage.value);
    }
  } catch (e) {
    console.error('[console] daily usage error:', e);
  }
}

function disposeCharts() {
  adminChartInstance?.dispose();
  adminChartInstance = null;
  consoleChartInstance?.dispose();
  consoleChartInstance = null;
  modelChartInstance?.dispose();
  modelChartInstance = null;
}

// Handle dark mode changes for charts
const darkMediaQuery2 = window.matchMedia('(prefers-color-scheme: dark)');
function onDarkChange() {
  if (adminChartInstance) {
    const el = document.getElementById('admin-chart');
    if (el) { adminChartInstance.dispose(); adminChartInstance = renderLineChart(el, adminDailyUsage.value); }
  }
  if (consoleChartInstance) {
    const el = document.getElementById('console-chart');
    if (el) { consoleChartInstance.dispose(); consoleChartInstance = renderLineChart(el, consoleDailyUsage.value); }
  }
}
darkMediaQuery2.addEventListener('change', onDarkChange);

function switchPage(mode: PageMode) {
  pageMode.value = mode;
  if (mode === 'agent') window.location.hash = '/agent';
    else if (mode === 'battle') window.location.hash = '/battle';
    else if (mode === 'group') window.location.hash = '/group';
    else if (mode === 'console') window.location.hash = '/console';
    else if (mode === 'api') window.location.hash = '/api';
    else if (mode === 'admin') window.location.hash = '/admin';
    else if (mode === 'vision') window.location.hash = '/vision';
    else if (mode === 'tts') window.location.hash = '/tts';
    else if (mode === 'multimodal') window.location.hash = '/multimodal';
    else if (mode === 'router') window.location.hash = '/router';
    else if (mode === 'collab') window.location.hash = '/collab';
    else if (mode === 'docs') window.location.hash = '/docs';
    else window.location.hash = '/chat';
}

async function startBattle() {
  if (isComposing.value) return;
  const prompt = battlePrompt.value.trim();
  if (!prompt || isBattling.value) return;

  battlePrompt.value = '';

  let left: string, right: string;
  if (battleLeftModel.value && battleRightModel.value) {
    left = battleLeftModel.value;
    right = battleRightModel.value;
  } else {
    const selected = pickTwoRandomModels(models.value);
    if (!selected) { battleStatus.value = '可用模型不足 2 个'; return; }
    [left, right] = selected;
  }
  isBattling.value = true;
  battleStatus.value = '对战进行中';
  battlePanels.value = [
    { model: left, content: '', reasoning: '', requestId: '', status: '生成中' },
    { model: right, content: '', reasoning: '', requestId: '', status: '生成中' },
  ];

  battleAbortController = new AbortController();
  const sig = battleAbortController.signal;

  async function runOne(index: 0 | 1, model: string) {
    let content = '', reasoning = '';
    await streamCompletion(
      { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, extra_body: { enable_thinking: true } },
      {
        onRequestId: (rid) => {
          const p = [...battlePanels.value]; p[index] = { ...p[index], requestId: rid }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
        },
        onChunk: (chunk) => {
          const d = chunk.choices?.[0]?.delta;
          if (d?.content) content += d.content;
          if (d?.reasoning_content) reasoning += d.reasoning_content;
          const p = [...battlePanels.value]; p[index] = { ...p[index], content, reasoning, status: '生成中' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
        },
        onDone: () => {
          const p = [...battlePanels.value]; p[index] = { ...p[index], content: content || '(空响应)', reasoning, status: '完成' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
        },
        onAbort: () => {
          const p = [...battlePanels.value]; p[index] = { ...p[index], content: content || '(已停止)', reasoning, status: '已停止' }; battlePanels.value = p as [BattlePanelState, BattlePanelState];
        },
      },
      backendBaseUrl.value,
      sig,
    );
  }

  try {
    await Promise.all([runOne(0, left), runOne(1, right)]);
    battleStatus.value = '对战完成';
    const battleSession: ChatSession = {
      id: createId('battle'),
      title: prompt.slice(0, 40),
      chatType: 'battle',
      messages: [
        { id: createId('user'), role: 'user', content: prompt },
        { id: createId('assistant'), role: 'assistant', content: battlePanels.value[0].content, model: left },
        { id: createId('assistant'), role: 'assistant', content: battlePanels.value[1].content, model: right },
      ],
      updatedAt: Date.now(),
    };
    sessions.value = [battleSession, ...sessions.value];
  } catch (error) {
    battleStatus.value = error instanceof Error ? error.message : '对战失败';
    const p = [...battlePanels.value];
    p[0] = { ...p[0], status: '失败' };
    p[1] = { ...p[1], status: '失败' };
    battlePanels.value = p as [BattlePanelState, BattlePanelState];
  } finally {
    isBattling.value = false;
    battleAbortController = null;
  }
}

function stopBattle() { battleAbortController?.abort(); }

async function startGroupChat() {
  if (isComposing.value) return;
  const prompt = groupPrompt.value.trim();
  if (!prompt || isGrouping.value || models.value.length === 0) return;

  groupPrompt.value = '';
  isGrouping.value = true;
  groupAbortController = new AbortController();
  const sig = groupAbortController.signal;

  const userId = createId('group-user');
  groupMessages.value.push({ id: userId, role: 'user', content: prompt });

  const filtered = groupModelList.value;
  if (filtered.length === 0) {
    status.value = '群组没有可参与的模型，请检查页面配置';
    isGrouping.value = false;
    return;
  }

  for (const model of shuffleArray(filtered)) {
    if (sig.aborted) break;

    const discussionMessages = groupMessages.value.filter((m) => m.content.trim().length > 0);

    const aid = createId('group-assistant');
    groupMessages.value.push({ id: aid, role: 'assistant', model: model.id, content: '', status: 'streaming' });

    let content = '';
    try {
      await streamCompletion(
        {
          model: model.id,
          messages: [
            { role: 'system', content: `你正在一个AI群组讨论中回答用户的问题。群组中还有其他AI模型。请参考其他AI的发言来完善你的回答。你的名字是「${model.id}」。直接回复内容即可，不要在回复开头加上自己的名字或任何前缀。` },
            ...discussionMessages.map((m) =>
              m.role === 'user'
                ? ({ role: 'user' as const, content: m.content })
                : ({ role: 'assistant' as const, content: m.content }),
            ),
          ],
          temperature: 0.7,
        },
        {
          onChunk: (chunk) => {
            const t = chunk.choices?.[0]?.delta?.content;
            if (t) { content += t; groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content, status: 'streaming' as const } : m); }
          },
          onDone: () => { groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: content || '(空响应)', status: 'done' as const } : m); },
          onAbort: () => { groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: content || '(已停止)', status: 'done' as const } : m); },
        },
        backendBaseUrl.value,
        sig,
      );
    } catch {
      groupMessages.value = groupMessages.value.map((m) => m.id === aid ? { ...m, content: '请求失败', status: 'error' as const } : m);
    }
  }

  isGrouping.value = false;
  groupAbortController = null;

  if (groupMessages.value.length > 0) {
    const groupSession: ChatSession = {
      id: createId('group'),
      title: groupMessages.value[0]?.content.slice(0, 40) || '群组讨论',
      chatType: 'group',
      messages: groupMessages.value.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
      })),
      updatedAt: Date.now(),
    };
    sessions.value = [groupSession, ...sessions.value];
  }
}

function clearGroupChat() { groupMessages.value = []; }
function stopGroupChat() { groupAbortController?.abort(); }

/* ---------- Vision Page ---------- */
const visionPrompt = ref('');
const visionImageBase64 = ref('');
const visionImageName = ref('');
const visionModel = ref('');
const visionMessages = ref<Array<{ id: string; role: 'user' | 'assistant'; content: string; image?: string }>>([]);
const isVisionSubmitting = ref(false);
const visionFileRef = ref<HTMLInputElement | null>(null);
let visionAbortController: AbortController | null = null;

// Model tags: parsed from model_tags setting
const modelTagsMap = computed<Record<string, string[]>>(() => {
  const raw = pageModelsConfig.value['model_tags'];
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
});

function getModelTags(modelId: string): string[] {
  return modelTagsMap.value[modelId] || [];
}

const chatModels = computed(() => getPageModels('page_models_chat'));
const battleModels = computed(() => getPageModels('page_models_battle'));
const groupModelList = computed(() => {
  const filtered = getPageModels('page_models_group');
  if (filtered.length > 0) return filtered;
  // Fallback: models tagged as 'language'
  return models.value.filter((m) => getModelTags(m.id).includes('language'));
});

function getPageModels(settingKey: string): ModelDescriptor[] {
  const config = pageModelsConfig.value[settingKey];
  if (!config || config === '*') return models.value;
  const allowed = config.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return models.value;
  return models.value.filter((m) => allowed.includes(m.id));
}

// Vision-capable models: from page_models_vision setting, fallback to tags
const visionModels = computed(() => {
  const config = pageModelsConfig.value['page_models_vision'];
  if (config && config !== '*') {
    const allowed = config.split(',').map((s) => s.trim()).filter(Boolean);
    return models.value.filter((m) => allowed.includes(m.id));
  }
  return models.value.filter((m) => getModelTags(m.id).includes('vision'));
});

/* ---------- TTS Page ---------- */
const ttsText = ref('');
const ttsVoice = ref('冰糖');
const ttsStyleTag = ref('');
const ttsStyleInstruction = ref('');
const ttsSingingMode = ref(false);
const ttsModeSegment = ref('read');
const ttsAudioUrl = ref('');
const ttsAudioLoading = ref(false);
const ttsError = ref('');
const ttsAudioRef = ref<HTMLAudioElement | null>(null);
const ttsHistory = ref<Array<{ text: string; voice: string; style: string; url: string }>>([]);
const ttsModel = ref('mimo-v2.5-tts');
const ttsModels = computed(() => {
  const config = pageModelsConfig.value['page_models_tts'];
  if (config && config !== '*') {
    const allowed = config.split(',').map((s) => s.trim()).filter(Boolean);
    return models.value.filter((m) => allowed.includes(m.id));
  }
  return models.value.filter((m) => getModelTags(m.id).includes('audio'));
});

/* ---------- Multimodal Page State ---------- */
const multimodalTab = ref<'video' | 'driving' | 'retrieval' | 'chat'>('driving');

// Video understanding
const videoFile = ref<File | null>(null);
const videoUrl = ref('');
const videoAnalysis = ref<Array<{ time: number; label: string; confidence: number; bbox?: number[] }>>([]);
const videoAnalysisRunning = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);

// Autonomous driving simulation
const drivingCanvasRef = ref<HTMLCanvasElement | null>(null);
const drivingRunning = ref(false);
const drivingSpeed = ref(60);
const drivingSteering = ref(0);
const drivingAutoPilot = ref(true);
const drivingStats = ref({ fps: 0, objects: 0, laneDev: 0, distance: 0 });
let drivingAnimationId = 0;
let drivingLastTime = 0;
let drivingRoadOffset = 0;
interface DrivingObject { x: number; y: number; w: number; h: number; speed: number; color: string; type: string; lane: number; changingLane: boolean }
let drivingVehicles: DrivingObject[] = [];
let drivingEgoX = 0;

// Image-text retrieval
const retrievalQuery = ref('');
const retrievalResults = ref<Array<{ id: number; url: string; title: string; sim: number }>>([]);
const retrievalLoading = ref(false);

// Multimodal chat
const mmChatMessages = ref<Array<{ id: string; role: 'user' | 'assistant'; content: string; image?: string; audio?: string; video?: string; mediaType?: string; mediaName?: string }>>([]);
const mmChatPrompt = ref('');
const mmChatImageBase64 = ref('');
const mmChatImageName = ref('');
const mmChatImages = ref<Array<{ base64: string; name: string }>>([]);
const mmChatAudioBase64 = ref('');
const mmChatAudioName = ref('');
const mmChatVideoUrl = ref('');
const mmChatVideoName = ref('');
const mmChatMediaType = ref<'image' | 'audio' | 'video' | ''>('');
const mmChatFileRef = ref<HTMLInputElement | null>(null);
const mmChatAudioRef = ref<HTMLInputElement | null>(null);
const mmChatVideoRef = ref<HTMLInputElement | null>(null);
const isMmChatSubmitting = ref(false);
let mmChatAbortController: AbortController | null = null;

// Driving AI analysis
const drivingAiAnalyzing = ref(false);
const drivingAiAnalysis = ref('');
let drivingAiAbortController: AbortController | null = null;
const drivingAiCommand = ref<{ action: string; speed: string; until: number } | null>(null);
const drivingAiIntervalSec = ref(3);
let drivingAiIntervalId: ReturnType<typeof setInterval> | null = null;
const multimodalModel = ref('');

watch(multimodalModel, () => { persistMmModel(); });
watch(ttsModel, () => { persistTtsModel(); });
watch(visionModel, () => { persistVisionModel(); });
watch(drivingAiIntervalSec, () => {
  if (drivingRunning.value && drivingAiIntervalId) {
    clearInterval(drivingAiIntervalId);
    drivingAiIntervalId = setInterval(() => {
      if (drivingRunning.value && isAuthenticated.value) analyzeDrivingScene();
    }, drivingAiIntervalSec.value * 1000);
  }
});

/* ---------- Vision Page Handlers ---------- */

function handleVisionImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { status.value = '请选择图片文件'; return; }
  if (file.size > 10 * 1024 * 1024) { status.value = '图片大小不能超过 10MB'; return; }

  visionImageName.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    visionImageBase64.value = (e.target?.result as string) || '';
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeVisionImage() {
  visionImageBase64.value = '';
  visionImageName.value = '';
}

function openImageInNewTab(url?: string) {
  if (url) window.open(url);
}

async function submitVisionPrompt() {
  if (isComposing.value) return;
  const content = visionPrompt.value.trim();
  if (!content || isVisionSubmitting.value) return;
  if (!visionImageBase64.value) { status.value = '请先上传图片'; return; }

  const userMsg = {
    id: createId('vision-user'),
    role: 'user' as const,
    content,
    image: visionImageBase64.value,
  };
  visionMessages.value.push(userMsg);

  const assistantId = createId('vision-assistant');
  visionMessages.value.push({ id: assistantId, role: 'assistant', content: '' });

  visionPrompt.value = '';
  removeVisionImage();
  isVisionSubmitting.value = true;
  visionAbortController = new AbortController();

  let streamed = '';

  try {
    const visionMsgs = visionMessages.value
      .filter((m) => m.id !== assistantId)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.image
          ? [
              { type: 'image_url', image_url: { url: m.image } },
              { type: 'text', text: m.content },
            ]
          : m.content,
      })) as any[];

    await streamCompletion(
      {
        model: visionModel.value,
        messages: visionMsgs,
        temperature: 0.7,
      },
      {
        onChunk: (chunk) => {
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) {
            streamed += token;
            visionMessages.value = visionMessages.value.map((m) =>
              m.id === assistantId ? { ...m, content: streamed } : m,
            );
          }
        },
        onDone: () => { status.value = '视觉模型回复完成'; },
        onAbort: () => { status.value = '已停止'; },
      },
      backendBaseUrl.value,
      visionAbortController.signal,
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '请求失败';
    visionMessages.value = visionMessages.value.map((m) =>
      m.id === assistantId ? { ...m, content: `错误：${errMsg}` } : m,
    );
  } finally {
    isVisionSubmitting.value = false;
    visionAbortController = null;
  }
}

function clearVisionChat() {
  visionMessages.value = [];
  visionImageBase64.value = '';
  visionImageName.value = '';
}

function stopVisionChat() { visionAbortController?.abort(); }

/* ---------- TTS Page Handlers ---------- */

const TTS_STYLE_TAGS = [
  { label: '开心', value: '开心' },
  { label: '悲伤', value: '悲伤' },
  { label: '愤怒', value: '愤怒' },
  { label: '温柔', value: '温柔' },
  { label: '冷淡', value: '冷淡' },
  { label: '活泼', value: '活泼' },
  { label: '严肃', value: '严肃' },
  { label: '慵懒', value: '慵懒' },
  { label: '磁性', value: '磁性' },
  { label: '甜美', value: '甜美' },
  { label: '沙哑', value: '沙哑' },
  { label: '东北话', value: '东北话' },
  { label: '四川话', value: '四川话' },
  { label: '粤语', value: '粤语' },
  { label: '唱歌', value: '唱歌' },
];

const TTS_AUDIO_TAGS = [
  { label: '叹气', value: '叹气' },
  { label: '深呼吸', value: '深呼吸' },
  { label: '笑', value: '笑' },
  { label: '哭', value: '哭' },
  { label: '紧张', value: '紧张' },
  { label: '颤抖', value: '颤抖' },
  { label: '耳语', value: '耳语' },
];

const TTS_VOICES = [
  { label: '冰糖 (女)', value: '冰糖' },
  { label: '茉莉 (女)', value: '茉莉' },
  { label: '苏打 (男)', value: '苏打' },
  { label: '白桦 (男)', value: '白桦' },
  { label: 'Mia (女/EN)', value: 'Mia' },
  { label: 'Chloe (女/EN)', value: 'Chloe' },
  { label: 'Milo (男/EN)', value: 'Milo' },
  { label: 'Dean (男/EN)', value: 'Dean' },
];

function insertTtsTag(tag: string) {
  ttsText.value = ttsText.value + `[${tag}]`;
}

function onTtsModeChange(val: string | number) {
  ttsSingingMode.value = val === 'sing';
  if (ttsSingingMode.value) ttsStyleTag.value = '';
}

async function generateTts() {
  const text = ttsText.value.trim();
  if (!text) { ttsError.value = '请输入要合成的文本'; return; }

  ttsAudioLoading.value = true;
  ttsError.value = '';
  ttsAudioUrl.value = '';

  // Build assistant content with style tags
  let assistantContent = text;
  if (ttsSingingMode.value) {
    assistantContent = `(唱歌)${text}`;
  } else if (ttsStyleTag.value) {
    assistantContent = `(${ttsStyleTag.value})${text}`;
  }

  // Build messages
  const messages: Array<{ role: string; content: string }> = [];
  if (ttsStyleInstruction.value.trim()) {
    messages.push({ role: 'user', content: ttsStyleInstruction.value.trim() });
  }
  messages.push({ role: 'assistant', content: assistantContent });

  try {
    const token = getStoredToken();
    const response = await fetch(`${backendBaseUrl.value}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: ttsModel.value,
        messages,
        audio: { format: 'wav', voice: ttsVoice.value },
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `TTS 请求失败 (${response.status})`);
    }

    const data = await response.json() as { audio: string };
    if (data.audio) {
      const audioBytes = atob(data.audio);
      const array = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) array[i] = audioBytes.charCodeAt(i);
      const blob = new Blob([array], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      ttsAudioUrl.value = url;
      // Add to history (newest first, max 10)
      ttsHistory.value.unshift({
        text: ttsText.value.slice(0, 60) + (ttsText.value.length > 60 ? '...' : ''),
        voice: ttsVoice.value,
        style: ttsSingingMode.value ? '唱歌' : ttsStyleTag.value,
        url,
      });
      if (ttsHistory.value.length > 10) ttsHistory.value.pop();
    }
  } catch (error) {
    ttsError.value = error instanceof Error ? error.message : 'TTS 生成失败';
  } finally {
    ttsAudioLoading.value = false;
  }
}

/* ---------- Autonomous Driving Simulation ---------- */

function initDrivingSim() {
  drivingVehicles = [];
  drivingRoadOffset = 0;
  drivingEgoX = 0;
  drivingLastTime = 0;
  drivingStats.value = { fps: 0, objects: 0, laneDev: 0, distance: 0 };
}

const LANE_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];
const VEHICLE_TYPES = ['car', 'truck', 'motorcycle'];

function getLaneCenter(laneIdx: number, W: number): number {
  const laneW = W / 3;
  return laneIdx * laneW + laneW / 2;
}

function spawnVehicle(canvasW: number, egoCX: number, egoLane: number) {
  const laneW = canvasW / 3;
  // Prefer lanes away from ego
  const laneWeights = [0, 1, 2].map(l => l === egoLane ? 1 : 3);
  const totalW = laneWeights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalW;
  let lane = 0;
  for (let i = 0; i < 3; i++) { r -= laneWeights[i]; if (r <= 0) { lane = i; break; } }

  const isTruck = Math.random() < 0.12;
  const isMotorcycle = !isTruck && Math.random() < 0.06;
  const w = isTruck ? laneW * 0.46 : isMotorcycle ? laneW * 0.14 : laneW * 0.26;
  const h = isTruck ? w * 2.5 : isMotorcycle ? w * 1.8 : w * 1.8;
  const cx = getLaneCenter(lane, canvasW) + (Math.random() - 0.5) * laneW * 0.15;

  // Don't spawn on top of another vehicle just entering the scene
  for (const v of drivingVehicles) {
    if (v.y < 0 && Math.abs(cx - (v.x + v.w / 2)) < laneW * 0.4) return;
  }

  const baseSpeed = 35 + Math.random() * 75;
  drivingVehicles.push({
    x: cx - w / 2, y: -h - Math.random() * 350,
    w, h,
    speed: baseSpeed,
    color: LANE_COLORS[Math.floor(Math.random() * LANE_COLORS.length)],
    type: isTruck ? 'truck' : isMotorcycle ? 'motorcycle' : 'car',
    lane,
    changingLane: false,
  });
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, isEgo: boolean, vehicleType: string) {
  ctx.save();
  const cx = x + w / 2, cy = y + h / 2;

  // Shadow
  ctx.shadowColor = isEgo ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = isEgo ? 12 : 4;

  // Body — rounded rectangle
  const bw = w * 0.88, bh = h * 0.82;
  const br = Math.min(bw, bh) * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, br);
  ctx.fill();

  ctx.shadowBlur = 0;

  if (vehicleType === 'truck') {
    // Truck: cab at front, cargo at back
    const cabH = bh * 0.35;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx - bw * 0.35, cy - bh / 2, bw * 0.7, cabH);
    // Cargo bed
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(cx - bw * 0.4, cy - bh / 2 + cabH + 2, bw * 0.8, bh - cabH - 4);
  } else if (vehicleType === 'motorcycle') {
    // Motorcycle: narrower body
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx - bw * 0.15, cy - bh * 0.3, bw * 0.3, bh * 0.25);
  } else {
    // Car: windshield + rear window
    ctx.fillStyle = 'rgba(180,210,240,0.55)';
    ctx.fillRect(cx - bw * 0.28, cy - bh * 0.22, bw * 0.56, bh * 0.22);
    ctx.fillStyle = 'rgba(160,190,220,0.4)';
    ctx.fillRect(cx - bw * 0.25, cy + bh * 0.03, bw * 0.5, bh * 0.18);
  }

  // Wheels — on left/right sides, not front/back
  ctx.fillStyle = '#1a1a1a';
  const wheelW = w * 0.14, wheelH = h * 0.18;
  // Front-left, Front-right
  ctx.fillRect(x - wheelW * 0.3, cy - h * 0.32, wheelW, wheelH);
  ctx.fillRect(x + w - wheelW * 0.7, cy - h * 0.32, wheelW, wheelH);
  // Rear-left, Rear-right
  ctx.fillRect(x - wheelW * 0.3, cy + h * 0.14, wheelW, wheelH);
  ctx.fillRect(x + w - wheelW * 0.7, cy + h * 0.14, wheelW, wheelH);

  // NPC vehicles: forward direction arrow
  if (!isEgo) {
    const arrowSize = Math.max(4, w * 0.18);
    const arrowY = y - arrowSize * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, arrowY - arrowSize);
    ctx.lineTo(cx - arrowSize * 0.75, arrowY + arrowSize * 0.4);
    ctx.lineTo(cx + arrowSize * 0.75, arrowY + arrowSize * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // Ego car: add a blue highlight line
  if (isEgo) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, br);
    ctx.stroke();
  }

  ctx.restore();
}

function tickDrivingSim(ts: number) {
  const canvas = drivingCanvasRef.value || document.querySelector('.driving-canvas') as HTMLCanvasElement | null;
  if (!canvas) { drivingAnimationId = requestAnimationFrame(tickDrivingSim); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) { drivingAnimationId = requestAnimationFrame(tickDrivingSim); return; }

  const W = canvas.width = canvas.clientWidth || 800;
  const H = canvas.height = canvas.clientHeight || 500;
  if (W <= 0 || H <= 0) { drivingAnimationId = requestAnimationFrame(tickDrivingSim); return; }
  if (!drivingLastTime) drivingLastTime = ts;
  const dt = Math.min((ts - drivingLastTime) / 1000, 0.1);
  drivingLastTime = ts;

  const laneW = W / 3;
  const speedPx = drivingSpeed.value * 3;
  drivingRoadOffset = (drivingRoadOffset + speedPx * dt) % 60;

  // ---- Compute ego state once ----
  const egoCX = W / 2 + drivingEgoX;
  const egoCY = H * 0.78;
  const egoW = laneW * 0.36, egoH = egoW * 1.7;

  // Steering - auto pilot
  if (drivingAutoPilot.value) {
    const egoLane = Math.floor(egoCX / laneW);
    let targetSteer = 0;
    let closestThreatDist = Infinity;
    const aiCmd = drivingAiCommand.value;
    const aiCmdActive = aiCmd && Date.now() < aiCmd.until;

    // ── AEB: emergency brake + evade before collision ──
    const egoLeft = egoCX - egoW / 2 - 4, egoRight = egoCX + egoW / 2 + 4;
    const egoTop = egoCY - egoH / 2 - 6, egoBot = egoCY + egoH / 2 + 6;
    let emergency = false;

    for (const v of drivingVehicles) {
      const vLeft = (v.x + v.w / 2) - v.w / 2 - 4;
      const vRight = (v.x + v.w / 2) + v.w / 2 + 4;
      const vTop = v.y - 6, vBot = v.y + v.h + 6;
      // Collision box overlap
      if (!(egoRight < vLeft || egoLeft > vRight || egoBot < vTop || egoTop > vBot)) {
        emergency = true;
        // Find the clearest adjacent lane
        const lanes = [egoLane - 1, egoLane + 1].filter(l => l >= 0 && l <= 2);
        let bestLane = egoLane;
        let bestClear = Infinity;
        for (const l of lanes) {
          let minDist = Infinity;
          for (const o of drivingVehicles) {
            if (o === v) continue;
            const ol = Math.floor((o.x + o.w / 2) / laneW);
            const od = Math.abs((o.y + o.h / 2) - egoCY);
            if (ol === l && od < minDist) minDist = od;
          }
          if (minDist > bestClear) { bestClear = minDist; bestLane = l; }
        }
        // Emergency steer to clearest lane + brake
        const emergencyCX = bestLane * laneW + laneW / 2 - W / 2;
        targetSteer = (emergencyCX - drivingEgoX) * 0.5;
        drivingSpeed.value = Math.max(10, drivingSpeed.value - 40 * dt);
        break;
      }
    }

    if (!emergency) {
    // AI command override (valid for 4 seconds)
    if (aiCmdActive) {
      // Steer toward the target lane center
      let targetLane = egoLane;
      if (aiCmd.action === '左转') targetLane = Math.max(0, egoLane - 1);
      else if (aiCmd.action === '右转') targetLane = Math.min(2, egoLane + 1);
      // '直行' keeps current lane (lane-keep toward current lane center)
      const targetCX = targetLane * laneW + laneW / 2 - W / 2;
      targetSteer = (targetCX - drivingEgoX) * 0.05;
      // Speed is applied once in onDone, not per-frame here
    } else {
      // Rule-based fallback
      for (const v of drivingVehicles) {
      const vcx = v.x + v.w / 2;
      const vLane = Math.floor(vcx / laneW);
      const vertDist = (v.y + v.h / 2) - egoCY; // vehicle ahead of ego = smaller Y (negative vertDist)

      // Look far ahead: 8 car lengths + speed bonus
      const lookAhead = egoH * 8 + Math.max(0, v.speed - drivingSpeed.value) * 2;

      if (Math.abs(vertDist) < lookAhead) {
        const lateralDist = Math.abs(vcx - egoCX);
        if (vLane === egoLane && lateralDist < laneW * 0.55) {
          if (Math.abs(vertDist) < closestThreatDist) closestThreatDist = Math.abs(vertDist);

          // Imminent: within 2 car lengths → immediate evasive action
          if (Math.abs(vertDist) < egoH * 2) {
            const goLeft = egoLane > 0;
            const goRight = egoLane < 2;
            const leftOk = goLeft && !drivingVehicles.some(o =>
              o !== v && Math.abs((o.x + o.w / 2) / laneW - (egoLane - 1)) < 0.5 &&
              Math.abs((o.y + o.h / 2) - egoCY) < egoH * 5);
            const rightOk = goRight && !drivingVehicles.some(o =>
              o !== v && Math.abs((o.x + o.w / 2) / laneW - (egoLane + 1)) < 0.5 &&
              Math.abs((o.y + o.h / 2) - egoCY) < egoH * 5);
            targetSteer = leftOk ? -0.8 : rightOk ? 0.8 : goLeft ? -0.6 : 0.6;
            break;
          }

          // Medium range: 2-5 car lengths → preemptively drift to safer lane
          if (Math.abs(vertDist) < egoH * 5) {
            const prefLane = egoLane > 0 ? egoLane - 1 : egoLane + 1;
            const prefOk = !drivingVehicles.some(o =>
              o !== v && Math.abs((o.x + o.w / 2) / laneW - prefLane) < 0.5 &&
              Math.abs((o.y + o.h / 2) - egoCY) < egoH * 6);
            if (prefOk) {
              const targetCX = prefLane * laneW + laneW / 2 - W / 2;
              targetSteer = (targetCX - drivingEgoX) * 0.15;
            }
          }
        }
      }
    }

    // No threat: keep current course
    if (closestThreatDist === Infinity || closestThreatDist > egoH * 8) {
      targetSteer = 0;
    }

    } // end rule-based fallback
    } // end !emergency

    // Smoothing: higher damping for AI commands to prevent oscillation during lane changes
    const smooth = closestThreatDist < egoH * 3 ? 12 : (aiCmdActive ? 10 : 6);
    drivingSteering.value += (targetSteer - drivingSteering.value) * smooth * dt;
  }

  drivingEgoX += drivingSteering.value * 200 * dt;
  drivingEgoX = Math.max(-laneW * 1.0, Math.min(laneW * 1.0, drivingEgoX));

  // Spawn vehicles (avoid ego lane)
  if (drivingVehicles.length < 12 && Math.random() < 0.012 * (drivingSpeed.value / 40)) {
    const egoLane = Math.floor(egoCX / laneW);
    spawnVehicle(W, egoCX, egoLane);
  }

  // Move AI vehicles
  for (const v of drivingVehicles) {
    const vcx = v.x + v.w / 2;
    const vLane = Math.floor(vcx / laneW);

    // Speed variation
    v.speed += (Math.random() - 0.5) * 1.5 * dt;
    v.speed = Math.max(20, Math.min(110, v.speed));

    // Slow down if too close to vehicle ahead in same lane
    for (const other of drivingVehicles) {
      if (other === v) continue;
      const otherCx = other.x + other.w / 2;
      const otherLane = Math.floor(otherCx / laneW);
      const gap = other.y - (v.y + v.h); // negative = other ahead of v (smaller Y)
      if (otherLane === vLane && gap < 0 && gap > -v.h * 3 && other.speed < v.speed) {
        v.speed = Math.max(v.speed - 30 * dt, other.speed - 5);
      }
    }

    // Lane change to pass slower vehicle ahead
    if (!v.changingLane) {
      for (const other of drivingVehicles) {
        if (other === v) continue;
        const otherLane = Math.floor((other.x + other.w / 2) / laneW);
        const gap = other.y - (v.y + v.h); // negative = other ahead of v
        if (otherLane === vLane && gap < 0 && gap > -v.h * 4 && other.speed < v.speed - 10) {
          const tryLanes = [vLane - 1, vLane + 1].filter(l => l >= 0 && l <= 2);
          for (const tl of tryLanes) {
            const blocked = drivingVehicles.some(o =>
              o !== v && o !== other &&
              Math.abs((o.x + o.w / 2) / laneW - tl) < 0.5 &&
              Math.abs(o.y - v.y) < v.h * 5);
            if (!blocked) { v.changingLane = true; v.lane = tl; break; }
          }
          break;
        }
      }
    }

    // Execute lane change smoothly
    if (v.changingLane) {
      const targetCX = v.lane * laneW + laneW / 2;
      const diff = targetCX - vcx;
      v.x += diff * 2.5 * dt;
      if (Math.abs(diff) < 1.5) v.changingLane = false;
    }

    // Maintain minimum lateral gap with nearby vehicles
    for (const other of drivingVehicles) {
      if (other === v) continue;
      if (Math.abs(other.y - v.y) < v.h * 2) {
        const otherCx = other.x + other.w / 2;
        const lateralGap = Math.abs(vcx - otherCx);
        if (lateralGap < (v.w + other.w) / 2 + 3) {
          // Push apart
          const pushDir = vcx < otherCx ? -1 : 1;
          v.x += pushDir * 20 * dt;
          other.x -= pushDir * 20 * dt;
        }
      }
    }

    // Move forward: faster vehicles pull ahead (smaller Y = further ahead on road)
    // Road scrolls downward at ego speed; NPC delta is relative to ego
    v.y += (drivingSpeed.value - v.speed) * 3 * dt;
  }
  drivingVehicles = drivingVehicles.filter((v) => v.y < H + 150 && v.y > -600);

  // ---- Draw ----
  const isDark = document.documentElement.classList.contains('dark');

  // Background grass/terrain
  ctx.fillStyle = isDark ? '#1a2332' : '#4a7c3f';
  ctx.fillRect(0, 0, W, H);

  // Road surface
  const roadGrad = ctx.createLinearGradient(W / 2, 0, W / 2, H);
  if (isDark) { roadGrad.addColorStop(0, '#3b4556'); roadGrad.addColorStop(1, '#334155'); }
  else { roadGrad.addColorStop(0, '#5a5f6b'); roadGrad.addColorStop(1, '#4e5460'); }
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, 0, W, H);

  // Road edge rumble strips
  ctx.fillStyle = isDark ? 'rgba(255,200,50,0.3)' : 'rgba(255,200,50,0.25)';
  const rumH = 6, rumGap = 10;
  for (let ry = (drivingRoadOffset % (rumH + rumGap)) - (rumH + rumGap); ry < H; ry += rumH + rumGap) {
    ctx.fillRect(0, ry, 4, rumH);
    ctx.fillRect(W - 4, ry, 4, rumH);
  }

  // Solid road edge lines
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(6, H);
  ctx.moveTo(W - 6, 0); ctx.lineTo(W - 6, H);
  ctx.stroke();

  // Lane markings
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5;
  for (let lane = 1; lane < 3; lane++) {
    const lx = lane * laneW;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    let y = (drivingRoadOffset % 32) - 32;
    while (y < H + 32) { ctx.moveTo(lx, y); ctx.lineTo(lx, y + 18); y += 32; }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Lane detection overlay
  const currentLane = Math.floor(egoCX / laneW);
  ctx.fillStyle = 'rgba(59,130,246,0.06)';
  ctx.fillRect(currentLane * laneW, 0, laneW, H);

  // Draw AI vehicles
  for (const v of drivingVehicles) {
    drawCar(ctx, v.x, v.y, v.w, v.h, v.color, false, v.type);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4);
    ctx.setLineDash([]);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 10px monospace';
    ctx.fillText(`${Math.round(v.speed)}km/h`, v.x - 1, v.y - 6);
  }

  // Draw ego vehicle
  drawCar(ctx, egoCX - egoW / 2, egoCY - egoH / 2, egoW, egoH, '#3b82f6', true, 'car');

  // Update stats
  drivingStats.value = {
    fps: Math.round(1 / (dt || 0.016)),
    objects: drivingVehicles.length,
    laneDev: Math.round(((egoCX % laneW + laneW) % laneW - laneW / 2) * 10) / 10,
    distance: Math.round(drivingRoadOffset / 60 * 10) / 10,
  };

  if (drivingRunning.value) {
    drivingAnimationId = requestAnimationFrame(tickDrivingSim);
  }
}

function startDrivingSim() {
  if (drivingRunning.value) return;
  initDrivingSim();
  drivingRunning.value = true;
  drivingLastTime = 0;
  drivingAnimationId = requestAnimationFrame(tickDrivingSim);
  // Auto AI analysis
  if (drivingAiIntervalId) clearInterval(drivingAiIntervalId);
  drivingAiIntervalId = setInterval(() => {
    if (drivingRunning.value && isAuthenticated.value) analyzeDrivingScene();
  }, drivingAiIntervalSec.value * 1000);
}

function stopDrivingSim() {
  drivingRunning.value = false;
  if (drivingAnimationId) {
    cancelAnimationFrame(drivingAnimationId);
    drivingAnimationId = 0;
  }
  if (drivingAiIntervalId) {
    clearInterval(drivingAiIntervalId);
    drivingAiIntervalId = null;
  }
}

onUnmounted(() => { stopDrivingSim(); });

/* ---------- Video Understanding Handlers ---------- */

function handleVideoUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { status.value = '请选择视频文件'; return; }
  videoFile.value = file;
  videoUrl.value = URL.createObjectURL(file);
  videoAnalysis.value = [];
  input.value = '';
}

async function runVideoAnalysis() {
  if (!videoRef.value || !videoFile.value) return;
  videoAnalysisRunning.value = true;
  videoAnalysis.value = [];

  const video = videoRef.value;
  const modelToUse = multimodalModel.value || visionModels.value[0]?.id || selectedModel.value;
  if (!modelToUse) { status.value = '请选择视觉模型'; videoAnalysisRunning.value = false; return; }

  try {
    // Extract keyframes every 2 seconds
    const duration = video.duration || 10;
    const interval = 2; // seconds
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    for (let t = 0; t < duration && videoAnalysisRunning.value; t += interval) {
      // Seek video to timestamp
      video.currentTime = t;
      await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.6);

      // Analyze frame with vision model
      try {
        const res = await fetch(`${backendBaseUrl.value}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}) },
          body: JSON.stringify({
            model: modelToUse,
            messages: [{ role: 'user', content: [
              { type: 'image_url', image_url: { url: frameBase64 } },
              { type: 'text', text: `这是视频的第${t.toFixed(0)}秒。用一行中文描述画面中有什么物体/场景。（如：轿车、红绿灯、行人、路标等）` },
            ]}],
            max_tokens: 60, temperature: 0.3,
          }),
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const desc = data.choices?.[0]?.message?.content?.trim() || '';
          // Parse objects from description
          const labels = desc.split(/[,，、]/).filter((s: string) => s.trim().length > 0);
          for (const label of labels) {
            videoAnalysis.value.push({
              time: t,
              label: label.trim(),
              confidence: 0.75 + Math.random() * 0.2,
            });
          }
        }
      } catch {
        videoAnalysis.value.push({ time: t, label: '帧分析失败', confidence: 0 });
      }
    }
  } catch (e) {
    status.value = '视频分析失败：' + (e instanceof Error ? e.message : String(e));
  } finally {
    videoAnalysisRunning.value = false;
  }
}

function stopVideoAnalysis() {
  videoAnalysisRunning.value = false;
}

/* ---------- Image-Text Retrieval Handlers ---------- */

function searchImages() {
  if (!retrievalQuery.value.trim()) return;
  retrievalLoading.value = true;
  retrievalResults.value = [];
  // Simulated retrieval results
  const categories = ['urban', 'nature', 'traffic', 'people', 'architecture'];
  setTimeout(() => {
    retrievalResults.value = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      url: `https://picsum.photos/seed/${retrievalQuery.value}${i}/300/200`,
      title: `${retrievalQuery.value} — ${categories[i % categories.length]} 场景 #${i + 1}`,
      sim: Math.round((95 - i * 7 + Math.random() * 5) * 10) / 10,
    }));
    retrievalLoading.value = false;
  }, 800);
}

/* ---------- Multimodal Chat Handlers ---------- */

function handleMmImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { status.value = '请选择图片文件'; return; }
  if (file.size > 10 * 1024 * 1024) { status.value = '图片大小不能超过 10MB'; return; }
  mmChatImageName.value = file.name;
  mmChatMediaType.value = 'image';
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = (e.target?.result as string) || '';
    mmChatImageBase64.value = base64;
    mmChatImages.value = [...mmChatImages.value, { base64, name: file.name }];
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function handleMmAudioUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) { status.value = '请选择音频文件'; return; }
  if (file.size > 20 * 1024 * 1024) { status.value = '音频大小不能超过 20MB'; return; }
  mmChatAudioName.value = file.name;
  mmChatMediaType.value = 'audio';
  const reader = new FileReader();
  reader.onload = (e) => { mmChatAudioBase64.value = (e.target?.result as string) || ''; };
  reader.readAsDataURL(file);
  input.value = '';
}

function handleMmVideoUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { status.value = '请选择视频文件'; return; }
  mmChatVideoName.value = file.name;
  mmChatMediaType.value = 'video';
  mmChatVideoUrl.value = URL.createObjectURL(file);
  // Also extract first frame as base64 for vision model
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = mmChatVideoUrl.value;
  video.onloadeddata = () => {
    video.currentTime = 1;
  };
  video.onseeked = () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      mmChatImageBase64.value = canvas.toDataURL('image/jpeg', 0.8);
    }
  };
  input.value = '';
}

function removeMmMedia(index?: number) {
  if (index !== undefined) {
    mmChatImages.value = mmChatImages.value.filter((_, i) => i !== index);
    mmChatImageBase64.value = mmChatImages.value.length > 0 ? mmChatImages.value[mmChatImages.value.length - 1].base64 : '';
    mmChatImageName.value = mmChatImages.value.length > 0 ? mmChatImages.value[mmChatImages.value.length - 1].name : '';
  } else {
    mmChatImageBase64.value = '';
    mmChatImageName.value = '';
    mmChatImages.value = [];
  }
  mmChatAudioBase64.value = '';
  mmChatAudioName.value = '';
  mmChatVideoUrl.value = '';
  mmChatVideoName.value = '';
  mmChatMediaType.value = '';
}

async function submitMmChat() {
  const content = mmChatPrompt.value.trim();
  if (!content || isMmChatSubmitting.value) return;
  if (!isAuthenticated.value) { status.value = '请先登录'; return; }

  const mediaType = mmChatMediaType.value;
  const allImages = mmChatImages.value.length > 0
    ? mmChatImages.value.map((img) => img.base64)
    : (mmChatImageBase64.value ? [mmChatImageBase64.value] : []);
  const userMsg = {
    id: createId('mm-user'), role: 'user' as const, content,
    image: mmChatImageBase64.value || undefined,
    images: allImages.length > 0 ? allImages : undefined,
    audio: mmChatAudioBase64.value || undefined,
    video: mmChatVideoUrl.value || undefined,
    mediaType: mediaType || undefined,
    mediaName: (mediaType === 'image' ? mmChatImageName.value : mediaType === 'audio' ? mmChatAudioName.value : mediaType === 'video' ? mmChatVideoName.value : '') || undefined,
  };
  mmChatMessages.value.push(userMsg);
  mmChatPrompt.value = '';
  const savedMediaType = mediaType;

  const assistantId = createId('mm-assistant');
  mmChatMessages.value.push({ id: assistantId, role: 'assistant', content: '' });

  removeMmMedia();
  isMmChatSubmitting.value = true;
  mmChatAbortController = new AbortController();

  let streamed = '';

  try {
    // Build messages array for the API
    const apiMessages = mmChatMessages.value
      .filter((m) => m.id !== assistantId)
      .map((m) => {
        if (m.role === 'user' && (m.image || m.audio || m.video)) {
          const parts: Array<{ type: string; text?: string; image_url?: { url: string }; input_audio?: { data: string; format: string } }> = [];
          if (m.image) {
            parts.push({ type: 'image_url', image_url: { url: m.image } });
          }
          if (m.audio) {
            parts.push({ type: 'input_audio', input_audio: { data: m.audio.split(',')[1] || m.audio, format: 'wav' } });
          }
          if (m.video) {
            // For video, send first frame as image
            parts.push({ type: 'image_url', image_url: { url: m.video } });
          }
          parts.push({ type: 'text', text: m.content });
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      });

    // Use selected multimodal model, fallback to first vision model
    const modelToUse = multimodalModel.value || visionModels.value[0]?.id || selectedModel.value;

    await streamCompletion(
      {
        model: modelToUse,
        messages: apiMessages as any,
        temperature: 0.7,
      },
      {
        onChunk: (chunk) => {
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) {
            streamed += token;
            mmChatMessages.value = mmChatMessages.value.map((m) =>
              m.id === assistantId ? { ...m, content: streamed } : m,
            );
          }
        },
        onDone: () => { status.value = '多模态回复完成'; },
        onAbort: () => {
          status.value = '已停止';
          mmChatMessages.value = mmChatMessages.value.map((m) =>
            m.id === assistantId ? { ...m, content: streamed || '(已停止)' } : m,
          );
        },
      },
      backendBaseUrl.value,
      mmChatAbortController.signal,
    );
    if (!streamed && !mmChatAbortController.signal.aborted) {
      mmChatMessages.value = mmChatMessages.value.map((m) =>
        m.id === assistantId ? { ...m, content: '(模型返回空响应)' } : m,
      );
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '请求失败';
    status.value = errMsg;
    if (!mmChatAbortController?.signal.aborted) {
      mmChatMessages.value = mmChatMessages.value.map((m) =>
        m.id === assistantId ? { ...m, content: `请求失败：${errMsg}` } : m,
      );
    }
  } finally {
    isMmChatSubmitting.value = false;
    mmChatAbortController = null;
  }
}

function stopMmChat() { mmChatAbortController?.abort(); }

function clearMmChat() {
  mmChatMessages.value = [];
  removeMmMedia();
}

/* ---------- Driving AI Analysis ---------- */

async function analyzeDrivingScene() {
  if (drivingAiAnalyzing.value) return;
  if (!isAuthenticated.value) { status.value = '请先登录'; return; }

  const canvas = drivingCanvasRef.value || document.querySelector('.driving-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  drivingAiAnalyzing.value = true;
  drivingAiAnalysis.value = '';
  drivingAiAbortController = new AbortController();

  const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);

  const laneW = (canvas.width || 800) / 3;
  const egoCX = (canvas.width || 800) / 2 + drivingEgoX;
  const egoLane = Math.floor(egoCX / laneW);
  const laneNames = ['左车道', '中车道', '右车道'];
  const sceneCtx = `当前车速${Math.round(drivingSpeed.value)}km/h，主车在${laneNames[Math.min(2, Math.max(0, egoLane))]}。`;

  try {
    const modelToUse = multimodalModel.value || visionModels.value[0]?.id || selectedModel.value;
    await streamCompletion(
      {
        model: modelToUse,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageBase64 } },
            { type: 'text', text: `${sceneCtx}蓝色车是主车。你是自动驾驶AI，根据画面和车速信息给出驾驶决策。必须在回复末尾以【决策:左转,加速】格式给出指令。其中方向三选一：左转/右转/直行，速度三选一：加速/减速/匀速。示例：【决策:直行,减速】。` },
          ],
        }],
        temperature: 0.5,
      },
      {
        onChunk: (chunk) => {
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) {
            drivingAiAnalysis.value += token;
          }
        },
        onDone: () => {
          status.value = '场景分析完成';
          const txt = drivingAiAnalysis.value;
          let action = '直行', speed = '匀速';
          // Match the last occurrence of 【决策:...】 (model may put it at the end as instructed)
          const allMatches = [...txt.matchAll(/【决策[：:]([^】]+)】/g)];
          const m = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;
          const cmds = m ? m[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
          if (cmds.length > 0) {
            for (const c of cmds) {
              if (/左转|向左|左道|左变道/.test(c)) action = '左转';
              else if (/右转|向右|右道|右变道/.test(c)) action = '右转';
              else if (/直行|保持|维持/.test(c) && action === '直行') action = '直行';
              if (/加速|提速|加快|快一[点些]/.test(c)) speed = '加速';
              else if (/减速|降速|刹车|减慢|慢一[点些]/.test(c)) speed = '减速';
              else if (/匀速|保持速度|维持速度/.test(c) && speed === '匀速') speed = '匀速';
            }
          } else {
            // Fallback: keyword from full text
            if (/左侧|向左|左转|左道|左变道/.test(txt)) action = '左转';
            else if (/右侧|向右|右转|右道|右变道/.test(txt)) action = '右转';
            if (/加速|提速|加快/.test(txt)) speed = '加速';
            else if (/减速|降速|刹车|减慢/.test(txt)) speed = '减速';
          }
          drivingAiCommand.value = { action, speed, until: Date.now() + 4000 };
          // Apply speed change instantly (once per command)
          if (speed === '加速') drivingSpeed.value = Math.min(120, Math.round((drivingSpeed.value + 10) / 5) * 5);
          else if (speed === '减速') drivingSpeed.value = Math.max(10, Math.round((drivingSpeed.value - 10) / 5) * 5);
        },
        onAbort: () => { status.value = '分析已停止'; },
      },
      backendBaseUrl.value,
      drivingAiAbortController.signal,
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '分析失败';
    status.value = errMsg;
    if (!drivingAiAbortController?.signal.aborted) {
      drivingAiAnalysis.value = `分析失败：${errMsg}`;
    }
  } finally {
    drivingAiAnalyzing.value = false;
    drivingAiAbortController = null;
  }
}

function stopDrivingAnalysis() { drivingAiAbortController?.abort(); }

/* ---------- API Key 管理 ---------- */
async function loadApiKeys() {
  if (!isAuthenticated.value) return;
  try {
    const keys = await listApiKeys(backendBaseUrl.value);
    apiKeys.value = keys.map(k => ({ id: k.id, name: k.name, maskedKey: k.key, createdAt: k.createdAt }));
  } catch (e) {
    console.error('[loadApiKeys] failed:', e);
  }
}

function openCreateApiKey() {
  apiKeyNewName.value = `Key ${apiKeys.value.length + 1}`;
  apiKeyCreateDialog.value = true;
}

async function createApiKey() {
  apiKeyLoading.value = true;
  try {
    const name = apiKeyNewName.value.trim() || `Key ${apiKeys.value.length + 1}`;
    const result = await apiCreateApiKey(name, backendBaseUrl.value);
    apiKeys.value.push({
      id: result.id,
      name: result.name,
      maskedKey: result.key,
      fullKey: result.rawKey ?? result.key,
      createdAt: result.createdAt,
    });
    apiKeyCreateDialog.value = false;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建 API Key 失败';
  } finally {
    apiKeyLoading.value = false;
  }
}

async function revokeApiKey(id: string) {
  try {
    await apiRevokeApiKey(id, backendBaseUrl.value);
    apiKeys.value = apiKeys.value.filter(k => k.id !== id);
  } catch (error) {
    status.value = error instanceof Error ? error.message : '删除 API Key 失败';
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => { status.value = '已复制到剪贴板'; },
    () => { status.value = '复制失败'; },
  );
}

function openVideoUploadInput() {
  const el = window.document.getElementById('video-upload-input');
  if (el) el.click();
}
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
          <span>Agent</span>
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
            <span>多模态 Beta</span>
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
        <el-menu-item index="docs">
          <el-icon><InfoFilled /></el-icon>
          <span>功能文档</span>
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
      <template v-if="pageMode === 'chat'">
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

      <!-- ========== AGENT PAGE ========== -->
      <template v-else-if="pageMode === 'agent'">
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>Agent Studio</strong>
            <el-button :icon="Refresh" :loading="agentLoading || agentResourceLoading" @click="refreshAgentStudio()">刷新 Agent</el-button>
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
                    <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag>{{ status }}</el-tag>
            </template>
          </div>
        </div>

        <div class="agent-page">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以创建和运行 Agent" />

          <template v-else>
            <el-card class="agent-panel agent-config-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 配置</span>
                  <el-tag size="small" :type="agentForm.status === 'active' ? 'success' : 'info'">
                    {{ agentForm.status === 'active' ? 'Active' : 'Archived' }}
                  </el-tag>
                </div>
              </template>

              <div class="agent-builder">
                <div class="agent-builder-head">
                  <span>拖拽制作 Agent</span>
                  <div class="agent-builder-actions">
                    <el-button size="small" text @click="clearAgentBuilderCanvas()">清空</el-button>
                    <el-button size="small" type="primary" plain @click="applyAgentBuilder()">应用</el-button>
                  </div>
                </div>
                <div class="agent-builder-body">
                  <div class="agent-builder-palette">
                    <div
                      v-for="block in agentBuilderBlocks"
                      :key="block.type"
                      class="agent-builder-block"
                      draggable="true"
                      @dragstart="startAgentBuilderDrag(block)"
                    >
                      <strong>{{ block.title }}</strong>
                      <span>{{ block.detail }}</span>
                    </div>
                  </div>
                  <div
                    class="agent-builder-canvas"
                    :class="{ dragging: Boolean(agentBuilderDragging) }"
                    @dragover.prevent
                    @drop.prevent="dropAgentBuilderBlock()"
                  >
                    <template v-if="agentBuilderCanvas.length > 0">
                      <div
                        v-for="block in agentBuilderCanvas"
                        :key="block.type"
                        class="agent-builder-node"
                      >
                        <span>{{ block.title }}</span>
                        <el-button size="small" text :icon="Delete" @click="removeAgentBuilderBlock(block.type)" />
                      </div>
                    </template>
                    <span v-else>拖到这里组合 Agent</span>
                  </div>
                </div>
              </div>

              <div class="agent-generator-box">
                <div class="agent-builder-head">
                  <span>AI 生成 Agent</span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :loading="agentGenerating"
                    :disabled="!generatorForm.requirement.trim()"
                    @click="generateAgentFromRequirement()"
                  >
                    生成
                  </el-button>
                </div>
                <el-input
                  v-model="generatorForm.requirement"
                  type="textarea"
                  :rows="3"
                  resize="vertical"
                  maxlength="4000"
                  placeholder="描述你想要的 Agent，例如：一个能读取知识库、调用 Notion、生成周报并做自检的研究助理。"
                />
              </div>

              <el-form label-position="top" class="agent-form">
                <el-form-item label="名称">
                  <el-input v-model="agentForm.name" maxlength="80" show-word-limit placeholder="例如：产品客服 Agent" />
                </el-form-item>
                <el-form-item label="描述">
                  <el-input v-model="agentForm.description" maxlength="500" show-word-limit placeholder="这个 Agent 适合处理什么任务" />
                </el-form-item>
                <el-form-item label="模型">
                  <el-select v-model="agentForm.model" placeholder="选择模型" filterable style="width:100%">
                    <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id">
                      <span>{{ model.id }}</span>
                      <el-tag v-if="getModelTags(model.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
                    </el-option>
                  </el-select>
                </el-form-item>
                <div class="agent-form-grid">
                  <el-form-item label="Temperature">
                    <el-slider v-model="agentForm.temperature" :min="0" :max="2" :step="0.1" show-input />
                  </el-form-item>
                  <el-form-item label="Max Tokens">
                    <el-input-number v-model="agentForm.maxTokens" :min="1" :max="32000" :step="256" style="width:100%" />
                  </el-form-item>
                </div>
                <el-form-item label="状态">
                  <el-segmented
                    v-model="agentForm.status"
                    :options="[
                      { label: 'Active', value: 'active' },
                      { label: 'Archived', value: 'archived' },
                    ]"
                  />
                </el-form-item>
                <div class="agent-publish-box">
                  <div class="agent-publish-row">
                    <div>
                      <strong>发布与接入</strong>
                      <p>开启后可通过公开地址或 API Key 调用当前 Agent。</p>
                    </div>
                    <el-button
                      size="small"
                      type="primary"
                      plain
                      :loading="agentPublishing"
                      :disabled="!agentForm.id"
                      @click="saveAgentPublication()"
                    >
                      保存发布配置
                    </el-button>
                  </div>
                  <div class="agent-form-grid">
                    <el-form-item label="公开发布">
                      <el-switch v-model="agentForm.published" active-text="公开" inactive-text="私有" />
                    </el-form-item>
                    <el-form-item label="API 接入">
                      <el-switch v-model="agentForm.apiEnabled" active-text="开启" inactive-text="关闭" />
                    </el-form-item>
                  </div>
                  <el-form-item label="公开标识">
                    <el-input v-model="agentForm.publicSlug" maxlength="80" placeholder="例如 product-support-agent" />
                  </el-form-item>
                  <div class="agent-endpoint-list">
                    <el-input :model-value="agentPublicEndpoint" readonly placeholder="公开调用地址" />
                    <el-input :model-value="agentApiEndpoint" readonly placeholder="API Key 调用地址" />
                  </div>
                </div>
                <el-form-item label="长期记忆">
                  <el-switch v-model="agentForm.memoryEnabled" active-text="启用" inactive-text="关闭" />
                </el-form-item>
                <el-form-item label="工具">
                  <el-select
                    v-model="agentForm.toolIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择工具"
                    style="width:100%"
                  >
                    <el-option
                      v-for="tool in availableTools"
                      :key="tool.id"
                      :label="tool.displayName"
                      :value="tool.id"
                    >
                      <span>{{ tool.displayName }}</span>
                      <el-text type="info" size="small" style="margin-left:8px">{{ tool.name }}</el-text>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="Skills">
                  <el-select
                    v-model="agentForm.skillIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择 Agent 能力包"
                    style="width:100%"
                  >
                    <el-option
                      v-for="skill in availableSkills"
                      :key="skill.id"
                      :label="skill.name"
                      :value="skill.id"
                    >
                      <span>{{ skill.name }}</span>
                      <el-text type="info" size="small" style="margin-left:8px">{{ skill.category }}</el-text>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="知识库">
                  <el-select
                    v-model="agentForm.knowledgeBaseIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择知识库"
                    style="width:100%"
                  >
                    <el-option
                      v-for="kb in knowledgeBases"
                      :key="kb.id"
                      :label="kb.name"
                      :value="kb.id"
                    >
                      <span>{{ kb.name }}</span>
                      <el-text type="info" size="small" style="margin-left:8px">{{ kb.chunkCount }} chunks</el-text>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="系统提示词">
                  <el-input
                    v-model="agentForm.systemPrompt"
                    type="textarea"
                    :rows="8"
                    resize="vertical"
                    maxlength="12000"
                    show-word-limit
                    placeholder="定义角色、目标、输出格式、约束和安全边界"
                  />
                </el-form-item>
              </el-form>

              <div class="agent-actions">
                <el-button @click="createAgentDraft" :icon="Plus">新草稿</el-button>
                <el-button type="primary" :loading="agentSaving" @click="saveAgent()">保存 Agent</el-button>
              </div>
            </el-card>

            <el-card class="agent-panel agent-run-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>{{ agentForm.id ? agentForm.name : '未保存 Agent' }}</span>
                  <div class="agent-head-tags">
                    <el-tag v-if="agentForm.model" size="small">{{ agentForm.model }}</el-tag>
                    <el-tag v-if="agentForm.memoryEnabled" size="small" type="success">Memory</el-tag>
                    <el-tag v-if="agentForm.toolIds.length" size="small" type="warning">Tools {{ agentForm.toolIds.length }}</el-tag>
                    <el-tag v-if="agentForm.skillIds.length" size="small" type="success">Skills {{ agentForm.skillIds.length }}</el-tag>
                    <el-tag v-if="agentForm.knowledgeBaseIds.length" size="small" type="primary">RAG {{ agentForm.knowledgeBaseIds.length }}</el-tag>
                    <el-tag v-if="activeAgent" size="small" type="info">运行 {{ activeAgent.runCount }} 次</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-run-box">
                <el-input
                  v-model="agentPrompt"
                  type="textarea"
                  :rows="5"
                  resize="vertical"
                  placeholder="给这个 Agent 一个明确任务，例如：根据我们的产品手册，生成一份客服答复。"
                  :disabled="agentRunning"
                  @keydown.enter.exact.prevent="runCurrentAgent()"
                  @compositionstart="isComposing = true"
                  @compositionend="isComposing = false"
                />
                <el-input
                  v-model="agentImageUrlInput"
                  type="textarea"
                  :rows="2"
                  resize="vertical"
                  placeholder="可选：图片 URL，一行一个；使用视觉模型时会作为多模态输入"
                />
                <div class="agent-run-actions">
                  <el-text type="info" size="small">
                    {{ agentForm.id ? `Agent ID: ${agentForm.id}` : '首次运行前会先保存 Agent' }}
                  </el-text>
                  <el-button
                    type="primary"
                    :icon="Promotion"
                    :loading="agentRunning"
                    :disabled="!agentPrompt.trim() || !agentForm.model"
                    @click="runCurrentAgent()"
                  >
                    运行 Agent
                  </el-button>
                </div>
              </div>

              <div v-if="activeAgentRun" class="agent-result">
                <div class="agent-run-meta">
                  <el-tag :type="agentRunTagType(activeAgentRun.status)">{{ activeAgentRun.status }}</el-tag>
                  <el-tag type="info">{{ activeAgentRun.model }}</el-tag>
                  <el-tag type="info">{{ activeAgentRun.totalTokens }} tokens</el-tag>
                  <el-tag type="info">{{ activeAgentRun.latencyMs }} ms</el-tag>
                  <span>{{ formatAgentDate(activeAgentRun.createdAt) }}</span>
                </div>

                <el-alert
                  v-if="activeAgentRun.error"
                  type="error"
                  :closable="false"
                  show-icon
                  :title="activeAgentRun.error"
                  style="margin-bottom:12px"
                />

                <div class="agent-output">
                  <div class="agent-section-title">输出</div>
                  <div v-if="activeAgentRun.output" class="markdown-content" v-html="renderMarkdown(activeAgentRun.output)"></div>
                  <div v-else class="agent-placeholder">暂无输出</div>
                </div>

                <div class="agent-trace">
                  <div class="agent-section-title">Trace</div>
                  <el-timeline>
                    <el-timeline-item
                      v-for="step in activeAgentRun.steps"
                      :key="step.id"
                      :timestamp="formatAgentDate(step.startedAt)"
                      placement="top"
                      :type="agentRunTagType(step.status)"
                    >
                      <div class="agent-step">
                        <div class="agent-step-head">
                          <strong>{{ step.name }}</strong>
                          <div>
                            <el-tag size="small" :type="agentRunTagType(step.status)">{{ step.status }}</el-tag>
                            <el-tag size="small" type="info" style="margin-left:4px">{{ step.latencyMs }} ms</el-tag>
                          </div>
                        </div>
                        <div v-if="step.error" class="agent-step-error">{{ step.error }}</div>
                        <pre v-if="formatStepMetadata(step.metadata)" class="agent-step-meta">{{ formatStepMetadata(step.metadata) }}</pre>
                      </div>
                    </el-timeline-item>
                  </el-timeline>
                </div>
              </div>

              <el-empty v-else description="保存并运行 Agent 后，这里会显示输出和执行链路。" :image-size="96" />
            </el-card>

            <el-card class="agent-panel agent-history-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 控制台</span>
                  <el-button size="small" text :loading="agentResourceLoading" @click="loadAgentResources()">刷新</el-button>
                </div>
              </template>
              <el-tabs v-model="agentSideTab" class="agent-side-tabs">
                <el-tab-pane label="历史" name="history">
                  <el-scrollbar class="agent-history-list">
                    <div
                      v-for="run in agentRuns"
                      :key="run.id"
                      class="agent-history-item"
                      :class="{ active: activeAgentRun?.id === run.id }"
                      @click="selectAgentRun(run)"
                    >
                      <div class="agent-history-head">
                        <el-tag size="small" :type="agentRunTagType(run.status)">{{ run.status }}</el-tag>
                        <span>{{ run.totalTokens }} tokens</span>
                      </div>
                      <div class="agent-history-input">{{ run.input }}</div>
                      <div class="agent-history-time">{{ formatAgentDate(run.createdAt) }}</div>
                    </div>
                    <el-empty v-if="agentRuns.length === 0" description="暂无运行历史" :image-size="72" />
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="知识" name="knowledge">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="knowledgeForm.name" placeholder="知识库名称" maxlength="80" />
                      <el-input v-model="knowledgeForm.description" placeholder="描述" maxlength="300" />
                      <el-button type="primary" plain :loading="knowledgeCreating" :disabled="!knowledgeForm.name.trim()" @click="createKnowledgeBaseFromForm()">创建知识库</el-button>
                      <el-divider />
                      <el-select v-model="knowledgeDocForm.kbId" placeholder="选择知识库" filterable style="width:100%">
                        <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                      </el-select>
                      <el-input v-model="knowledgeDocForm.title" placeholder="文档标题" maxlength="120" />
                      <el-input v-model="knowledgeDocForm.content" type="textarea" :rows="5" resize="vertical" placeholder="粘贴文档内容" />
                      <el-button
                        type="primary"
                        :loading="knowledgeDocSaving"
                        :disabled="!knowledgeDocForm.kbId || !knowledgeDocForm.title.trim() || !knowledgeDocForm.content.trim()"
                        @click="addDocumentToKnowledgeBase()"
                      >
                        写入文档
                      </el-button>
                      <div v-for="kb in knowledgeBases" :key="kb.id" class="agent-resource-item">
                        <div class="agent-resource-title">{{ kb.name }}</div>
                        <div class="agent-resource-meta">{{ kb.documentCount }} docs · {{ kb.chunkCount }} chunks</div>
                      </div>
                      <el-empty v-if="knowledgeBases.length === 0" description="暂无知识库" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="记忆" name="memory">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="memoryForm.content" type="textarea" :rows="5" resize="vertical" placeholder="写入一条长期记忆" />
                      <div class="agent-inline-field">
                        <span>重要性</span>
                        <el-slider v-model="memoryForm.importance" :min="1" :max="5" :step="1" show-stops />
                      </div>
                      <el-button
                        type="primary"
                        plain
                        :loading="memorySaving"
                        :disabled="!memoryForm.content.trim() || !agentForm.id"
                        @click="createAgentMemory()"
                      >
                        写入记忆
                      </el-button>
                      <el-divider />
                      <div v-for="memory in agentMemories" :key="memory.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <el-tag size="small" type="info">{{ memory.memoryType }}</el-tag>
                          <span>重要性 {{ memory.importance }}</span>
                        </div>
                        <div class="agent-resource-content">{{ memory.content }}</div>
                      </div>
                      <el-empty v-if="agentMemories.length === 0" description="暂无记忆" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="Skills" name="skills">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="skillForm.name" placeholder="Skill 名称" maxlength="80" />
                      <el-input v-model="skillForm.category" placeholder="分类，例如 code / research / ops" maxlength="64" />
                      <el-input v-model="skillForm.description" placeholder="描述" maxlength="300" />
                      <el-input
                        v-model="skillForm.content"
                        type="textarea"
                        :rows="6"
                        resize="vertical"
                        placeholder="写入可复用能力说明、步骤约束、输出格式和工具使用策略"
                      />
                      <el-button
                        type="primary"
                        plain
                        :loading="skillCreating"
                        :disabled="!skillForm.name.trim() || !skillForm.content.trim()"
                        @click="createSkillFromForm()"
                      >
                        创建并挂载 Skill
                      </el-button>
                      <el-divider />
                      <div v-for="skill in availableSkills" :key="skill.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <span>{{ skill.name }}</span>
                          <el-tag size="small" type="info">{{ skill.category }}</el-tag>
                        </div>
                        <div class="agent-resource-meta">{{ skill.userId ? '自定义 Skill' : '平台预置 Skill' }}</div>
                        <div class="agent-resource-content">{{ skill.description || skill.content }}</div>
                      </div>
                      <el-empty v-if="availableSkills.length === 0" description="暂无 Skill" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="Team" name="team">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="teamForm.name" placeholder="Team 名称，默认使用当前 Agent 名称" maxlength="80" />
                      <el-input v-model="teamForm.description" placeholder="团队职责描述" maxlength="300" />
                      <el-segmented
                        v-model="teamForm.strategy"
                        :options="[
                          { label: 'Sequential', value: 'sequential' },
                          { label: 'Review', value: 'review' },
                          { label: 'Debate', value: 'debate' },
                          { label: 'Parallel', value: 'parallel' },
                          { label: 'Consensus', value: 'consensus' },
                          { label: 'Router', value: 'router' },
                        ]"
                      />
                      <el-select
                        v-model="teamForm.memberIds"
                        multiple
                        filterable
                        collapse-tags
                        placeholder="选择协作 Agent"
                        style="width:100%"
                      >
                        <el-option
                          v-for="agent in agents"
                          :key="agent.id"
                          :label="agent.name"
                          :value="agent.id"
                          :disabled="agent.id === agentForm.id"
                        />
                      </el-select>
                      <el-button
                        type="primary"
                        plain
                        :loading="teamCreating"
                        :disabled="!agentForm.id && teamForm.memberIds.length === 0"
                        @click="createTeamFromForm()"
                      >
                        创建 Team
                      </el-button>
                      <el-divider />
                      <el-select v-model="activeTeamId" placeholder="选择 Agent Team" filterable style="width:100%">
                        <el-option v-for="team in agentTeams" :key="team.id" :label="team.name" :value="team.id" />
                      </el-select>
                      <el-input v-model="teamInput" type="textarea" :rows="4" resize="vertical" placeholder="Team 输入" />
                      <el-button
                        type="primary"
                        :loading="teamRunning"
                        :disabled="!activeTeamId || !teamInput.trim()"
                        @click="runSelectedTeam()"
                      >
                        运行 Team
                      </el-button>
                      <div v-for="team in agentTeams" :key="team.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <span>{{ team.name }}</span>
                          <el-tag size="small" type="info">{{ team.strategy }}</el-tag>
                        </div>
                        <div class="agent-resource-meta">{{ team.members.length }} agents</div>
                        <div class="agent-resource-content">{{ team.description || '暂无描述' }}</div>
                      </div>
                      <div v-if="activeTeamRun" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <span>最近 Team 输出</span>
                          <el-tag size="small" :type="agentRunTagType(activeTeamRun.status)">{{ activeTeamRun.status }}</el-tag>
                        </div>
                        <div class="agent-resource-content">{{ activeTeamRun.output || activeTeamRun.error }}</div>
                        <el-divider />
                        <div v-for="member in activeTeamRun.memberOutputs" :key="member.runId" class="agent-resource-content">
                          <strong>{{ member.role }}</strong>
                          <p>{{ member.output || member.error }}</p>
                        </div>
                      </div>
                      <el-empty v-if="agentTeams.length === 0" description="暂无 Agent Team" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="Workflow" name="workflow">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-button type="primary" plain :loading="workflowCreating" @click="createDefaultWorkflow()">生成 Workflow</el-button>
                      <el-select v-model="activeWorkflowId" placeholder="选择 Workflow" filterable style="width:100%">
                        <el-option v-for="workflow in workflows" :key="workflow.id" :label="workflow.name" :value="workflow.id" />
                      </el-select>
                      <el-input v-model="workflowInput" type="textarea" :rows="4" resize="vertical" placeholder="Workflow 输入" />
                      <el-button
                        type="primary"
                        :loading="workflowRunning"
                        :disabled="!activeWorkflowId || !workflowInput.trim()"
                        @click="runSelectedWorkflow()"
                      >
                        运行 Workflow
                      </el-button>
                      <div v-if="activeWorkflowRun" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <el-tag size="small" :type="agentRunTagType(activeWorkflowRun.status)">{{ activeWorkflowRun.status }}</el-tag>
                          <span>{{ activeWorkflowRun.steps.length }} steps</span>
                        </div>
                        <pre class="agent-step-meta">{{ activeWorkflowRun.output || activeWorkflowRun.error }}</pre>
                      </div>
                      <div v-for="workflow in workflows" :key="workflow.id" class="agent-resource-item">
                        <div class="agent-resource-title">{{ workflow.name }}</div>
                        <div class="agent-resource-meta">{{ workflow.nodes.length }} nodes · {{ workflow.status }}</div>
                      </div>
                      <el-empty v-if="workflows.length === 0" description="暂无 Workflow" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="版本" name="versions">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="versionForm.label" placeholder="版本标签，例如 release-1" maxlength="120" />
                      <el-button
                        type="primary"
                        plain
                        :loading="versionSaving"
                        :disabled="!agentForm.id"
                        @click="createVersionFromForm()"
                      >
                        创建版本快照
                      </el-button>
                      <div v-for="version in agentVersions" :key="version.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <span>v{{ version.versionNumber }} · {{ version.label }}</span>
                          <el-button size="small" text :loading="versionSaving" @click="restoreVersion(version.id)">恢复</el-button>
                        </div>
                        <div class="agent-resource-meta">{{ formatAgentDate(version.createdAt) }}</div>
                      </div>
                      <el-empty v-if="agentVersions.length === 0" description="暂无版本" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="测试" name="tests">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="testSuiteForm.name" placeholder="测试集名称" maxlength="120" />
                      <el-input v-model="testSuiteForm.description" placeholder="测试集描述" maxlength="300" />
                      <el-button
                        type="primary"
                        plain
                        :loading="testSaving"
                        :disabled="!agentForm.id || !testSuiteForm.name.trim()"
                        @click="createTestSuiteFromForm()"
                      >
                        创建测试集
                      </el-button>
                      <el-select v-model="activeTestSuiteId" placeholder="选择测试集" filterable style="width:100%">
                        <el-option v-for="suite in agentTestSuites" :key="suite.id" :label="`${suite.name} (${suite.caseCount})`" :value="suite.id" />
                      </el-select>
                      <el-input v-model="testCaseForm.name" placeholder="用例名称" maxlength="120" />
                      <el-input v-model="testCaseForm.input" type="textarea" :rows="3" resize="vertical" placeholder="测试输入" />
                      <el-input v-model="testCaseForm.expectedOutput" type="textarea" :rows="3" resize="vertical" placeholder="期望输出/关键点" />
                      <el-input v-model="testCaseForm.rubric" type="textarea" :rows="2" resize="vertical" placeholder="评测标准" />
                      <div class="agent-run-actions">
                        <el-button
                          type="primary"
                          plain
                          :loading="testSaving"
                          :disabled="!activeTestSuiteId || !testCaseForm.name.trim() || !testCaseForm.input.trim()"
                          @click="createTestCaseFromForm()"
                        >
                          添加用例
                        </el-button>
                        <el-button
                          type="primary"
                          :loading="testRunning"
                          :disabled="!activeTestSuiteId || agentTestCases.length === 0"
                          @click="runSelectedTestSuite()"
                        >
                          运行回归
                        </el-button>
                      </div>
                      <div v-if="activeTestRun" class="agent-resource-item">
                        <div class="agent-resource-title">最近回归结果</div>
                        <pre class="agent-step-meta">{{ JSON.stringify(activeTestRun, null, 2) }}</pre>
                      </div>
                      <div v-for="testCase in agentTestCases" :key="testCase.id" class="agent-resource-item">
                        <div class="agent-resource-title">{{ testCase.name }}</div>
                        <div class="agent-resource-content">{{ testCase.input }}</div>
                      </div>
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="MCP" name="mcp">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <el-input v-model="mcpForm.name" placeholder="Server 名称" maxlength="80" />
                      <el-input v-model="mcpForm.token" type="password" show-password placeholder="Notion Internal Integration Token" />
                      <el-button
                        type="primary"
                        plain
                        :loading="mcpSaving"
                        :disabled="!mcpForm.token.trim()"
                        @click="createMcpServerFromForm()"
                      >
                        保存 Notion MCP
                      </el-button>
                      <el-input v-model="mcpForm.query" placeholder="Notion 测试查询" maxlength="200" />
                      <div v-for="server in mcpServers" :key="server.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <span>{{ server.name }}</span>
                          <el-tag size="small" :type="server.lastStatus === 'ok' ? 'success' : 'info'">{{ server.lastStatus }}</el-tag>
                        </div>
                        <div class="agent-resource-meta">{{ server.serverType }} · {{ server.enabled ? 'enabled' : 'disabled' }}</div>
                        <div v-if="server.lastError" class="agent-step-error">{{ server.lastError }}</div>
                        <el-button size="small" text :loading="mcpTesting" @click="testMcpServer(server.id)">测试连接</el-button>
                      </div>
                      <el-empty v-if="mcpServers.length === 0" description="暂无 MCP Server" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>

                <el-tab-pane label="评测" name="eval">
                  <el-scrollbar class="agent-resource-scroll">
                    <div class="agent-resource-stack">
                      <div class="agent-eval-grid">
                        <div class="agent-eval-stat">
                          <strong>{{ agentStats ? Math.round(agentStats.successRate * 100) : 0 }}%</strong>
                          <span>成功率</span>
                        </div>
                        <div class="agent-eval-stat">
                          <strong>{{ agentStats?.averageScore || 0 }}</strong>
                          <span>平均分</span>
                        </div>
                        <div class="agent-eval-stat">
                          <strong>{{ agentStats?.averageLatencyMs || 0 }}</strong>
                          <span>ms</span>
                        </div>
                        <div class="agent-eval-stat">
                          <strong>{{ agentStats?.averageTokens || 0 }}</strong>
                          <span>tokens</span>
                        </div>
                      </div>

                      <el-input
                        v-model="evaluationForm.expectedOutput"
                        type="textarea"
                        :rows="3"
                        resize="vertical"
                        placeholder="可选：期望答案或关键点"
                      />
                      <el-input
                        v-model="evaluationForm.rubric"
                        type="textarea"
                        :rows="3"
                        resize="vertical"
                        placeholder="可选：自定义评测标准"
                      />
                      <el-button
                        type="primary"
                        plain
                        :loading="agentEvaluationSaving"
                        :disabled="!activeAgentRun"
                        @click="evaluateActiveAgentRun()"
                      >
                        评测当前运行
                      </el-button>

                      <el-divider />
                      <div v-for="evaluation in agentEvaluations" :key="evaluation.id" class="agent-resource-item">
                        <div class="agent-resource-title">
                          <el-tag size="small" :type="agentEvalTagType(evaluation.grade)">{{ evaluation.grade }}</el-tag>
                          <span>{{ evaluation.score }}/100</span>
                        </div>
                        <div class="agent-resource-content">{{ evaluation.summary }}</div>
                        <div class="agent-resource-meta">{{ formatAgentDate(evaluation.createdAt) }}</div>
                      </div>
                      <el-empty v-if="!agentEvaluationLoading && agentEvaluations.length === 0" description="暂无评测记录" :image-size="72" />
                    </div>
                  </el-scrollbar>
                </el-tab-pane>
              </el-tabs>
            </el-card>
          </template>
        </div>
      </template>

      <!-- ========== BATTLE PAGE ========== -->
      <template v-else-if="pageMode === 'battle'">
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

      <!-- ========== GROUP PAGE ========== -->
      <template v-else-if="pageMode === 'group'">
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

      <!-- ========== VISION PAGE ========== -->
      <template v-else-if="pageMode === 'vision'">
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

      <!-- ========== TTS PAGE ========== -->
      <template v-else-if="pageMode === 'tts'">
        <div class="page-header">
          <div class="header-left" style="gap:8px"><strong>语音生成</strong>
            <el-select v-model="ttsModel" filterable placeholder="TTS模型" style="width:220px" size="small">
              <el-option v-for="m in ttsModels" :key="m.id" :label="m.id" :value="m.id" />
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

        <div class="tts-layout">
          <!-- Left: Controls -->
          <div class="tts-sidebar">
            <div class="tts-section">
              <div class="tts-section-title">音色</div>
              <el-radio-group v-model="ttsVoice" class="tts-voice-grid">
                <el-radio-button v-for="v in TTS_VOICES" :key="v.value" :value="v.value" :label="v.label" />
              </el-radio-group>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">模式</div>
              <el-segmented v-model="ttsModeSegment" :options="[
                { label: '朗读', value: 'read' },
                { label: '唱歌', value: 'sing' },
              ]" @change="onTtsModeChange" />
            </div>

            <div v-if="!ttsSingingMode" class="tts-section">
              <div class="tts-section-title">风格标签</div>
              <div class="tts-tag-grid">
                <div v-for="tag in TTS_STYLE_TAGS" :key="tag.value"
                  class="tts-tag-item" :class="{ active: ttsStyleTag === tag.value }"
                  @click="ttsStyleTag = ttsStyleTag === tag.value ? '' : tag.value">
                  {{ tag.label }}
                </div>
              </div>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">音频标签 <span style="font-weight:400;font-size:12px;color:#909399">点击插入文本</span></div>
              <div class="tts-tag-grid">
                <div v-for="tag in TTS_AUDIO_TAGS" :key="tag.value" class="tts-tag-item tts-audio-tag" @click="insertTtsTag(tag.value)">
                  [{{ tag.label }}]
                </div>
              </div>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">风格指令 <span style="font-weight:400;font-size:12px;color:#909399">自然语言描述</span></div>
              <el-input v-model="ttsStyleInstruction" type="textarea" :rows="3" placeholder="如：用欢快明亮的语气，语速稍快" resize="vertical" />
            </div>
          </div>

          <!-- Right: Text + Output -->
          <div class="tts-main">
            <el-card shadow="never" class="tts-card">
              <el-input v-model="ttsText" type="textarea" :rows="8" resize="vertical"
                :placeholder="ttsSingingMode ? '输入歌词（中文效果更佳）...' : '输入要合成的文本...\n可在文本中插入 [叹气] [笑] 等音频标签'" />

              <div class="tts-actions">
                <div class="tts-status">
                  <el-text v-if="ttsStyleTag && !ttsSingingMode" type="info" size="small">风格：{{ ttsStyleTag }}</el-text>
                  <el-text v-if="ttsSingingMode" type="warning" size="small">唱歌模式</el-text>
                </div>
                <el-button type="primary" size="large" :loading="ttsAudioLoading" @click="generateTts()" :disabled="!ttsText.trim()">
                  {{ ttsAudioLoading ? '生成中...' : '生成语音' }}
                </el-button>
              </div>
            </el-card>

            <el-alert v-if="ttsError" type="error" :title="ttsError" :closable="false" show-icon style="margin-top:12px" />

            <el-card v-if="ttsAudioUrl" shadow="never" class="tts-card tts-player-card">
              <div class="tts-player">
                <audio ref="ttsAudioRef" :src="ttsAudioUrl" controls style="width:100%"></audio>
              </div>
            </el-card>

            <!-- History -->
            <div v-if="ttsHistory.length > 0" class="tts-history">
              <div class="tts-section-title" style="margin-bottom:8px">历史记录</div>
              <div v-for="(item, idx) in ttsHistory" :key="idx" class="tts-history-item">
                <div class="tts-history-info">
                  <el-text size="small" truncated style="max-width:400px">{{ item.text }}</el-text>
                  <el-tag size="small" type="info">{{ item.voice }}</el-tag>
                  <el-tag v-if="item.style" size="small">{{ item.style }}</el-tag>
                </div>
                <audio :src="item.url" controls style="width:100%;margin-top:4px"></audio>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ========== MULTIMODAL BETA PAGE ========== -->
      <template v-else-if="pageMode === 'multimodal'">
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>多模态 Beta</strong>
            <el-select v-model="multimodalModel" filterable placeholder="视觉模型" style="width:200px" size="small">
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
                    <el-dropdown-item command="console"><el-icon><DataAnalysis /></el-icon> 控制台</el-dropdown-item>
                    <el-dropdown-item v-if="userInvitationCode" disabled>
                      <span style="color:#666;">邀请码：{{ userInvitationCode }}</span>
                      <el-button size="small" style="margin-left:8px" @click.stop="copyToClipboard(userInvitationCode)">复制</el-button>
                    </el-dropdown-item>
                    <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </div>
        </div>

        <div class="multimodal-page">
          <el-tabs v-model="multimodalTab" type="border-card" class="mm-tabs">
            <!-- ====== Tab 1: Autonomous Driving Simulation ====== -->
            <el-tab-pane label="自动驾驶仿真" name="driving">
              <div class="driving-layout">
                <div class="driving-main">
                  <div class="driving-canvas-wrap">
                    <canvas ref="drivingCanvasRef" class="driving-canvas" />
                    <div v-if="!drivingRunning" class="driving-overlay">
                      <el-icon :size="48" color="#fff"><VideoCamera /></el-icon>
                      <span>点击下方「启动仿真」开始</span>
                    </div>
                  </div>
                  <div class="driving-hud">
                    <div class="hud-item">
                      <span class="hud-label">速度</span>
                      <span class="hud-value" style="color:#3b82f6">{{ Math.round(drivingSpeed) }} <small>km/h</small></span>
                    </div>
                    <div class="hud-item">
                      <span class="hud-label">FPS</span>
                      <span class="hud-value" style="color:#22c55e">{{ drivingStats.fps }}</span>
                    </div>
                    <div class="hud-item">
                      <span class="hud-label">检测目标</span>
                      <span class="hud-value" style="color:#f59e0b">{{ drivingStats.objects }}</span>
                    </div>
                    <div class="hud-item">
                      <span class="hud-label">车道偏离</span>
                      <span class="hud-value" :style="{ color: Math.abs(drivingStats.laneDev) > 30 ? '#ef4444' : '#8b5cf6' }">{{ drivingStats.laneDev }} <small>px</small></span>
                    </div>
                  </div>
                </div>
                <div class="driving-panel">
                  <el-card shadow="never" class="driving-card">
                    <template #header><strong>仿真控制</strong></template>
                    <div class="driving-controls">
                      <div class="control-row">
                        <span>速度 (km/h)</span>
                        <el-slider v-model="drivingSpeed" :min="0" :max="120" :step="5" show-input :disabled="!drivingRunning" />
                      </div>
                      <div class="control-row">
                        <span>转向</span>
                        <el-slider v-model="drivingSteering" :min="-1" :max="1" :step="0.05" show-input :disabled="drivingAutoPilot" />
                      </div>
                      <div class="control-row">
                        <span>自动驾驶</span>
                        <el-switch v-model="drivingAutoPilot" />
                      </div>
                      <div class="control-row">
                        <span>AI 分析间隔 ({{ drivingAiIntervalSec }}秒)</span>
                        <el-slider v-model="drivingAiIntervalSec" :min="1" :max="10" :step="1" show-input />
                      </div>
                      <div class="control-actions">
                        <el-button v-if="!drivingRunning" type="primary" :icon="VideoCamera" @click="startDrivingSim()">启动仿真</el-button>
                        <el-button v-else type="danger" :icon="SwitchButton" @click="stopDrivingSim()">停止仿真</el-button>
                      </div>
                    </div>
                  </el-card>
                  <el-card shadow="never" class="driving-card">
                    <template #header>
                      <div style="display:flex;align-items:center;justify-content:space-between">
                        <strong>AI 场景分析</strong>
                        <el-button v-if="drivingRunning && !drivingAiAnalyzing" size="small" type="primary" @click="analyzeDrivingScene()">分析当前场景</el-button>
                        <el-button v-if="drivingAiAnalyzing" size="small" type="danger" @click="stopDrivingAnalysis()">停止</el-button>
                      </div>
                    </template>
                    <div class="driving-analysis">
                      <div v-if="!drivingAiAnalysis && !drivingAiAnalyzing" style="color:#909399;font-size:13px;text-align:center;padding:20px 0">
                        点击「分析当前场景」调用视觉模型分析驾驶画面
                      </div>
                      <div v-else-if="drivingAiAnalyzing && !drivingAiAnalysis" style="color:#909399;font-size:13px;text-align:center;padding:20px 0">
                        正在调用视觉模型分析驾驶场景...
                      </div>
                      <div v-else class="markdown-content" v-html="renderMarkdown(drivingAiAnalysis)" style="font-size:13px;line-height:1.6"></div>
                    </div>
                  </el-card>
                </div>
              </div>
            </el-tab-pane>

            <!-- ====== Tab 2: Video Understanding ====== -->
            <el-tab-pane label="视频理解" name="video">
              <div class="video-layout">
                <div class="video-player-section">
                  <el-card shadow="never">
                    <template #header><strong>视频播放</strong></template>
                    <div v-if="!videoUrl" class="video-upload-area" @click="openVideoUploadInput()">
                      <el-icon :size="48" color="#c0c4cc"><VideoCamera /></el-icon>
                      <p>点击上传视频文件 (MP4, WebM)</p>
                      <input id="video-upload-input" type="file" accept="video/*" style="display:none" @change="handleVideoUpload" />
                    </div>
                    <div v-else class="video-player-wrap">
                      <video ref="videoRef" :src="videoUrl" controls style="width:100%;max-height:360px;border-radius:8px" />
                      <div style="margin-top:8px;display:flex;gap:8px">
                        <el-button size="small" @click="videoUrl = ''; videoFile = null; videoAnalysis = []">清除</el-button>
                        <el-button v-if="!videoAnalysisRunning" size="small" type="primary" @click="runVideoAnalysis()">开始分析</el-button>
                        <el-button v-else size="small" type="danger" @click="stopVideoAnalysis()">停止分析</el-button>
                      </div>
                    </div>
                  </el-card>
                </div>
                <div class="video-results-section">
                  <el-card shadow="never">
                    <template #header>
                      <div style="display:flex;align-items:center;justify-content:space-between">
                        <strong>分析结果</strong>
                        <el-tag v-if="videoAnalysisRunning" size="small" type="warning">分析中...</el-tag>
                      </div>
                    </template>
                    <div v-if="videoAnalysis.length === 0" style="color:#909399;font-size:13px;text-align:center;padding:40px 0">
                      <el-icon :size="36"><DataAnalysis /></el-icon>
                      <p>尚未进行分析，请先上传视频并点击"开始分析"</p>
                    </div>
                    <el-scrollbar v-else max-height="360px">
                      <div v-for="(item, idx) in videoAnalysis" :key="idx" class="video-result-item">
                        <div class="vr-header">
                          <span class="vr-time">{{ item.time.toFixed(1) }}s</span>
                          <el-tag size="small" :type="item.confidence > 0.85 ? 'success' : 'warning'">{{ item.label }}</el-tag>
                          <span class="vr-conf">{{ (item.confidence * 100).toFixed(0) }}%</span>
                        </div>
                        <div v-if="item.bbox" class="vr-bbox">
                          bbox: [{{ item.bbox.map(v => Math.round(v)).join(', ') }}]
                        </div>
                      </div>
                    </el-scrollbar>
                  </el-card>
                </div>
              </div>
            </el-tab-pane>

            <!-- ====== Tab 3: Image-Text Retrieval ====== -->
            <el-tab-pane label="图文检索" name="retrieval">
              <div class="retrieval-section">
                <div class="retrieval-search">
                  <el-input v-model="retrievalQuery" placeholder="输入检索关键词，如：城市交通、自动驾驶场景、道路标识..." size="large" @keyup.enter="searchImages()">
                    <template #append>
                      <el-button :icon="Search" :loading="retrievalLoading" @click="searchImages()">检索</el-button>
                    </template>
                  </el-input>
                </div>
                <div v-if="retrievalResults.length === 0 && !retrievalLoading" class="retrieval-empty">
                  <el-empty description="输入关键词开始图文检索" :image-size="96">
                    <template #image>
                      <el-icon :size="44" style="color:#8b5cf6"><PictureFilled /></el-icon>
                    </template>
                  </el-empty>
                </div>
                <div v-else class="retrieval-grid">
                  <el-card v-for="item in retrievalResults" :key="item.id" shadow="hover" class="retrieval-card" body-style="padding:0">
                    <img :src="item.url" :alt="item.title" style="width:100%;height:140px;object-fit:cover;border-radius:4px 4px 0 0" loading="lazy" />
                    <div class="retrieval-info">
                      <div class="retrieval-title">{{ item.title }}</div>
                      <div class="retrieval-sim">
                        <el-progress :percentage="item.sim" :color="item.sim > 80 ? '#22c55e' : item.sim > 60 ? '#f59e0b' : '#ef4444'" :stroke-width="6" />
                        <span style="font-size:11px;color:#909399">相似度 {{ item.sim }}%</span>
                      </div>
                    </div>
                  </el-card>
                </div>
              </div>
            </el-tab-pane>

            <!-- ====== Tab 4: Multimodal Chat ====== -->
            <el-tab-pane label="多模态对话" name="chat">
              <div style="display:flex;flex-direction:column;height:100%">
                <div class="thread" style="flex:1">
                  <div v-if="mmChatMessages.length === 0" class="group-empty">
                    <el-empty description="上传图片/音频/视频并提问，体验真正的多模态对话。" :image-size="96">
                      <template #image>
                        <el-icon :size="44" style="color:#8b5cf6"><ChatDotRound /></el-icon>
                      </template>
                    </el-empty>
                  </div>
                  <template v-for="msg in mmChatMessages" :key="msg.id">
                    <div class="chat-bubble" :class="msg.role === 'user' ? 'is-user' : ''">
                      <el-avatar :size="36" :icon="msg.role === 'user' ? User : Cpu" :style="{ backgroundColor: msg.role === 'user' ? '#1677ff' : '#8b5cf6', flexShrink: 0 }" />
                      <div class="bubble-body">
                        <div class="bubble-name">{{ msg.role === 'user' ? '你' : '多模态助手' }}</div>
                        <!-- User media attachments -->
                        <div v-if="msg.role === 'user' && msg.image" style="margin-bottom:8px">
                          <img :src="msg.image" style="max-width:260px;max-height:180px;border-radius:8px;cursor:pointer" @click="openImageInNewTab(msg.image)" />
                        </div>
                        <div v-if="msg.role === 'user' && msg.audio" style="margin-bottom:8px">
                          <audio :src="msg.audio" controls style="max-width:260px;height:36px" />
                        </div>
                        <div v-if="msg.role === 'user' && msg.video" style="margin-bottom:8px">
                          <video :src="msg.video" controls style="max-width:260px;max-height:160px;border-radius:8px" />
                        </div>
                        <div v-if="msg.role === 'assistant'" class="markdown-content" v-html="renderMarkdown(msg.content || (isMmChatSubmitting ? '正在分析...' : ''))"></div>
                        <p v-else>{{ msg.content }}</p>
                      </div>
                    </div>
                  </template>
                </div>
                <div class="composer">
                  <el-card class="composer-card" shadow="never">
                    <!-- Image previews (multi-image support) -->
                    <div v-if="mmChatImages.length > 0" style="margin-bottom:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <div v-for="(img, idx) in mmChatImages" :key="idx" style="display:flex;align-items:center;gap:4px;background:#f1f5f9;border-radius:6px;padding:4px 8px">
                        <img :src="img.base64" style="height:32px;border-radius:4px" />
                        <span style="font-size:11px;color:#606266;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ img.name }}</span>
                        <el-button size="small" text type="danger" @click="removeMmMedia(idx)" style="padding:0 4px">✕</el-button>
                      </div>
                    </div>
                    <!-- Audio preview -->
                    <div v-if="mmChatAudioBase64 && mmChatMediaType === 'audio'" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
                      <el-tag type="success" size="small">🎵 音频</el-tag>
                      <span style="font-size:12px;color:#909399">{{ mmChatAudioName }}</span>
                      <el-button size="small" text type="danger" @click="removeMmMedia()">移除</el-button>
                    </div>
                    <!-- Video preview -->
                    <div v-if="mmChatVideoUrl && mmChatMediaType === 'video'" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
                      <el-tag type="warning" size="small">🎬 视频</el-tag>
                      <span style="font-size:12px;color:#909399">{{ mmChatVideoName }}</span>
                      <el-button size="small" text type="danger" @click="removeMmMedia()">移除</el-button>
                    </div>
                    <div style="display:flex;gap:8px">
                      <el-input v-model="mmChatPrompt" type="textarea" :rows="2" resize="vertical" placeholder="输入问题，支持图片、音频、视频多模态对话..." @keydown.enter.exact.prevent="submitMmChat()" @compositionstart="isComposing = true" @compositionend="isComposing = false" style="flex:1" :disabled="isMmChatSubmitting" />
                    </div>
                    <div class="composer-bar">
                      <div class="composer-meta" style="display:flex;gap:6px">
                        <el-button size="small" @click="mmChatFileRef?.click()">📷 图片</el-button>
                        <input :ref="(el: any) => { mmChatFileRef = el }" type="file" accept="image/*" style="display:none" @change="handleMmImageUpload" />
                        <el-button size="small" @click="mmChatAudioRef?.click()">🎵 音频</el-button>
                        <input :ref="(el: any) => { mmChatAudioRef = el }" type="file" accept="audio/*" style="display:none" @change="handleMmAudioUpload" />
                        <el-button size="small" @click="mmChatVideoRef?.click()">🎬 视频</el-button>
                        <input :ref="(el: any) => { mmChatVideoRef = el }" type="file" accept="video/*" style="display:none" @change="handleMmVideoUpload" />
                      </div>
                      <div class="composer-actions">
                        <el-button :icon="Delete" @click="clearMmChat()">清空</el-button>
                        <el-button v-if="isMmChatSubmitting" type="danger" :icon="SwitchButton" @click="stopMmChat()">停止</el-button>
                        <el-button v-else type="primary" :icon="Promotion" @click="submitMmChat()" :disabled="!mmChatPrompt.trim() || isMmChatSubmitting">{{ '发送' }}</el-button>
                      </div>
                    </div>
                  </el-card>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>

      <!-- ========== COLLAB PAGE ========== -->
      <template v-else-if="pageMode === 'collab'">
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

      <!-- ========== ROUTER PAGE ========== -->
      <template v-else-if="pageMode === 'router'">
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

      <!-- ========== DOCS PAGE ========== -->
      <template v-else-if="pageMode === 'docs'">
        <div class="page-header">
          <div class="header-left"><strong>功能文档</strong></div>
          <div class="header-right">
            <el-tag size="small" type="info">v1.0</el-tag>
          </div>
        </div>
        <div class="thread" style="flex:1;max-width:900px;margin:0 auto;width:100%;padding:24px 16px">

          <!-- Hero -->
          <div style="text-align:center;padding:32px 20px 24px">
            <el-icon :size="48" color="#8b5cf6"><Cpu /></el-icon>
            <h1 style="margin:12px 0 6px;font-size:28px;font-weight:800;color:#1e293b">LLM Gather</h1>
            <p style="color:#64748b;font-size:15px;max-width:600px;margin:0 auto">大模型 API 聚合平台 — 统一接入多家 AI 厂商模型，提供智能路由、协同推理、语义缓存、多模态融合等能力</p>
          </div>

          <!-- Feature Cards Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px">

            <!-- Chat -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="ChatDotRound" style="background:#3b82f6" />
                  <strong>聊天 Chat</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>与 AI 模型对话，支持 Markdown 渲染、代码高亮、思考过程展示。</p>
                <p><el-tag size="small" type="danger">Auto 智能路由</el-tag> LLM 分析意图 → 自动选模型</p>
                <p>流式 SSE 输出 · 会话管理 · 云端同步</p>
              </div>
            </el-card>

            <!-- Battle -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Lightning" style="background:#f59e0b" />
                  <strong>对战 Battle</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>双模型并发回答，左右分栏实时对比。</p>
                <p>随机/指定模型 · 并行流式输出</p>
                <p>展示思考过程 · 自动保存结果</p>
              </div>
            </el-card>

            <!-- Collab -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="TrendCharts" style="background:#8b5cf6" />
                  <strong>协同推理 Collab</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>多模型深度协同，三种模式：</p>
                <p><el-tag size="small">辩论</el-tag> <el-tag size="small" type="warning">评审</el-tag> <el-tag size="small" type="success">分工</el-tag></p>
                <p>模型选择 · 迭代优化 · 汇总合成</p>
              </div>
            </el-card>

            <!-- Group -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="UserFilled" style="background:#22c55e" />
                  <strong>群聊 Group</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>所有模型依次发言，参考前文回复。</p>
                <p>完整对话历史作为上下文</p>
                <p>支持中途停止</p>
              </div>
            </el-card>

            <!-- Vision -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Monitor" style="background:#ec4899" />
                  <strong>视觉理解 Vision</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>上传图片让视觉模型分析识别。</p>
                <p>多图支持 · 模型记忆 · 流式回复</p>
              </div>
            </el-card>

            <!-- TTS -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Headset" style="background:#ef4444" />
                  <strong>语音生成 TTS</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>文字转语音，8 种发音人可选。</p>
                <p>风格标签 · 唱歌模式 · 历史记录</p>
              </div>
            </el-card>

            <!-- Multimodal -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="VideoCamera" style="background:#6366f1" />
                  <strong>多模态 Beta</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>自动驾驶仿真 · 视频理解 · 图文检索 · 多模态对话</p>
                <p>多图+音频+视频输入 · AI 驾驶决策</p>
              </div>
            </el-card>

            <!-- Console -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="DataAnalysis" style="background:#10b981" />
                  <strong>控制台 Console</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>账户余额 · 用量趋势图 · 定价表</p>
                <p>消费流水 · 支付宝充值</p>
              </div>
            </el-card>

            <!-- Admin -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Setting" style="background:#6b7280" />
                  <strong>管理后台 Admin</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>用户管理 · 计费管理 · 模型统计</p>
                <p>Provider 配置 · 系统设置 · 热加载</p>
              </div>
            </el-card>

            <!-- API -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Document" style="background:#2563eb" />
                  <strong>API 用法</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>OpenAI 兼容接口 /v1/chat/completions</p>
                <p>API Key + JWT 双认证</p>
                <p>curl · Python · JavaScript 示例</p>
              </div>
            </el-card>
          </div>

          <!-- Core Tech Section -->
          <el-card shadow="never" style="margin-bottom:16px">
            <template #header><strong>核心技术特性</strong></template>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;font-size:13px;color:#475569">
              <div><strong>🤖 智能路由</strong><br/>LLM 意图分类 → 选模型，额外延迟 &lt;1s</div>
              <div><strong>💾 语义缓存</strong><br/>Jaccard+Levenshtein 相似度匹配</div>
              <div><strong>🧠 协同推理</strong><br/>辩论/评审/分工 三种模式</div>
              <div><strong>🎯 多模态融合</strong><br/>视频关键帧 · 多图对话</div>
              <div><strong>💰 计费系统</strong><br/>按 token·分档定价·流式扣费</div>
              <div><strong>🔄 Provider 热加载</strong><br/>管理后台修改即时生效</div>
              <div><strong>🔐 双认证</strong><br/>JWT + API Key (sk-xxx)</div>
              <div><strong>🌙 暗色模式</strong><br/>全页面暗色主题适配</div>
              <div><strong>🐳 Docker</strong><br/>MySQL+NestJS+Vue3 一键部署</div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header><strong>架构</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569;font-family:monospace">
              <div>前端 Vue3 → api.ts → /v1/chat/completions</div>
              <div style="margin-left:16px">→ ChatController (ApiKeyOrJwtGuard)</div>
              <div style="margin-left:32px">→ RouterService (model='auto' → LLM 分类 → 选模型)</div>
              <div style="margin-left:32px">→ ChatService → ProviderRegistry → OpenAI Compatible</div>
              <div style="margin-left:32px">→ CacheService (语义缓存查/存)</div>
            </div>
          </el-card>

          <!-- Smart Routing Detail -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>🤖 Auto 智能路由工作原理</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569">
              <p>当你选择 <el-tag size="small" type="danger">Auto</el-tag> 模型发送消息时：</p>
              <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:8px 0;font-family:monospace;font-size:12px">
                <div>1. 提取用户消息文本 → 发给 <strong>qwen-turbo</strong> 做意图分类</div>
                <div style="margin-left:16px">分类 prompt: "Classify into: coding/translation/creative/reasoning/vision/summary/data/general"</div>
                <div style="margin-left:16px">→ LLM 返回: e.g. "coding"</div>
                <div>2. 查路由规则表 (router_rules) → coding → [deepseek-v4-pro, deepseek-v4-flash, qwen-plus]</div>
                <div>3. 过滤到实际可用模型 → 选第一个 (deepseek-v4-pro)</div>
                <div>4. 后端用 deepseek-v4-pro 执行原始请求 → 返回流式输出</div>
                <div>5. 聊天界面显示路由状态: <el-tag size="small" type="danger">Auto</el-tag> → <el-tag size="small" type="warning">编程开发</el-tag> deepseek-v4-pro</div>
              </div>
              <p>额外延迟仅约 <strong>0.5-1秒</strong>（分类模型调用）。路由规则可在管理后台编辑。</p>
            </div>
          </el-card>

          <!-- Available Models -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>接入的模型厂商 (Provider)</strong></template>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;font-size:13px">
              <div v-for="m in models" :key="m.id" style="padding:6px 10px;background:#f8fafc;border-radius:6px;display:flex;align-items:center;gap:6px">
                <el-tag size="small" :type="getModelTags(m.id).includes('vision') ? 'warning' : getModelTags(m.id).includes('audio') ? 'success' : ''">{{ m.owned_by }}</el-tag>
                <span style="font-size:12px;color:#475569">{{ m.id }}</span>
              </div>
              <div v-if="models.length === 0" style="color:#909399;padding:12px">登录后自动加载模型列表</div>
            </div>
          </el-card>

          <!-- Quick Start -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>快速开始</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569">
              <p><strong>1.</strong> 注册/登录账号（支持邮箱验证码注册）</p>
              <p><strong>2.</strong> 聊天页选择 <el-tag size="small" type="danger">Auto</el-tag> 或指定模型，开始对话</p>
              <p><strong>3.</strong> 尝试 <strong>对战</strong> — 两个模型 PK 同一问题</p>
              <p><strong>4.</strong> 尝试 <strong>协同推理</strong> — 多模型协作输出最优答案</p>
              <p><strong>5.</strong> 上传图片到 <strong>视觉理解</strong>，让 AI 看图说话</p>
              <p><strong>6.</strong> 进入 <strong>多模态 Beta</strong> — 体验自动驾驶仿真和视频分析</p>
              <p><strong>7.</strong> 在 <strong>控制台</strong> 查看用量、通过支付宝充值</p>
              <p><strong>8.</strong> 在 <strong>API 用法</strong> 页面创建 API Key，通过 OpenAI 兼容接口调用</p>
            </div>
          </el-card>

        </div>
      </template>

      <!-- ========== CONSOLE PAGE ========== -->
      <template v-else-if="pageMode === 'console'">
        <div class="page-header">
          <div class="header-left"><strong>控制台</strong></div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
            <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
            <el-dropdown v-else trigger="click" @command="handleUserMenu">
              <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            </template>
          </div>
        </div>

        <div class="console-page">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以查看控制台" style="margin-bottom: 16px" />
          <template v-else-if="isAuthenticated">
            <el-card shadow="never" class="console-section">
              <template #header><strong>账户信息</strong></template>
              <div class="console-stats-grid">
                <div class="console-stat-card"><div class="console-stat-label">用户名</div><div class="console-stat-value">{{ authUser?.username }}</div></div>
                <div class="console-stat-card highlight"><div class="console-stat-label">余额</div><div class="console-stat-value">￥{{ authCreditsText }}</div></div>
                <div class="console-stat-card"><div class="console-stat-label">累计消费</div><div class="console-stat-value">￥{{ authSpentText }}</div></div>
                <div class="console-stat-card"><div class="console-stat-label">注册时间</div><div class="console-stat-value">{{ formatTime(authUser?.createdAt) }}</div></div>
              </div>
              <el-divider />
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <span style="font-size:14px;color:#374151">在线充值：</span>
                <el-button type="primary" @click="openRechargeDialog()">支付宝当面付</el-button>
              </div>
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>充值记录</strong>
                  <el-button text size="small" @click="loadRechargeOrders()" :loading="rechargeOrdersLoading">刷新</el-button>
                </div>
              </template>
              <el-table v-if="rechargeOrders.length > 0" :data="rechargeOrders" size="small" max-height="240">
                <el-table-column prop="amount" label="金额" width="80">
                  <template #default="{ row }">￥{{ row.amount }}</template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'paid' ? 'success' : row.status === 'pending' ? 'warning' : 'info'" size="small">
                      {{ row.status === 'paid' ? '已支付' : row.status === 'pending' ? '待支付' : row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="alipayTradeNo" label="支付宝交易号" min-width="160">
                  <template #default="{ row }">{{ row.alipayTradeNo || '-' }}</template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" min-width="140">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column prop="paidAt" label="支付时间" min-width="140">
                  <template #default="{ row }">{{ row.paidAt ? formatTime(row.paidAt) : '-' }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无充值记录" :image-size="48" style="padding:20px 0" />
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>用量趋势</strong>
                  <el-segmented
                    :model-value="String(consoleChartDays)"
                    @change="(val: string | number) => { consoleChartDays = Number(val); loadConsoleDailyUsage(); }"
                    :options="[
                      { label: '7天', value: '7' },
                      { label: '30天', value: '30' },
                      { label: '90天', value: '90' },
                    ]"
                    size="small"
                  />
                </div>
              </template>
              <div v-if="consoleDailyUsage.length > 0" id="console-chart" style="width:100%;height:260px"></div>
              <el-empty v-else description="暂无用量数据" :image-size="48" style="padding:30px 0" />
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>计费规则</strong>
                  <span style="font-size:11px;color:#9ca3af">元 / 千 token</span>
                </div>
              </template>
              <el-table :data="consolePricingRows" stripe style="width:100%">
                <el-table-column label="档位" width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.tagType" size="small">{{ row.label }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="模型举例" min-width="250">
                  <template #default="{ row }">{{ row.sampleModels }}</template>
                </el-table-column>
                <el-table-column label="输入价格" width="130" align="center">
                  <template #default="{ row }">¥{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格" width="130" align="center">
                  <template #default="{ row }">¥{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
                <template #empty><el-empty description="暂无计费规则" :image-size="48" /></template>
              </el-table>
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header><strong>用量明细</strong></template>
              <el-table :data="billingLedger" stripe style="width:100%">
                <template #empty><el-empty description="暂无用量记录，使用 API 后将自动记录" :image-size="48" /></template>
                <el-table-column prop="model" label="模型" min-width="220" />
                <el-table-column prop="requestType" label="请求类型" min-width="120" />
                <el-table-column prop="promptTokens" label="输入Token" min-width="130" />
                <el-table-column prop="completionTokens" label="输出Token" min-width="130" />
                <el-table-column prop="cost" label="费用" min-width="110" />
                <el-table-column label="时间" min-width="200">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </template>
        </div>
      </template>

      <!-- ========== API DOCS PAGE ========== -->
      <template v-else-if="pageMode === 'api'">
        <div class="page-header">
          <div class="header-left"><strong>API 用法</strong></div>
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
            </template>
          </div>
        </div>

        <div class="api-docs-page">
          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <strong>中转 API Key</strong>
                <el-button type="primary" size="small" @click="openCreateApiKey()">创建新 Key</el-button>
              </div>
            </template>
            <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以管理 API Key" />
            <template v-else>
              <el-table :data="apiKeys" stripe size="small" v-if="apiKeys.length > 0">
                <el-table-column label="Key" min-width="320">
                  <template #default="{ row }">
                    <code style="font-size:12px;word-break:break-all">{{ row.maskedKey }}</code>
                    <el-button size="small" text type="primary" @click="copyToClipboard(row.fullKey || row.maskedKey)">复制</el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="name" label="名称" width="140" />
                <el-table-column label="创建时间" width="180">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-popconfirm title="确定要删除这个 API Key 吗？删除后使用该 Key 的请求将立即失败。" @confirm="revokeApiKey(row.id)">
                      <template #reference>
                        <el-button size="small" text type="danger">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="还没有 API Key，点击上方按钮创建" :image-size="64" />
            </template>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header><strong>快速开始</strong></template>
            <div class="api-info-grid">
              <div class="api-info-item"><span class="api-info-label">Base URL</span><code class="api-info-value">{{ apiBaseUrl }}</code></div>
              <div class="api-info-item"><span class="api-info-label">认证方式</span><span class="api-info-value">Header <code>Authorization: Bearer sk-xxxx</code></span></div>
              <div class="api-info-item"><span class="api-info-label">API Key</span><span class="api-info-value">上方创建的 Key，以 <code>sk-</code> 开头，可替代 JWT Token 用于中转接口</span></div>
            </div>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>OpenAI 兼容接口</strong><el-tag size="small" type="success">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/relay/openai/chat/completions</div>
            <div class="api-sub-title">cURL 示例</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/relay/openai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "glm-5.1",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'</pre>
            <div class="api-sub-title">Python SDK</div>
            <pre class="api-code-block">from openai import OpenAI

client = OpenAI(
    base_url="{{ apiBaseUrl }}/relay/openai",
    api_key="sk-your-api-key",
)

resp = client.chat.completions.create(
    model="glm-5.1",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>Anthropic 兼容接口</strong><el-tag size="small" type="warning">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/relay/anthropic/messages</div>
            <div class="api-sub-title">cURL 示例</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/relay/anthropic/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>视觉理解（Vision）</strong><el-tag size="small" type="warning">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/chat/completions</div>
            <div class="api-sub-title">与聊天接口相同，在 messages 中传入 image 类型的 content。支持 base64 编码图片和图片 URL。</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "qwen-vl-plus-latest",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "请描述这张图片"},
        {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
      ]
    }],
    "stream": false
  }'</pre>
            <div class="api-sub-title">或使用 base64 编码</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "qwen-vl-max-latest",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这是什么"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]
    }],
    "stream": false
  }'</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>语音合成（TTS）</strong><el-tag size="small" type="success">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/tts</div>
            <div class="api-sub-title">将文本转为语音，返回音频文件。默认格式为 wav。</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/tts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "mimo-v2.5-tts",
    "input": "你好，欢迎使用 LLMGather TTS 服务",
    "voice": "冰糖",
    "response_format": "wav"
  }' --output speech.wav</pre>
            <div class="api-sub-title">Python 示例</div>
            <pre class="api-code-block">import requests

resp = requests.post(
    "{{ apiBaseUrl }}/tts",
    headers={
        "Authorization": "Bearer sk-your-api-key",
        "Content-Type": "application/json",
    },
    json={
        "model": "mimo-v2.5-tts",
        "input": "你好，世界",
        "voice": "冰糖",
        "response_format": "wav",
    },
)
with open("output.wav", "wb") as f:
    f.write(resp.content)</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header><strong>错误码参考</strong></template>
            <el-table :data="errorCodes" stripe size="small">
              <el-table-column prop="status" label="状态码" width="80" />
              <el-table-column prop="code" label="类型" width="140" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </el-card>
        </div>

        <!-- Create API Key Dialog -->
        <el-dialog v-model="apiKeyCreateDialog" title="创建 API Key" width="420px">
          <el-form label-position="top">
            <el-form-item label="Key 名称">
              <el-input v-model="apiKeyNewName" placeholder="给 Key 取个名字" @keyup.enter="createApiKey()" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="apiKeyCreateDialog = false">取消</el-button>
            <el-button type="primary" :loading="apiKeyLoading" @click="createApiKey()">创建</el-button>
          </template>
        </el-dialog>
      </template>

      <!-- ========== ADMIN PAGE ========== -->
      <template v-else-if="pageMode === 'admin'">
        <div class="page-header">
          <div class="header-left"><strong>管理后台</strong></div>
          <div class="header-right">
            <el-tag v-if="isAdmin" type="warning" effect="dark">管理员</el-tag>
          </div>
        </div>

        <div class="admin-page-content">
          <el-tabs v-model="adminTab" @tab-change="(tab: string | number) => {
            if (tab === 'dashboard') { loadAdminStats(); loadAdminDailyUsage(); loadAdminTodayStats(); loadAdminModelUsage(); }
            else if (tab === 'users') loadAdminUsers();
            else if (tab === 'billing') loadAdminBilling();
            else if (tab === 'modelstats') loadAdminModelUsage();
            else if (tab === 'modeltiers') { loadAdminModelTiers(); if (models.length === 0) loadModels(); refreshBillingData().then(() => initDefaultPriceFields()); }
            else if (tab === 'providers') { loadAdminProviderConfigs(); loadAdminProviderKeyCounts(); }
            else if (tab === 'apikeys') { loadAdminProviderKeys(); loadAdminProviderConfigs(); }
            else if (tab === 'settings') { loadAdminSettings(); }
            else if (tab === 'router') { loadAdminRouterRules(); }
          }">
            <!-- Dashboard Tab -->
            <el-tab-pane label="概览" name="dashboard">
              <div class="admin-stats-grid">
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#eff6ff"><el-icon :size="22" color="#3b82f6"><UserFilled /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalUsers : '—' }}</div>
                    <div class="admin-stat-label">用户总数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#f0fdf4"><el-icon :size="22" color="#22c55e"><Plus /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.newUsersToday : '—' }}</div>
                    <div class="admin-stat-label">今日新增</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fef3c7"><el-icon :size="22" color="#f59e0b"><Coin /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? '¥' + adminStats.totalRevenue.toFixed(2) : '—' }}</div>
                    <div class="admin-stat-label">总收入</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#faf5ff"><el-icon :size="22" color="#a855f7"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalRequests : '—' }}</div>
                    <div class="admin-stat-label">请求总数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fff1f2"><el-icon :size="22" color="#f43f5e"><Cpu /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.activeModels : '—' }}</div>
                    <div class="admin-stat-label">活跃模型</div>
                  </div>
                </div>
              </div>

              <div class="admin-stats-grid" style="margin-top:12px">
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#ecfdf5"><el-icon :size="22" color="#10b981"><Coin /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? '¥' + adminTodayStats.revenue.toFixed(4) : '—' }}</div>
                    <div class="admin-stat-label">今日收入</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#f0f9ff"><el-icon :size="22" color="#0ea5e9"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? adminTodayStats.requests : '—' }}</div>
                    <div class="admin-stat-label">今日请求</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fdf4ff"><el-icon :size="22" color="#d946ef"><Cpu /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalTokens.toLocaleString() : '—' }}</div>
                    <div class="admin-stat-label">总 Token 数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fefce8"><el-icon :size="22" color="#eab308"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? adminTodayStats.tokens.toLocaleString() : '—' }}</div>
                    <div class="admin-stat-label">今日 Token</div>
                  </div>
                </div>
              </div>

              <el-card shadow="never" class="admin-chart-card">
                <template #header>
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <span style="font-weight:600">用量趋势</span>
                    <el-segmented
                      :model-value="String(adminChartDays)"
                      @change="(val: string | number) => { adminChartDays = Number(val); loadAdminDailyUsage(); }"
                      :options="[
                        { label: '7天', value: '7' },
                        { label: '30天', value: '30' },
                        { label: '90天', value: '90' },
                      ]"
                      size="small"
                    />
                  </div>
                </template>
                <div v-if="adminDailyUsage.length > 0" id="admin-chart" style="width:100%;height:300px"></div>
                <el-empty v-else description="暂无用量数据" :image-size="48" style="padding:40px 0" />
              </el-card>

              <el-card shadow="never" class="admin-chart-card">
                <template #header><span style="font-weight:600">模型用量排行 (Top 10)</span></template>
                <div v-if="adminModelUsage.length > 0" id="admin-model-chart" style="width:100%;height:320px"></div>
                <el-empty v-else description="暂无模型用量数据" :image-size="48" style="padding:40px 0" />
              </el-card>
            </el-tab-pane>

            <!-- Users Tab -->
            <el-tab-pane label="用户管理" name="users">
              <div class="admin-toolbar">
                <el-input v-model="adminUsersSearch" placeholder="搜索用户名或邮箱" clearable :prefix-icon="Search" style="width: 260px" @keyup.enter="adminUsersPage = 1; loadAdminUsers()" @clear="adminUsersPage = 1; loadAdminUsers()" />
                <el-button type="primary" plain @click="adminUsersPage = 1; loadAdminUsers()">搜索</el-button>
              </div>
              <el-table :data="adminUsers" stripe size="small" class="admin-table" v-loading="adminUsers.length === 0 && adminUsersTotal === 0">
                <el-table-column prop="username" label="用户名" min-width="100" />
                <el-table-column prop="email" label="邮箱" min-width="160">
                  <template #default="{ row }">{{ row.email || '-' }}</template>
                </el-table-column>
                <el-table-column prop="role" label="角色" width="70">
                  <template #default="{ row }">
                    <el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small">{{ row.role }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="credits" label="余额" width="100">
                  <template #default="{ row }">{{ row.credits.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column prop="totalSpent" label="累计消费" width="100">
                  <template #default="{ row }">{{ row.totalSpent.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column prop="requestCount" label="请求数" width="80" align="center" />
                <el-table-column prop="invitationCode" label="邀请码" width="100">
                  <template #default="{ row }">
                    <span v-if="row.invitationCode" class="copyable-code">{{ row.invitationCode }}</span>
                    <span v-else style="color:#999">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="注册时间" min-width="150">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="60" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'edit') openEditUser(row); else if (cmd === 'billing') viewUserBilling(row.id); else if (cmd === 'pwd') openResetPassword(row); else if (cmd === 'delete') handleDeleteUser(row.id); }">
                      <el-button :icon="MoreFilled" link type="primary" />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="edit"><el-icon><EditPen /></el-icon> 编辑</el-dropdown-item>
                          <el-dropdown-item command="billing"><el-icon><DataAnalysis /></el-icon> 账单</el-dropdown-item>
                          <el-dropdown-item command="pwd"><el-icon><Setting /></el-icon> 重置密码</el-dropdown-item>
                          <el-dropdown-item v-if="row.role !== 'admin'" command="delete" divided style="color:#f56c6c"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-if="adminUsersTotal > 50"
                v-model:current-page="adminUsersPage"
                :page-size="50"
                :total="adminUsersTotal"
                layout="total, prev, pager, next"
                class="admin-pagination"
                @current-change="loadAdminUsers()"
              />
            </el-tab-pane>

            <!-- Billing Tab -->
            <el-tab-pane label="计费明细" name="billing">
              <div class="admin-toolbar" style="flex-wrap:wrap;gap:8px">
                <el-input v-model="adminBillingFilterUserId" placeholder="用户ID" clearable style="width: 180px" @keyup.enter="loadAdminBillingWithDates()" @clear="loadAdminBillingWithDates()" />
                <el-input v-model="adminBillingFilterModel" placeholder="模型" clearable style="width: 140px" @keyup.enter="loadAdminBillingWithDates()" @clear="loadAdminBillingWithDates()" />
                <el-date-picker v-model="adminBillingFromDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:150px" clearable @change="loadAdminBillingWithDates()" />
                <el-date-picker v-model="adminBillingToDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:150px" clearable @change="loadAdminBillingWithDates()" />
                <el-button type="primary" plain @click="loadAdminBillingWithDates()">筛选</el-button>
                <el-button type="success" plain @click="handleExportBillingCsv()">导出 CSV</el-button>
              </div>
              <el-table :data="adminBilling" stripe size="small" class="admin-table">
                <el-table-column prop="username" label="用户" min-width="90" />
                <el-table-column prop="model" label="模型" min-width="140" />
                <el-table-column prop="requestType" label="类型" width="70" />
                <el-table-column prop="promptTokens" label="输入Tokens" width="100" align="right" />
                <el-table-column prop="completionTokens" label="输出Tokens" width="100" align="right" />
                <el-table-column prop="totalTokens" label="总Tokens" width="100" align="right" />
                <el-table-column prop="cost" label="费用" width="100" align="right">
                  <template #default="{ row }">{{ row.cost.toFixed(6) }}</template>
                </el-table-column>
                <el-table-column prop="createdAt" label="时间" min-width="160">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-if="adminBillingTotal > 50"
                v-model:current-page="adminBillingPage"
                :page-size="50"
                :total="adminBillingTotal"
                layout="total, prev, pager, next"
                class="admin-pagination"
                @current-change="loadAdminBilling()"
              />
              <div v-if="adminBilling.length > 0" class="admin-billing-summary">
                <span>本页合计：</span>
                <span>总 Token: <strong>{{ adminBilling.reduce((s, r) => s + r.totalTokens, 0).toLocaleString() }}</strong></span>
                <span>总费用: <strong>¥{{ adminBilling.reduce((s, r) => s + r.cost, 0).toFixed(6) }}</strong></span>
                <span style="color:#909399">（共 {{ adminBillingTotal }} 条记录）</span>
              </div>
            </el-tab-pane>


            <!-- Model Stats Tab -->
            <el-tab-pane label="用量统计" name="modelstats">
              <el-table :data="adminModelUsage" stripe size="small" class="admin-table" :default-sort="{ prop: 'requests', order: 'descending' }">
                <el-table-column prop="model" label="模型" min-width="180" sortable />
                <el-table-column prop="providerName" label="服务商" width="120" sortable />
                <el-table-column prop="requests" label="请求数" width="100" align="right" sortable />
                <el-table-column prop="promptTokens" label="输入 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.promptTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="completionTokens" label="输出 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.completionTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="totalTokens" label="总 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.totalTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="totalCost" label="总费用" width="120" align="right" sortable>
                  <template #default="{ row }">¥{{ row.totalCost.toFixed(6) }}</template>
                </el-table-column>
                <el-table-column prop="avgCost" label="平均费用" width="120" align="right" sortable>
                  <template #default="{ row }">¥{{ row.avgCost.toFixed(6) }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-if="adminModelUsage.length === 0" description="暂无模型用量数据" :image-size="48" />
            </el-tab-pane>

            <!-- Provider Config Tab -->
            <el-tab-pane label="服务商" name="providers">
              <div style="margin-bottom: 16px">
                <el-button type="primary" :icon="Plus" @click="openAddConfig()">添加服务商</el-button>
              </div>
              <el-table :data="adminProviderConfigs" stripe size="small" class="admin-table" empty-text="暂无服务商配置">
                <el-table-column prop="displayName" label="名称" min-width="140" />
                <el-table-column prop="providerName" label="标识符" width="120" />
                <el-table-column prop="baseUrl" label="端点" min-width="220">
                  <template #default="{ row }"><span style="font-size:12px;color:#909399">{{ row.baseUrl }}</span></template>
                </el-table-column>
                <el-table-column label="模型数" width="80" align="center">
                  <template #default="{ row }">{{ row.models ? row.models.split(',').filter(Boolean).length : 0 }}</template>
                </el-table-column>
                <el-table-column label="Key 数" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" :type="adminProviderKeyCounts[row.providerName] > 0 ? 'success' : 'info'">
                      {{ adminProviderKeyCounts[row.providerName] ?? '...' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-switch :model-value="row.enabled" size="small" @click="toggleProvider(row)" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link :icon="EditPen" @click="openEditConfig(row)">编辑</el-button>
                    <el-popconfirm title="确定要删除该服务商及其所有 Key 吗？" @confirm="deleteProviderConfig(row.id)">
                      <template #reference>
                        <el-button type="danger" link :icon="Delete">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- API Key Management Tab -->
            <el-tab-pane label="API Key" name="apikeys">
              <div style="margin-bottom: 16px;display:flex;gap:12px;align-items:center">
                <el-button type="primary" :icon="Plus" @click="openAddProviderKey()">添加 Key</el-button>
                <el-select v-model="adminApiKeyProviderFilter" placeholder="按 Provider 筛选" clearable style="width:200px" @change="loadAdminProviderKeys()">
                  <el-option v-for="cfg in adminProviderConfigs" :key="cfg.providerName" :label="cfg.displayName" :value="cfg.providerName" />
                </el-select>
              </div>
              <el-table :data="adminProviderKeys" stripe size="small" class="admin-table" empty-text="暂无 Provider API Key，请添加或检查 .env 配置">
                <el-table-column prop="providerName" label="Provider" width="130" />
                <el-table-column prop="name" label="名称" min-width="140" />
                <el-table-column label="API Key" min-width="280">
                  <template #default="{ row }">
                    <code style="font-size:12px;word-break:break-all;user-select:all">{{ row.apiKey }}</code>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" width="170">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-popconfirm title="确定要删除该 Key 吗？将立即回退到 .env 中的 Key。" @confirm="deleteProviderKey(row.id)">
                      <template #reference>
                        <el-button type="danger" link :icon="Delete">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- Model → Tier Mapping Tab -->
            <el-tab-pane label="定价映射" name="modeltiers">
              <el-alert v-if="Object.keys(adminModelTiers.tiers).length === 0" type="warning" show-icon :closable="false"
                title="还没有定价档位，请先点击「新增定价档位」创建至少一个档位" style="margin-bottom:16px" />

              <!-- Tier pricing table -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-weight:600;font-size:14px">定价档位</span>
                <el-button size="small" @click="openEditTier()">新增档位</el-button>
              </div>

              <el-table v-if="tierRows.length > 0" :data="tierRows" stripe size="small" class="admin-table" style="margin-bottom:20px">
                <el-table-column label="档位" width="160">
                  <template #default="{ row }">
                    <el-tag :type="tierTagType(row.key)" size="small">{{ row.label }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="输入价格 (元/千token)" width="180" align="center">
                  <template #default="{ row }">{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格 (元/千token)" width="180" align="center">
                  <template #default="{ row }">{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="模型数" width="80" align="center">
                  <template #default="{ row }">{{ row.models.length }}</template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button size="small" link @click="openEditTier(row.key)">编辑</el-button>
                    <el-popconfirm title="删除此档位？" @confirm="deleteAdminTier(row.key)">
                      <template #reference>
                        <el-button size="small" link type="danger">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>

              <!-- Model → Tier Mapping Table -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:12px">
                  <span style="font-weight:600;font-size:14px">模型映射</span>
                  <el-input v-model="modelTierSearch" placeholder="搜索模型..." size="small" clearable style="width:200px" :prefix-icon="Search" />
                  <el-button-group size="small">
                    <el-button :type="modelTierTagFilter === '' ? 'primary' : ''" @click="modelTierTagFilter = ''">全部</el-button>
                    <el-button :type="modelTierTagFilter === 'language' ? 'primary' : ''" @click="modelTierTagFilter = 'language'">语言</el-button>
                    <el-button :type="modelTierTagFilter === 'vision' ? 'primary' : ''" @click="modelTierTagFilter = 'vision'">视觉</el-button>
                    <el-button :type="modelTierTagFilter === 'audio' ? 'primary' : ''" @click="modelTierTagFilter = 'audio'">音频</el-button>
                  </el-button-group>
                </div>
                <span style="font-size:12px;color:#9ca3af">
                  未分配使用默认价（入 {{ defaultPricePrompt.toFixed(4) }} / 出 {{ defaultPriceCompletion.toFixed(4) }}）
                </span>
              </div>

              <el-table :data="filteredModelTierRows" stripe size="small" class="admin-table" max-height="480">
                <el-table-column prop="modelId" label="模型" min-width="200" />
                <el-table-column label="标签" width="110">
                  <template #default="{ row }">
                    <el-tag v-if="getModelTags(row.modelId).includes('language')" size="small" type="info" style="margin-right:4px">语言</el-tag>
                    <el-tag v-if="getModelTags(row.modelId).includes('vision')" size="small" type="success" style="margin-right:4px">视觉</el-tag>
                    <el-tag v-if="getModelTags(row.modelId).includes('audio')" size="small" type="success">音频</el-tag>
                    <span v-if="getModelTags(row.modelId).length === 0" style="color:#c0c4cc">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="定价档位" width="180">
                  <template #default="{ row }">
                    <el-select v-model="row.tierKey" size="small" placeholder="未分配" clearable style="width:100%"
                      @change="(val: string) => changeModelTier(row.modelId, val || '')">
                      <el-option v-for="t in tierRows" :key="t.key" :label="t.label" :value="t.key">
                        <span>{{ t.label }}</span>
                        <span style="float:right;color:#9ca3af;font-size:11px">入{{ t.promptPrice.toFixed(3) }} 出{{ t.completionPrice.toFixed(3) }}</span>
                      </el-option>
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="输入价格" width="110" align="center">
                  <template #default="{ row }">{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格" width="110" align="center">
                  <template #default="{ row }">{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
              </el-table>

              <div style="margin-top:8px;font-size:11px;color:#9ca3af">
                共 {{ models.length }} 个模型，{{ unassignedCount }} 个未分配
              </div>

              <!-- Default prices (for unassigned models) -->
              <el-card shadow="never" style="margin-top:16px;background:var(--el-fill-color-lighter, #f8fafc)">
                <template #header><strong>默认价格</strong><span style="font-size:12px;color:#9ca3af;margin-left:8px">未分配档位的模型使用此价格</span></template>
                <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
                  <div>
                    <div style="font-size:12px;color:#909399;margin-bottom:4px">输入价格（元/千token）</div>
                    <el-input-number v-model="adminDefaultPromptPrice" :min="0" :step="0.001" :precision="4" style="width:180px" size="small" />
                  </div>
                  <div>
                    <div style="font-size:12px;color:#909399;margin-bottom:4px">输出价格（元/千token）</div>
                    <el-input-number v-model="adminDefaultCompletionPrice" :min="0" :step="0.001" :precision="4" style="width:180px" size="small" />
                  </div>
                  <el-button type="primary" size="small" @click="saveDefaultPrices()">保存默认价格</el-button>
                </div>
              </el-card>
            </el-tab-pane>

            <!-- Page Settings Tab -->
            <el-tab-pane label="页面配置" name="settings">
              <el-table :data="adminSettings.filter((s: any) => s.key !== 'model_tier_mapping')" stripe size="small" class="admin-table">
                <el-table-column prop="description" label="配置" min-width="250" />
                <el-table-column prop="value" label="值" min-width="300">
                  <template #default="{ row }">
                    <span style="font-size:12px;word-break:break-all">{{ row.value.length > 80 ? row.value.slice(0, 80) + '...' : row.value }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link :icon="EditPen" @click="openEditSetting(row)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- Router Rules Tab -->
            <el-tab-pane label="路由规则" name="router">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-size:13px;color:#64748b">配置各任务意图对应的模型列表（逗号分隔），Auto 路由时按意图匹配</span>
                <el-button size="small" type="primary" @click="openAdminRouterEdit()">新增规则</el-button>
              </div>
              <el-table :data="adminRouterRules" size="small" stripe class="admin-table">
                <el-table-column prop="intent" label="意图" width="140">
                  <template #default="{ row }">
                    <el-tag size="small">{{ row.intent }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="models" label="模型列表">
                  <template #default="{ row }">
                    <span style="font-size:12px;word-break:break-all">{{ (row.models || []).join(' → ') }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="openAdminRouterEdit(row.intent, row.models)">编辑</el-button>
                    <el-button type="danger" link size="small" @click="deleteAdminRouterRule(row.intent)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-if="adminRouterRules.length === 0" description="暂无路由规则，点击「新增规则」添加" :image-size="60" />
            </el-tab-pane>

            <!-- Router Rule Edit Dialog -->
            <el-dialog v-model="adminRouterEditDialog" title="编辑路由规则" width="500px">
              <el-form label-width="80px">
                <el-form-item label="意图标识">
                  <el-input v-model="adminRouterEditIntent" placeholder="如 coding, translation, general" />
                  <div style="font-size:11px;color:#909399;margin-top:2px">支持: coding, translation, creative, reasoning, vision, summary, data, general</div>
                </el-form-item>
                <el-form-item label="模型列表">
                  <el-input v-model="adminRouterEditModels" type="textarea" :rows="3" placeholder="逗号分隔，如: qwen-plus, deepseek-v4-flash" />
                  <div style="font-size:11px;color:#909399;margin-top:2px">按优先级排列，排前面的优先使用</div>
                </el-form-item>
              </el-form>
              <template #footer>
                <el-button @click="adminRouterEditDialog = false">取消</el-button>
                <el-button type="primary" @click="saveAdminRouterRule()">保存</el-button>
              </template>
            </el-dialog>
          </el-tabs>

          <!-- Edit User Dialog -->
          <el-dialog v-model="adminEditUserDialog" title="编辑用户" width="460px">
            <el-form label-position="top">
              <el-form-item label="用户名">
                <el-input :model-value="adminEditUserUsername" disabled />
              </el-form-item>
              <el-form-item label="余额 (元)">
                <el-input-number v-model="adminEditUserCredits" :min="0" :precision="4" :step="1" style="width: 100%" />
              </el-form-item>
              <el-form-item label="角色">
                <el-select v-model="adminEditUserRole" style="width: 100%">
                  <el-option label="普通用户 (user)" value="user" />
                  <el-option label="管理员 (admin)" value="admin" />
                </el-select>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminEditUserDialog = false">取消</el-button>
              <el-button type="primary" @click="saveEditUser()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Add Provider Key Dialog -->
          <el-dialog v-model="adminAddKeyDialog" title="添加 Provider API Key" width="500px">
            <el-form label-position="top">
              <el-form-item label="Provider">
                <el-select v-model="adminNewKeyProvider" style="width: 100%">
                  <el-option v-for="cfg in adminProviderConfigs" :key="cfg.providerName" :label="cfg.displayName + ' (' + cfg.providerName + ')'" :value="cfg.providerName" />
                </el-select>
              </el-form-item>
              <el-form-item label="名称（可选标签）">
                <el-input v-model="adminNewKeyName" placeholder="如: 生产环境 Key 1" />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="adminNewKeyValue" type="password" show-password placeholder="sk-xxxxxxxx" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminAddKeyDialog = false">取消</el-button>
              <el-button type="primary" @click="saveAddProviderKey()" :disabled="!adminNewKeyValue.trim()">添加</el-button>
            </template>
          </el-dialog>

          <!-- Edit Provider Config Dialog -->
          <el-dialog v-model="adminEditConfigDialog" :title="adminIsNewConfig ? '添加服务商' : '编辑服务商'" width="560px">
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="标识符 (providerName)">
                    <el-input v-model="adminEditConfigForm.providerName" placeholder="如: openai" :disabled="!adminIsNewConfig" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="显示名称">
                    <el-input v-model="adminEditConfigForm.displayName" placeholder="如: OpenAI" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="端点 URL (baseUrl)">
                <el-input v-model="adminEditConfigForm.baseUrl" placeholder="如: https://api.openai.com/v1" />
              </el-form-item>
              <el-form-item label="模型列表 (逗号分隔)">
                <el-input v-model="adminEditConfigForm.models" type="textarea" :rows="2" placeholder="如: gpt-4o-mini,gpt-4o,gpt-4.1" />
              </el-form-item>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="模型前缀 (可选)">
                    <el-input v-model="adminEditConfigForm.modelPrefix" placeholder="如: mimo" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="超时 (ms)">
                    <el-input-number v-model="adminEditConfigForm.timeoutMs" :min="1000" :max="120000" :step="1000" style="width:100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="重试次数">
                    <el-input-number v-model="adminEditConfigForm.retryCount" :min="0" :max="10" style="width:100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="Auth Header 名称">
                    <el-input v-model="adminEditConfigForm.authHeader" placeholder="Authorization" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="Auth 前缀">
                    <el-input v-model="adminEditConfigForm.authPrefix" placeholder="Bearer" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
            <template #footer>
              <el-button @click="adminEditConfigDialog = false">取消</el-button>
              <el-button type="primary" @click="saveConfig()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Reset Password Dialog -->
          <el-dialog v-model="adminResetPwdDialog" title="重置用户密码" width="420px">
            <el-form label-position="top">
              <el-form-item label="用户名">
                <el-input :model-value="adminResetPwdUsername" disabled />
              </el-form-item>
              <el-form-item label="新密码">
                <el-input v-model="adminResetPwdValue" type="password" show-password placeholder="输入新密码（至少 4 位）" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminResetPwdDialog = false">取消</el-button>
              <el-button type="primary" @click="saveResetPassword()" :disabled="adminResetPwdValue.length < 4">确认重置</el-button>
            </template>
          </el-dialog>

          <!-- Edit Setting Dialog -->
          <el-dialog v-model="adminEditSettingDialog" title="编辑配置" :width="adminEditSettingKey === 'model_tags' ? '720px' : '600px'">
            <el-form label-position="top">
              <el-form-item label="配置键">
                <el-input :model-value="adminEditSettingKey" disabled />
              </el-form-item>
              <el-form-item :label="adminEditSettingDesc">
                <!-- Model tags editor -->
                <template v-if="adminEditSettingKey === 'model_tags'">
                  <el-table :data="models" stripe size="small" max-height="400" style="width:100%">
                    <el-table-column prop="id" label="模型" min-width="200" />
                    <el-table-column label="语言" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('language')" @change="(v: boolean) => toggleModelTag(row.id, 'language', v)" />
                      </template>
                    </el-table-column>
                    <el-table-column label="视觉" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('vision')" @change="(v: boolean) => toggleModelTag(row.id, 'vision', v)" />
                      </template>
                    </el-table-column>
                    <el-table-column label="音频" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('audio')" @change="(v: boolean) => toggleModelTag(row.id, 'audio', v)" />
                      </template>
                    </el-table-column>
                  </el-table>
                </template>
                <!-- Page models multi-select / text mode -->
                <template v-else-if="adminEditSettingKey.startsWith('page_models_')">
                  <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                      <template v-if="!adminEditSettingTextMode">
                        <el-tag :type="adminEditSettingModels.length === 0 ? 'success' : 'info'" size="small" style="cursor:pointer" @click="adminEditSettingModels = []">
                          {{ adminEditSettingModels.length === 0 ? '全部模型（已选中）' : '点击切换为全部模型' }}
                        </el-tag>
                        <span style="color:#909399;font-size:12px">按标签筛选：</span>
                        <el-tag v-for="tag in ['language','vision','audio']" :key="tag"
                          :effect="adminEditSettingTagFilter === tag ? 'dark' : 'plain'"
                          size="small" style="cursor:pointer"
                          @click="adminEditSettingTagFilter = adminEditSettingTagFilter === tag ? '' : tag">
                          {{ tag === 'language' ? '语言' : tag === 'vision' ? '视觉' : '音频' }}
                        </el-tag>
                      </template>
                    </div>
                    <el-button size="small" text type="primary" @click="toggleSettingTextMode()">
                      {{ adminEditSettingTextMode ? '多选模式' : '文本模式' }}
                    </el-button>
                  </div>
                  <el-select v-if="!adminEditSettingTextMode" v-model="adminEditSettingModels" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择可用模型（留空表示全部）" style="width:100%" :key="adminEditSettingTagFilter">
                    <el-option v-for="m in filteredModelsForSetting" :key="m.id" :label="m.id" :value="m.id">
                      <span>{{ m.id }}</span>
                      <el-tag v-for="t in getModelTags(m.id)" :key="t" size="small" :type="t === 'vision' ? 'warning' : t === 'audio' ? 'success' : 'info'" style="margin-left:4px">
                        {{ t === 'language' ? '语言' : t === 'vision' ? '视觉' : '音频' }}
                      </el-tag>
                    </el-option>
                  </el-select>
                  <el-input v-else v-model="adminEditSettingValue" type="textarea" :rows="6" placeholder="输入模型 ID，逗号分隔（* 表示全部）" />
                </template>
                <!-- Default textarea -->
                <el-input v-else v-model="adminEditSettingValue" type="textarea" :rows="4" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminEditSettingDialog = false">取消</el-button>
              <el-button type="primary" @click="saveEditSetting()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Model Tier Edit Dialog -->
          <el-dialog v-model="adminTierEditDialog" :title="adminTierEditIsNew ? '新增档位' : '编辑档位'" width="480px">
            <el-form label-width="100px">
              <el-form-item label="档位标识">
                <el-input v-model="adminTierEditKey" placeholder="tier_xxx" :disabled="!adminTierEditIsNew" />
              </el-form-item>
              <el-form-item label="显示名称">
                <el-input v-model="adminTierEditLabel" placeholder="如 入门、主流、旗舰、超旗舰" />
              </el-form-item>
              <el-form-item label="输入价格">
                <el-input-number v-model="adminTierEditPromptPrice" :min="0" :step="0.001" :precision="4" style="width:100%" />
                <span style="font-size:11px;color:#9ca3af;margin-left:8px">元/千token</span>
              </el-form-item>
              <el-form-item label="输出价格">
                <el-input-number v-model="adminTierEditCompletionPrice" :min="0" :step="0.001" :precision="4" style="width:100%" />
                <span style="font-size:11px;color:#9ca3af;margin-left:8px">元/千token</span>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminTierEditDialog = false">取消</el-button>
              <el-button type="primary" @click="saveTierEdit()">保存</el-button>
            </template>
          </el-dialog>

        </div>
      </template>

    </el-main>

    <!-- ====== SETTINGS DRAWER ====== -->
    <el-drawer v-model="isSettingsOpen" title="设置" direction="rtl" :size="360">
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
        <el-form-item label="后端地址（可选）" class="settings-label-wrap">
          <el-input v-model="backendBaseUrl" placeholder="/v1" />
        </el-form-item>
        <el-alert type="info" show-icon :closable="false"
          title="前端只负责请求后端，由后端使用 provider key 调用上游模型。" />
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
