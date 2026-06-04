// @ts-nocheck
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Cpu, ChatDotRound, DataAnalysis, Delete, Document, EditPen, Headset, InfoFilled, Lightning, MoreFilled, Monitor, Picture, PictureFilled, Plus, Promotion, Refresh, Search, Setting, Star, Sunny, SwitchButton, TrendCharts, User, UserFilled, VideoCamera, Coin } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { useDagNodes } from '../composables/useDagNodes';
import {
  clearStoredToken,
  addKnowledgeDocument as apiAddKnowledgeDocument,
  createAgent as apiCreateAgent,
  createApiKey as apiCreateApiKey,
  createKnowledgeBase as apiCreateKnowledgeBase,
  createMemory as apiCreateMemory,
  createSkill as apiCreateSkill,
  copySkill as apiCopySkill,
  createAgentTeam as apiCreateAgentTeam,
  createAgentMarketplaceTemplate as apiCreateAgentMarketplaceTemplate,
  createAgentTestCase as apiCreateAgentTestCase,
  createAgentTestSuite as apiCreateAgentTestSuite,
  createAgentVersion as apiCreateAgentVersion,
  createMcpServer as apiCreateMcpServer,
  createWorkflow as apiCreateWorkflow,
  deleteAdminUser,
  deleteAgent as apiDeleteAgent,
  deleteConversation,
  deleteSkill as apiDeleteSkill,
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
  fetchSkillDetail,
  fetchAgentTeams,
  fetchAgentTestCases,
  fetchAgentTestSuites,
  fetchAgentVersions,
  fetchAgentMarketplaceTemplates,
  fetchMcpServers,
  generateAgent as apiGenerateAgent,
  installAgentMarketplaceTemplate as apiInstallAgentMarketplaceTemplate,
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
  searchKnowledgeBase as apiSearchKnowledgeBase,
  createRechargeOrder,
  fetchRechargeOrders,
  checkRechargeOrder,
  type RechargeOrder,
  setStoredToken,
  syncConversations,
  testSkill as apiTestSkill,
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
  updateSkill as apiUpdateSkill,
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
  type AgentMarketplaceTemplate,
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
  type SkillTestResult,
  type ToolDefinition,
  type Workflow,
  type WorkflowRun,
  type WorkflowNode,
} from '../api';
import type { PageMode, ChatMessage, ChatSession, BattlePanelState, GroupChatMessage } from '../types';
import { getModelLogo } from '../constants';
import {
  createId, buildSessionTitle, pickTwoRandomModels, shuffleArray,
  formatTime, getStoredValue, setStoredValue, renderMarkdown,
} from '../utils';
import { MagicStick } from '@element-plus/icons-vue';


export function useAppController() {
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
  const agentWorkspaceMode = ref<'develop' | 'invoke'>('develop');
  const agentPageTab = ref<'overview' | 'basic' | 'capabilities' | 'tools' | 'workflow' | 'collab' | 'integration' | 'publish' | 'prompt' | 'marketplace'>('basic');
  const agentConsoleTab = ref<'history' | 'memory' | 'team' | 'workflow' | 'versions' | 'tests' | 'mcp' | 'eval'>('memory');

  // 使用DAG节点composable
  const { dagNodeCategories, dagTemplates, getDagNodeInfo, applyDagTemplate } = useDagNodes();

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
  const marketplaceTemplates = ref<AgentMarketplaceTemplate[]>([]);
  const agentResourceLoading = ref(false);
  const knowledgeCreating = ref(false);
  const knowledgeDocSaving = ref(false);
  const knowledgeFileParsing = ref(false);
  const knowledgeDocuments = ref<any[]>([]);
  const knowledgeDocPreviewVisible = ref(false);
  const knowledgeDocPreview = ref<any>({});
  const showKnowledgeCreateDialog = ref(false);
  const memorySaving = ref(false);
  const skillCreating = ref(false);
  const showSkillCreateDialog = ref(false);
  const skillPreviewOpen = ref(false);
  const showTeamCreateDialog = ref(false);
  const showMcpCreateDialog = ref(false);
  const showMcpTestDialog = ref(false);
  const showTestSuiteCreateDialog = ref(false);
  const showTestCaseCreateDialog = ref(false);
  const showMarketplacePublishDialog = ref(false);
  const showVersionCreateDialog = ref(false);
  const showEvaluationDialog = ref(false);
  const showMemoryCreateDialog = ref(false);
  const skillTesting = ref(false);
  const activeSkill = ref<SkillDefinition | null>(null);
  const activeSkillTestResult = ref<SkillTestResult | null>(null);
  const skillTestInput = ref('');
  const editingSkillId = ref('');
  const skillFilters = ref({
    search: '',
    category: '',
    source: '',
    status: '',
  });
  const workflowCreating = ref(false);
  const workflowRunning = ref(false);
  const teamCreating = ref(false);
  const teamRunning = ref(false);
  const mcpSaving = ref(false);
  const mcpTesting = ref(false);
  const versionSaving = ref(false);
  const testSaving = ref(false);
  const testRunning = ref(false);
  const marketplaceLoading = ref(false);
  const marketplaceInstalling = ref(false);
  const marketplacePublishing = ref(false);
  const activeWorkflowId = ref('');
  const workflowInput = ref('');
  const activeWorkflowRun = ref<WorkflowRun | null>(null);
  const activeTeamId = ref('');
  const teamInput = ref('');
  const activeTeamRun = ref<AgentTeamRun | null>(null);
  const activeTestSuiteId = ref('');
  const activeTestRun = ref<Record<string, unknown> | null>(null);
  const activeMcpTestServerId = ref('');
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

  // ===== Tool相关状态 =====
  interface CustomTool {
    id: string;
    name: string;
    displayName: string;
    description: string;
    icon: string;
    category: string;
    type: 'builtin' | 'custom';
    runtime: 'python' | 'javascript' | 'http' | 'webhook' | 'db';
    status: 'enabled' | 'disabled';
    riskLevel: 'low' | 'medium' | 'high';
    version: string;
    inputSchema: Record<string, any>;
    outputSchema: Record<string, any>;
    permissions: {
      network: boolean;
      database: boolean;
      fileRead: boolean;
      fileWrite: boolean;
      externalRequest: boolean;
    };
    code?: string;
    entry?: string;
    exampleInput?: string;
    exampleOutput?: string;
    timeout: number;
    retries: number;
    createdAt: string;
    updatedAt: string;
    callCount: number;
    lastCallAt?: string;
  }

  const customTools = ref<CustomTool[]>([]);
  const toolCreateDialogVisible = ref(false);
  const toolPreviewVisible = ref(false);
  const toolTestVisible = ref(false);
  const activeTool = ref<CustomTool | null>(null);
  const toolTestInput = ref('');
  const toolTestResult = ref<any>(null);
  const toolTesting = ref(false);
  const toolCreating = ref(false);
  const toolEditingId = ref('');

  const toolForm = ref({
    name: '',
    displayName: '',
    description: '',
    icon: '🔧',
    category: 'custom',
    runtime: 'python' as const,
    riskLevel: 'low' as const,
    code: `def run(input: dict, context: dict) -> dict:\n    """工具入口函数"""\n    # input: DAG或Agent传入的参数\n    # context: 运行上下文\n    result = input.get("param", "")\n    return {"result": result}`,
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: { type: 'object', properties: {} },
    exampleInput: '',
    exampleOutput: '',
    timeout: 30,
    retries: 0,
    permissions: {
      network: false,
      database: false,
      fileRead: false,
      fileWrite: false,
      externalRequest: false,
    },
  });

  // DAG节点配置面板状态
  const dagNodeConfigVisible = ref(false);
  const activeDagNode = ref<any>(null);
  const dagNodeConfig = ref<Record<string, any>>({});

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
    toolPermissions: {} as Record<string, string>,
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
  const ragLabForm = ref({
    kbId: '',
    query: '',
    mode: 'hybrid' as 'hybrid' | 'keyword' | 'vector',
    limit: 5,
  });
  const ragLabSearching = ref(false);
  const ragLabResults = ref<Awaited<ReturnType<typeof apiSearchKnowledgeBase>>>([]);
  const memoryForm = ref({
    content: '',
    importance: 3,
  });
  const skillForm = ref({
    name: '',
    description: '',
    category: 'custom',
    content: '',
    icon: 'Star',
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    exampleInput: '',
    exampleOutput: '',
  });
  const teamForm = ref({
    name: '',
    description: '',
    strategy: 'sequential' as AgentTeam['strategy'],
    memberIds: [] as string[],
  });
  const mcpForm = ref({
    name: 'Notion',
    serverType: 'notion' as 'notion',
    token: '',
    query: '',
  });
  const mcpServerOptions = [
    { label: 'Notion', value: 'notion' as const, tokenPlaceholder: 'Notion Integration Token' },
  ];
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
  const marketplaceForm = ref({
    name: '',
    description: '',
    category: '',
  });
  type AgentBuilderBlockType = 'identity' | 'model' | 'tools' | 'skills' | 'knowledge' | 'memory' | 'prompt' | 'constraints';
  interface AgentBuilderBlock {
    type: AgentBuilderBlockType;
    title: string;
    detail: string;
    icon: string;
    category: 'core' | 'ability' | 'config';
  }
  const agentBuilderBlocks: AgentBuilderBlock[] = [
    { type: 'identity', title: '角色设定', detail: '自动生成名称、描述和系统提示词', icon: '👤', category: 'core' },
    { type: 'model', title: '选择模型', detail: '绑定当前默认语言模型', icon: '🤖', category: 'core' },
    { type: 'prompt', title: '提示词模板', detail: '预设常用提示词结构', icon: '📝', category: 'core' },
    { type: 'tools', title: '基础工具', detail: '挂载时间、计算、文本统计工具', icon: '🔧', category: 'ability' },
    { type: 'skills', title: '能力包', detail: '挂载研究、代码、数据分析能力', icon: '⚡', category: 'ability' },
    { type: 'knowledge', title: '知识库', detail: '挂载第一个可用知识库', icon: '📚', category: 'ability' },
    { type: 'memory', title: '长期记忆', detail: '开启长期记忆功能', icon: '🧠', category: 'config' },
    { type: 'constraints', title: '安全约束', detail: '添加输出限制和安全边界', icon: '🛡️', category: 'config' },
  ];
  const agentBuilderCanvas = ref<AgentBuilderBlock[]>([]);
  const agentBuilderDragging = ref<AgentBuilderBlockType | ''>('');
  const agentBuilderSkillDragging = ref('');
  const showBuilderGuide = ref(false);
  const activeBuilderBlock = ref<AgentBuilderBlockType | null>(null);
  const builderBlockConfigs = ref<Record<string, any>>({
    identity: { name: '', description: '', prompt: '' },
    model: { model: '' },
    prompt: { template: 'default' },
    tools: { selected: [] },
    skills: { selected: [] },
    knowledge: { selected: [] },
    memory: { enabled: true },
    constraints: { rules: '' },
  });

  // ===== 新DAG节点类型定义 =====
  type DagNodeType = 
    // 输入输出节点
    | 'start' | 'user_input' | 'file_input' | 'form_input' 
    | 'output' | 'structured_output' | 'generate_file' | 'end'
    // 理解与决策节点
    | 'intent_detection' | 'parameter_extract' | 'info_extract'
    | 'content_classify' | 'condition' | 'multi_branch' | 'confidence_check'
    // 知识与上下文节点
    | 'knowledge_search' | 'context_read' | 'memory_read' | 'memory_write'
    | 'doc_parse' | 'citation整理'
    // 执行动作节点
    | 'tool_call' | 'skill_call' | 'agent_call' | 'http_request'
    | 'db_query' | 'code执行' | 'webhook'
    // 生成与处理节点
    | 'llm_generate' | 'prompt_builder' | 'result_summary' | 'result_rewrite'
    | 'format_output' | 'json_parse' | 'multi_result_merge'
    // 控制与安全节点
    | 'human_confirm' | 'permission_check' | 'sensitive_confirm'
    | 'retry' | 'error_handle' | 'fallback' | 'wait';

  interface DagNodeCategory {
    id: string;
    label: string;
    icon: string;
    nodes: DagNodeItem[];
  }

  interface DagNodeItem {
    type: DagNodeType;
    label: string;
    description: string;
    icon: string;
    category: string;
    inputs: string[];
    outputs: string[];
    configSchema: Record<string, any>;
  }

  type WorkflowCanvasNode = WorkflowNode & { x: number; y: number };
  const workflowCanvasNodes = ref<WorkflowCanvasNode[]>([]);
  const workflowCanvasConnecting = ref('');
  const workflowCanvasDrag = ref<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const workflowCanvasSaving = ref(false);
  const workflowCanvasTypes: Array<{ type: WorkflowNode['type']; label: string; tip: string }> = [
    { type: 'prompt', label: '提示词', tip: '整理输入或拼接上下文' },
    { type: 'knowledge', label: 'RAG', tip: '从知识库召回内容' },
    { type: 'skill', label: 'Skill', tip: '运行平台或自定义 Skill' },
    { type: 'tool', label: '工具', tip: '调用计算、代码或浏览器工具' },
    { type: 'memory', label: '记忆', tip: '检索长期记忆' },
    { type: 'agent', label: 'Agent', tip: '交给当前或指定 Agent 执行' },
  ];

  const selectedWorkflow = computed(() => workflows.value.find((item) => item.id === activeWorkflowId.value) ?? null);
  const workflowCanvasEdges = computed(() => {
    const byId = new Map(workflowCanvasNodes.value.map((node) => [node.id, node]));
    return workflowCanvasNodes.value.flatMap((node) => {
      const nextIds = Array.isArray(node.config.nextIds) ? node.config.nextIds.map(String) : [];
      return nextIds
        .map((nextId) => {
          const target = byId.get(nextId);
          if (!target) return null;
          return {
            id: `${node.id}-${nextId}`,
            x1: node.x + 190,
            y1: node.y + 38,
            x2: target.x,
            y2: target.y + 38,
          };
        })
        .filter(Boolean) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
    });
  });

  const skillCategories = computed(() => Array.from(new Set(availableSkills.value.map((skill) => skill.category).filter(Boolean))).sort());
  const filteredSkills = computed(() => {
    const keyword = skillFilters.value.search.trim().toLowerCase();
    return availableSkills.value.filter((skill) => {
      const matchesKeyword = !keyword || [skill.name, skill.description, skill.category].some((item) => item.toLowerCase().includes(keyword));
      const matchesCategory = !skillFilters.value.category || skill.category === skillFilters.value.category;
      const matchesSource = !skillFilters.value.source || skill.source === skillFilters.value.source;
      const matchesStatus = !skillFilters.value.status
        || (skillFilters.value.status === 'enabled' ? skill.enabled : !skill.enabled);
      return matchesKeyword && matchesCategory && matchesSource && matchesStatus;
    });
  });

  const agentPublicEndpoint = computed(() => {
    if (!agentForm.value.publicSlug) return '';
    return `${backendBaseUrl.value}/public/agents/${encodeURIComponent(agentForm.value.publicSlug)}/runs`;
  });

  const agentApiEndpoint = computed(() => {
    if (!agentForm.value.id) return '';
    return `${backendBaseUrl.value}/agents/${encodeURIComponent(agentForm.value.id)}/invoke`;
  });

  const agentGuideCards = computed(() => [
    {
      step: '1',
      title: agentForm.value.id ? '已选择 Agent' : '先创建 Agent',
      detail: agentForm.value.id ? agentForm.value.name : '用 AI 生成或手动填写名称、模型和提示词',
      status: agentForm.value.id ? 'done' : 'current',
    },
    {
      step: '2',
      title: '挂载能力',
      detail: `${agentForm.value.toolIds.length} 工具 · ${agentForm.value.knowledgeBaseIds.length} 知识库 · ${agentForm.value.skillIds.length} Skills`,
      status: agentForm.value.toolIds.length || agentForm.value.knowledgeBaseIds.length || agentForm.value.skillIds.length ? 'done' : 'current',
    },
    {
      step: '3',
      title: '运行调试',
      detail: activeAgentRun.value ? `最近 ${activeAgentRun.value.status}` : '输入任务，查看输出和 Trace',
      status: activeAgentRun.value ? 'done' : 'current',
    },
    {
      step: '4',
      title: '测试发布',
      detail: agentForm.value.published ? '已发布，可通过 API 接入' : '创建测试集后再发布',
      status: agentForm.value.published ? 'done' : 'todo',
    },
  ]);

  watch(activeTestSuiteId, () => {
    void loadSelectedTestCases();
  });

  watch(() => knowledgeDocForm.value.kbId, (kbId) => {
    if (kbId) {
      void loadKnowledgeDocuments(kbId);
    } else {
      knowledgeDocuments.value = [];
    }
  });

  watch(activeWorkflowId, () => {
    syncWorkflowCanvasFromSelected();
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
    : window.location.hash === '#/rag' ? 'rag'
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
  const adminModelTiers = ref<ModelTiersData>({ tiers: {}, prices: {}, labels: {}, examples: {} });
  const adminTierEditDialog = ref(false);
  const adminTierEditKey = ref('');
  const adminTierEditLabel = ref('');
  const adminTierEditPromptPrice = ref(0);
  const adminTierEditCompletionPrice = ref(0);
  const adminTierEditDesc = ref('');
  const adminTierEditExamples = ref('');
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
      else if (hash === '#/rag') pageMode.value = 'rag';
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
      void loadAgentResources();
    } else if (mode === 'rag') {
      void loadAgentResources();
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
      void loadAgentResources();
    } else if (authed && pageMode.value === 'rag') {
      void loadAgentResources();
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
      toolPermissions: {},
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
      toolPermissions: {},
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
      marketplaceTemplates.value = [];
      agentMemories.value = [];
      return;
    }

    agentResourceLoading.value = true;
    try {
      const [tools, bases, skills, teamItems, mcpItems, templates, workflowItems] = await Promise.all([
        fetchTools(backendBaseUrl.value),
        fetchKnowledgeBases(backendBaseUrl.value),
        fetchSkills(backendBaseUrl.value),
        fetchAgentTeams(backendBaseUrl.value),
        fetchMcpServers(backendBaseUrl.value),
        fetchAgentMarketplaceTemplates(backendBaseUrl.value),
        fetchWorkflows(backendBaseUrl.value),
      ]);
      availableTools.value = tools;
      knowledgeBases.value = bases;
      availableSkills.value = skills;
      agentTeams.value = teamItems;
      mcpServers.value = mcpItems;
      marketplaceTemplates.value = templates;
      workflows.value = workflowItems;
      if (!knowledgeDocForm.value.kbId && bases[0]) knowledgeDocForm.value.kbId = bases[0].id;
      if (!ragLabForm.value.kbId && bases[0]) ragLabForm.value.kbId = bases[0].id;
      if (!activeTeamId.value && teamItems[0]) activeTeamId.value = teamItems[0].id;
      if (activeWorkflowId.value && workflowItems.some((item) => item.id === activeWorkflowId.value)) {
        syncWorkflowCanvasFromSelected();
      } else {
        activeWorkflowId.value = '';
        workflowCanvasNodes.value = [];
        workflowCanvasConnecting.value = '';
        activeWorkflowRun.value = null;
      }
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

  function selectAgentById(agentId: string) {
    const agent = agents.value.find((item) => item.id === agentId);
    if (agent) selectAgent(agent);
  }

  function startAgentBuilderDrag(block: AgentBuilderBlock) {
    agentBuilderDragging.value = block.type;
    agentBuilderSkillDragging.value = '';
  }

  function startSkillBuilderDrag(skill: SkillDefinition) {
    agentBuilderSkillDragging.value = skill.id;
    agentBuilderDragging.value = '';
  }

  function dropAgentBuilderBlock() {
    if (agentBuilderSkillDragging.value) {
      const skill = availableSkills.value.find((item) => item.id === agentBuilderSkillDragging.value);
      if (skill) {
        agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, skill.id]));
        if (!agentBuilderCanvas.value.some((item) => item.type === 'skills')) {
          const block = agentBuilderBlocks.find((item) => item.type === 'skills');
          if (block) agentBuilderCanvas.value = [...agentBuilderCanvas.value, block];
        }
        status.value = `已拖入 Skill：${skill.name}`;
      }
      agentBuilderSkillDragging.value = '';
      return;
    }
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
    agentBuilderSkillDragging.value = '';
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

    if (selectedTypes.has('prompt')) {
      if (!agentForm.value.systemPrompt || agentForm.value.systemPrompt.trim() === '') {
        agentForm.value.systemPrompt = [
          '# 角色',
          '你是一个专业的 AI 助手。',
          '',
          '# 目标',
          '帮助用户完成任务，提供准确、有用的回答。',
          '',
          '# 输出格式',
          '- 使用清晰的结构化格式',
          '- 先给出结论，再补充细节',
          '',
          '# 约束',
          '- 遵循安全准则',
          '- 不确定时说明原因',
        ].join('\n');
      }
    }

    if (selectedTypes.has('constraints')) {
      const currentPrompt = agentForm.value.systemPrompt || '';
      if (!currentPrompt.includes('# 安全约束')) {
        agentForm.value.systemPrompt = currentPrompt + '\n\n# 安全约束\n- 不生成有害内容\n- 保护用户隐私\n- 遵循伦理准则';
      }
    }

    if (selectedTypes.has('run')) {
      agentPrompt.value = '请基于你的角色设定、可用工具、知识库和长期记忆，给出一份当前能力说明和一次示例执行。';
    }

    status.value = `已应用 ${agentBuilderCanvas.value.length} 个 Builder 模块`;
  }

  function applyBuilderConfigs() {
    const configs = builderBlockConfigs.value;
    
    if (agentBuilderCanvas.value.some(b => b.type === 'identity')) {
      if (configs.identity.name) agentForm.value.name = configs.identity.name;
      if (configs.identity.description) agentForm.value.description = configs.identity.description;
      if (configs.identity.prompt) agentForm.value.systemPrompt = configs.identity.prompt;
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'model')) {
      if (configs.model.model) agentForm.value.model = configs.model.model;
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'prompt')) {
      const templates: Record<string, string> = {
        general: '你是一个专业的 AI 助手，帮助用户完成各种任务。',
        code: '你是一个代码专家，精通多种编程语言，帮助用户编写、调试和优化代码。',
        research: '你是一个研究分析师，擅长收集信息、分析数据并提供洞察。',
        support: '你是一个客服支持专员，耐心解答用户问题并提供解决方案。',
      };
      agentForm.value.systemPrompt = templates[configs.prompt.template] || templates.general;
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'tools')) {
      if (configs.tools.selected.length > 0) {
        agentForm.value.toolIds = Array.from(new Set([...agentForm.value.toolIds, ...configs.tools.selected]));
      } else {
        const preferred = ['current_time', 'calculator', 'text_stats', 'javascript_runner'];
        const preferredIds = availableTools.value.filter(t => preferred.includes(t.name)).map(t => t.id);
        agentForm.value.toolIds = Array.from(new Set([...agentForm.value.toolIds, ...preferredIds]));
      }
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'skills')) {
      if (configs.skills.selected.length > 0) {
        agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, ...configs.skills.selected]));
      } else {
        const preferred = ['Research Planner', 'Code Operator', 'Data Analyst'];
        const preferredIds = availableSkills.value.filter(s => preferred.includes(s.name)).map(s => s.id);
        agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, ...preferredIds]));
      }
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'knowledge')) {
      if (configs.knowledge.selected.length > 0) {
        agentForm.value.knowledgeBaseIds = Array.from(new Set([...agentForm.value.knowledgeBaseIds, ...configs.knowledge.selected]));
      } else {
        const kbId = knowledgeBases.value[0]?.id;
        if (kbId) agentForm.value.knowledgeBaseIds = Array.from(new Set([...agentForm.value.knowledgeBaseIds, kbId]));
      }
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'memory')) {
      agentForm.value.memoryEnabled = configs.memory.enabled;
    }

    if (agentBuilderCanvas.value.some(b => b.type === 'constraints')) {
      const rules = configs.constraints.rules || '- 不生成有害内容\n- 保护用户隐私\n- 遵循伦理准则';
      const currentPrompt = agentForm.value.systemPrompt || '';
      if (!currentPrompt.includes('# 安全约束')) {
        agentForm.value.systemPrompt = currentPrompt + '\n\n# 安全约束\n' + rules;
      }
    }

    status.value = `已应用 ${agentBuilderCanvas.value.length} 个组件配置`;
    activeBuilderBlock.value = null;
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
        toolPermissions: { ...agentForm.value.toolPermissions },
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

  async function installMarketplaceTemplate(template: AgentMarketplaceTemplate) {
    const model = agentForm.value.model || selectedModel.value || chatModels.value[0]?.id || models.value[0]?.id || '';
    if (!model || model === 'auto') {
      status.value = '请先选择一个具体模型再安装模板';
      return;
    }
    marketplaceInstalling.value = true;
    try {
      const installed = await apiInstallAgentMarketplaceTemplate({ templateId: template.id, model }, backendBaseUrl.value);
      agents.value = [installed, ...agents.value.filter((item) => item.id !== installed.id)];
      activeAgentId.value = installed.id;
      fillAgentForm(installed);
      agentConsoleTab.value = 'memory';
      status.value = `已安装模板：${template.name}`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '安装模板失败';
    } finally {
      marketplaceInstalling.value = false;
    }
  }

  async function publishCurrentAgentToMarketplace() {
    const agent = agentForm.value.id ? activeAgent.value : await persistAgent();
    if (!agent || marketplacePublishing.value) return;
    const name = (marketplaceForm.value.name.trim() || `${agent.name} 模板`).slice(0, 80);
    marketplacePublishing.value = true;
    try {
      const template = await apiCreateAgentMarketplaceTemplate({
        name,
        description: marketplaceForm.value.description.trim() || agent.description,
        category: marketplaceForm.value.category.trim() || 'custom',
        sourceAgentId: agent.id,
      }, backendBaseUrl.value);
      marketplaceTemplates.value = [template, ...marketplaceTemplates.value.filter((item) => item.id !== template.id)];
      marketplaceForm.value = { name: '', description: '', category: '' };
      showMarketplacePublishDialog.value = false;
      status.value = `已发布到 Agent Marketplace：${template.name}`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '发布模板失败';
    } finally {
      marketplacePublishing.value = false;
    }
  }

  function getToolLabelById(toolId: string): string {
    const tool = availableTools.value.find((item) => item.id === toolId);
    return tool?.displayName || tool?.name || toolId;
  }

  async function confirmToolExecutionIfNeeded(): Promise<boolean> {
    const confirmTools = agentForm.value.toolIds
      .filter((toolId) => agentForm.value.toolPermissions[toolId] === 'confirm')
      .map(getToolLabelById);
    if (confirmTools.length === 0) return true;
    try {
      await ElMessageBox.confirm(
        `本次运行可能调用以下工具：${confirmTools.join('、')}。工具可能访问外部页面、执行代码或消耗资源，确认允许后再继续。`,
        '确认 Tool 执行',
        {
          confirmButtonText: '允许并运行',
          cancelButtonText: '取消',
          type: 'warning',
        },
      );
      return true;
    } catch {
      status.value = '已取消 Tool 执行';
      return false;
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
    if (!(await confirmToolExecutionIfNeeded())) return;

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
      showEvaluationDialog.value = false;
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
      await loadKnowledgeDocuments(kbId);
      status.value = `文档已入库，切分 ${result.chunkCount} 个片段`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '写入知识库失败';
    } finally {
      knowledgeDocSaving.value = false;
    }
  }

  async function handleKnowledgeFileUpload(uploadFile: any) {
    const file = uploadFile.raw || uploadFile;
    if (!file) return;
    
    const kbId = knowledgeDocForm.value.kbId;
    if (!kbId) {
      status.value = '请先选择知识库';
      return;
    }

    knowledgeFileParsing.value = true;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let content = '';

      if (['txt', 'md', 'csv', 'json'].includes(ext)) {
        content = await file.text();
      } else if (['doc', 'docx', 'pdf', 'xls', 'xlsx'].includes(ext)) {
        // 对于Word、PDF、Excel文件，使用FileReader读取为base64，然后发送到后端解析
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        // 发送到后端解析
        const response = await fetch(`${backendBaseUrl.value}/knowledge/parse-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64, filename: file.name }),
        });
        
        if (!response.ok) {
          throw new Error('文件解析失败');
        }
        
        const result = await response.json();
        content = result.data?.content || '';
      } else {
        throw new Error(`不支持的文件格式: ${ext}`);
      }

      if (!content.trim()) {
        throw new Error('文件内容为空');
      }

      knowledgeDocForm.value.title = file.name;
      knowledgeDocForm.value.content = content;
      status.value = `文件 "${file.name}" 解析成功，点击"写入并向量化"保存`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '文件解析失败';
    } finally {
      knowledgeFileParsing.value = false;
    }
  }

  async function loadKnowledgeDocuments(kbId: string) {
    if (!kbId) return;
    try {
      const response = await fetch(`${backendBaseUrl.value}/knowledge/bases/${kbId}/documents`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const result = await response.json();
        knowledgeDocuments.value = result.data || [];
      }
    } catch (error) {
      console.error('加载文档列表失败:', error);
    }
  }

  function previewKnowledgeDocument(doc: any) {
    knowledgeDocPreview.value = doc;
    knowledgeDocPreviewVisible.value = true;
  }

  async function deleteKnowledgeDocument(docId: string) {
    try {
      const response = await fetch(`${backendBaseUrl.value}/knowledge/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        knowledgeDocuments.value = knowledgeDocuments.value.filter(d => d.id !== docId);
        status.value = '文档已删除';
        await loadAgentResources();
      }
    } catch (error) {
      status.value = '删除文档失败';
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function runRagLabSearch() {
    const kbId = ragLabForm.value.kbId || knowledgeDocForm.value.kbId || knowledgeBases.value[0]?.id || '';
    const query = ragLabForm.value.query.trim();
    if (!kbId || !query || ragLabSearching.value) return;
    ragLabSearching.value = true;
    try {
      ragLabResults.value = await apiSearchKnowledgeBase(kbId, query, {
        mode: ragLabForm.value.mode,
        limit: ragLabForm.value.limit,
      }, backendBaseUrl.value);
      ragLabForm.value.kbId = kbId;
      status.value = `RAG 检索完成：${ragLabResults.value.length} 条片段`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : 'RAG 检索失败';
    } finally {
      ragLabSearching.value = false;
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
      showMemoryCreateDialog.value = false;
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
      const payload = {
        name,
        description: skillForm.value.description.trim(),
        content,
        category: skillForm.value.category.trim() || 'custom',
        icon: skillForm.value.icon,
        riskLevel: skillForm.value.riskLevel,
        exampleInput: skillForm.value.exampleInput.trim(),
        exampleOutput: skillForm.value.exampleOutput.trim(),
      };
      const wasEditing = Boolean(editingSkillId.value);
      const skill = editingSkillId.value
        ? await apiUpdateSkill(editingSkillId.value, payload, backendBaseUrl.value)
        : await apiCreateSkill(payload, backendBaseUrl.value);
      availableSkills.value = [skill, ...availableSkills.value.filter((item) => item.id !== skill.id)];
      agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, skill.id]));
      editingSkillId.value = '';
      skillForm.value = { name: '', description: '', category: 'custom', content: '', icon: 'Star', riskLevel: 'low', exampleInput: '', exampleOutput: '' };
      status.value = wasEditing ? 'Skill 已更新' : 'Skill 已创建并挂载到当前 Agent';
    } catch (error) {
      status.value = error instanceof Error ? error.message : '创建 Skill 失败';
    } finally {
      skillCreating.value = false;
    }
  }

  function exportSkillAsMarkdown(skill: SkillDefinition) {
    const md = `# ${skill.name}

  ## 基本信息
  - **分类**: ${skill.category}
  - **版本**: v${skill.version}
  - **风险等级**: ${skill.riskLevel}
  - **来源**: ${skill.source === 'builtin' ? '平台内置' : '自定义'}

  ## 描述
  ${skill.description || '暂无描述'}

  ## 能力说明
  ${skill.content || '暂无说明'}

  ## 输入 Schema
  \`\`\`json
  ${JSON.stringify(skill.inputSchema || {}, null, 2)}
  \`\`\`

  ## 输出 Schema
  \`\`\`json
  ${JSON.stringify(skill.outputSchema || {}, null, 2)}
  \`\`\`

  ## 示例

  ### 输入
  ${skill.exampleInput || '暂无示例输入'}

  ### 输出
  ${skill.exampleOutput || '暂无示例输出'}
  `;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-${skill.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    status.value = `Skill "${skill.name}" 已导出为 Markdown`;
  }

  function exportAgentAsJson() {
    if (!agentForm.value.id) {
      status.value = '请先保存 Agent';
      return;
    }

    const exportData = {
      name: agentForm.value.name,
      description: agentForm.value.description,
      model: agentForm.value.model,
      systemPrompt: agentForm.value.systemPrompt,
      temperature: agentForm.value.temperature,
      maxTokens: agentForm.value.maxTokens,
      memoryEnabled: agentForm.value.memoryEnabled,
      toolIds: agentForm.value.toolIds,
      skillIds: agentForm.value.skillIds,
      knowledgeBaseIds: agentForm.value.knowledgeBaseIds,
      status: agentForm.value.status,
      published: agentForm.value.published,
      apiEnabled: agentForm.value.apiEnabled,
      publicSlug: agentForm.value.publicSlug,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-${agentForm.value.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    status.value = `Agent "${agentForm.value.name}" 已导出为 JSON`;
  }

  function exportAgentAsMarkdown() {
    if (!agentForm.value.id) {
      status.value = '请先保存 Agent';
      return;
    }

    const boundTools = availableTools.value.filter(t => agentForm.value.toolIds.includes(t.id));
    const boundSkills = availableSkills.value.filter(s => agentForm.value.skillIds.includes(s.id));
    const boundKBs = knowledgeBases.value.filter(kb => agentForm.value.knowledgeBaseIds.includes(kb.id));

    const md = `# ${agentForm.value.name}

  ## 基本信息
  - **模型**: ${agentForm.value.model}
  - **状态**: ${agentForm.value.status}
  - **记忆**: ${agentForm.value.memoryEnabled ? '已启用' : '未启用'}
  - **描述**: ${agentForm.value.description || '暂无描述'}

  ## 系统提示词
  ${agentForm.value.systemPrompt || '暂无提示词'}

  ## 工具 (${boundTools.length})
  ${boundTools.map(t => `- ${t.displayName} (${t.name})`).join('\n') || '暂无工具'}

  ## Skills (${boundSkills.length})
  ${boundSkills.map(s => `- ${s.name} [${s.category}]`).join('\n') || '暂无 Skills'}

  ## 知识库 (${boundKBs.length})
  ${boundKBs.map(kb => `- ${kb.name} (${kb.chunkCount} chunks)`).join('\n') || '暂无知识库'}

  ## 配置参数
  - **Temperature**: ${agentForm.value.temperature}
  - **Max Tokens**: ${agentForm.value.maxTokens}
  - **公开发布**: ${agentForm.value.published ? '是' : '否'}
  - **API 接入**: ${agentForm.value.apiEnabled ? '是' : '否'}
  ${agentForm.value.publicSlug ? `- **公开标识**: ${agentForm.value.publicSlug}` : ''}

  ---
  *导出时间: ${new Date().toLocaleString()}*
  `;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-${agentForm.value.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    status.value = `Agent "${agentForm.value.name}" 已导出为 Markdown`;
  }

  async function previewSkill(skill: SkillDefinition) {
    try {
      activeSkill.value = await fetchSkillDetail(skill.id, backendBaseUrl.value);
      skillTestInput.value = activeSkill.value.exampleInput || '请演示这个 Skill 如何处理一个真实任务。';
      activeSkillTestResult.value = null;
      skillPreviewOpen.value = true;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '加载 Skill 详情失败';
    }
  }

  function previewSkillById(skillId: string) {
    const skill = availableSkills.value.find((item) => item.id === skillId);
    if (skill) void previewSkill(skill);
  }

  async function runActiveSkillTest() {
    if (!activeSkill.value || skillTesting.value) return;
    if (activeSkill.value.riskLevel === 'high') {
      try {
        await ElMessageBox.confirm('该 Skill 标记为高风险，可能调用工具、读取文件或发送外部请求。确认继续测试？', '高风险 Skill 确认', {
          confirmButtonText: '继续测试',
          cancelButtonText: '取消',
          type: 'warning',
        });
      } catch {
        status.value = '已取消 Skill 测试';
        return;
      }
    }
    skillTesting.value = true;
    try {
      activeSkillTestResult.value = await apiTestSkill(activeSkill.value.id, skillTestInput.value.trim(), backendBaseUrl.value);
      status.value = `Skill 测试完成：${activeSkillTestResult.value.latencyMs}ms`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : 'Skill 测试失败';
    } finally {
      skillTesting.value = false;
    }
  }

  async function copySkillToCustom(skill: SkillDefinition) {
    try {
      const copied = await apiCopySkill(skill.id, backendBaseUrl.value);
      availableSkills.value = [copied, ...availableSkills.value.filter((item) => item.id !== copied.id)];
      status.value = `已复制为自定义 Skill：${copied.name}`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '复制 Skill 失败';
    }
  }

  async function deleteCustomSkill(skill: SkillDefinition) {
    if (skill.source !== 'custom') {
      status.value = '平台内置 Skill 不允许删除';
      return;
    }
    try {
      await ElMessageBox.confirm(`确认删除 Skill「${skill.name}」？绑定关系也会移除。`, '删除 Skill', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      await apiDeleteSkill(skill.id, backendBaseUrl.value);
      availableSkills.value = availableSkills.value.filter((item) => item.id !== skill.id);
      agentForm.value.skillIds = agentForm.value.skillIds.filter((id) => id !== skill.id);
      if (activeSkill.value?.id === skill.id) skillPreviewOpen.value = false;
      status.value = 'Skill 已删除';
    } catch (error) {
      if (error instanceof Error) status.value = error.message;
    }
  }

  function startEditSkill(skill: SkillDefinition) {
    if (skill.source !== 'custom') {
      status.value = '平台内置 Skill 不允许直接编辑，请先复制为自定义 Skill';
      return;
    }
    editingSkillId.value = skill.id;
    skillForm.value = {
      name: skill.name,
      description: skill.description,
      category: skill.category,
      content: skill.content,
      icon: skill.icon || 'Star',
      riskLevel: skill.riskLevel,
      exampleInput: skill.exampleInput || '',
      exampleOutput: skill.exampleOutput || '',
    };
    status.value = `正在编辑 Skill：${skill.name}`;
  }

  function cancelSkillEdit() {
    editingSkillId.value = '';
    skillForm.value = { name: '', description: '', category: 'custom', content: '', icon: 'Star', riskLevel: 'low', exampleInput: '', exampleOutput: '' };
  }

  async function bindSkillToCurrentAgent(skill: SkillDefinition) {
    const agent = activeAgent.value || (agentForm.value.id ? null : await persistAgent());
    if (!agentForm.value.id && !agent) return;
    agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, skill.id]));
    await saveAgent();
    status.value = `已绑定 Skill：${skill.name}`;
  }

  function skillRiskTagType(risk: SkillDefinition['riskLevel']) {
    if (risk === 'high') return 'danger';
    if (risk === 'medium') return 'warning';
    return 'success';
  }

  // ===== Tool相关函数 =====
  function openToolCreateDialog() {
    toolForm.value = {
      name: '',
      displayName: '',
      description: '',
      icon: '🔧',
      category: 'custom',
      runtime: 'python',
      riskLevel: 'low',
      code: `def run(input: dict, context: dict) -> dict:\n    """工具入口函数"""\n    # input: DAG或Agent传入的参数\n    # context: 运行上下文\n    result = input.get("param", "")\n    return {"result": result}`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      outputSchema: { type: 'object', properties: {} },
      exampleInput: '',
      exampleOutput: '',
      timeout: 30,
      retries: 0,
      permissions: {
        network: false,
        database: false,
        fileRead: false,
        fileWrite: false,
        externalRequest: false,
      },
    };
    toolEditingId.value = '';
    toolCreateDialogVisible.value = true;
  }

  function editTool(tool: CustomTool) {
    toolForm.value = {
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      icon: tool.icon,
      category: tool.category,
      runtime: tool.runtime,
      riskLevel: tool.riskLevel,
      code: tool.code || '',
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      exampleInput: tool.exampleInput || '',
      exampleOutput: tool.exampleOutput || '',
      timeout: tool.timeout,
      retries: tool.retries,
      permissions: { ...tool.permissions },
    };
    toolEditingId.value = tool.id;
    toolCreateDialogVisible.value = true;
  }

  async function saveTool() {
    if (!toolForm.value.name.trim() || !toolForm.value.displayName.trim()) {
      status.value = '请填写工具名称';
      return;
    }
    toolCreating.value = true;
    try {
      const tool: CustomTool = {
        id: toolEditingId.value || `tool_${Date.now()}`,
        name: toolForm.value.name,
        displayName: toolForm.value.displayName,
        description: toolForm.value.description,
        icon: toolForm.value.icon,
        category: toolForm.value.category,
        type: 'custom',
        runtime: toolForm.value.runtime,
        status: 'enabled',
        riskLevel: toolForm.value.riskLevel,
        version: '1.0.0',
        inputSchema: toolForm.value.inputSchema,
        outputSchema: toolForm.value.outputSchema,
        code: toolForm.value.code,
        exampleInput: toolForm.value.exampleInput,
        exampleOutput: toolForm.value.exampleOutput,
        timeout: toolForm.value.timeout,
        retries: toolForm.value.retries,
        permissions: { ...toolForm.value.permissions },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        callCount: 0,
      };

      if (toolEditingId.value) {
        const idx = customTools.value.findIndex(t => t.id === toolEditingId.value);
        if (idx >= 0) customTools.value.splice(idx, 1, tool);
      } else {
        customTools.value.unshift(tool);
      }
      toolCreateDialogVisible.value = false;
      status.value = `工具 "${tool.displayName}" 已保存`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '保存工具失败';
    } finally {
      toolCreating.value = false;
    }
  }

  function deleteTool(toolId: string) {
    customTools.value = customTools.value.filter(t => t.id !== toolId);
    status.value = '工具已删除';
  }

  function previewTool(tool: CustomTool) {
    activeTool.value = tool;
    toolPreviewVisible.value = true;
  }

  function openToolTest(tool: CustomTool) {
    activeTool.value = tool;
    toolTestInput.value = tool.exampleInput || '{}';
    toolTestResult.value = null;
    toolTestVisible.value = true;
  }

  async function runToolTest() {
    if (!activeTool.value) return;
    toolTesting.value = true;
    try {
      // 模拟工具测试
      await new Promise(resolve => setTimeout(resolve, 1000));
      toolTestResult.value = {
        success: true,
        output: { result: '测试结果示例' },
        logs: ['工具执行开始...', '参数校验通过', '执行完成'],
        duration: 156,
        error: null,
      };
    } catch (error) {
      toolTestResult.value = {
        success: false,
        output: null,
        logs: [],
        duration: 0,
        error: error instanceof Error ? error.message : '测试失败',
      };
    } finally {
      toolTesting.value = false;
    }
  }

  function toggleToolStatus(tool: CustomTool) {
    tool.status = tool.status === 'enabled' ? 'disabled' : 'enabled';
  }

  // DAG节点相关函数（getDagNodeInfo从composables导入）
  function openDagNodeConfig(node: any) {
    activeDagNode.value = node;
    const nodeInfo = getDagNodeInfo(node.type);
    dagNodeConfig.value = nodeInfo?.configSchema ? { ...nodeInfo.configSchema, ...node.config } : {};
    dagNodeConfigVisible.value = true;
  }

  function saveDagNodeConfig() {
    if (activeDagNode.value) {
      activeDagNode.value.config = { ...dagNodeConfig.value };
      dagNodeConfigVisible.value = false;
      status.value = '节点配置已保存';
    }
  }

  async function createDefaultWorkflow() {
    // 默认生成知识库问答DAG
    applyWorkflowDagTemplate(dagTemplates[0]);
  }

  function applyWorkflowDagTemplate(template: any) {
    if (!template) {
      status.value = '未找到可用的 DAG 模板';
      return;
    }
    applyDagTemplate(template, workflowCanvasNodes.value, (nodes) => {
      workflowCanvasNodes.value = nodes;
    });
    workflowCanvasConnecting.value = '';
    activeWorkflowRun.value = null;
    status.value = `已应用模板: ${template.name || 'DAG 模板'}`;
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
      showTeamCreateDialog.value = false;
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
      showVersionCreateDialog.value = false;
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
      showTestSuiteCreateDialog.value = false;
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
      showTestCaseCreateDialog.value = false;
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
      const selectedServer = mcpServerOptions.find((item) => item.value === mcpForm.value.serverType);
      const server = await apiCreateMcpServer({
        name: mcpForm.value.name.trim() || selectedServer?.label || 'Notion',
        serverType: mcpForm.value.serverType,
        config: { token: mcpForm.value.token.trim() },
        enabled: true,
      }, backendBaseUrl.value);
      mcpServers.value = [server, ...mcpServers.value.filter((item) => item.id !== server.id)];
      mcpForm.value.name = selectedServer?.label || 'Notion';
      mcpForm.value.token = '';
      showMcpCreateDialog.value = false;
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
      showMcpTestDialog.value = false;
      activeMcpTestServerId.value = '';
    } catch (error) {
      status.value = error instanceof Error ? error.message : '测试 MCP 失败';
    } finally {
      mcpTesting.value = false;
    }
  }

  function openMcpTestDialog(serverId: string) {
    activeMcpTestServerId.value = serverId;
    mcpForm.value.query = '';
    showMcpTestDialog.value = true;
  }

  function syncWorkflowCanvasFromSelected() {
    const workflow = selectedWorkflow.value;
    if (!workflow) {
      workflowCanvasNodes.value = [];
      return;
    }
    workflowCanvasNodes.value = workflow.nodes.map((node, index) => {
      const position = (node.config.position ?? {}) as { x?: unknown; y?: unknown };
      return {
        ...node,
        config: { ...node.config },
        x: typeof position.x === 'number' ? position.x : 40 + index * 210,
        y: typeof position.y === 'number' ? position.y : 80 + (index % 2) * 110,
      };
    });
  }

  function createWorkflowNodeConfig(type: WorkflowNode['type']): Record<string, unknown> {
    if (type === 'prompt') return { template: '请基于上游内容继续处理:\n{{input}}', nextIds: [] };
    if (type === 'knowledge') return { kbIds: [...agentForm.value.knowledgeBaseIds], nextIds: [] };
    if (type === 'skill') {
      const skillId = agentForm.value.skillIds[0] || availableSkills.value[0]?.id || '';
      return { skillId, input: '{{input}}', nextIds: [] };
    }
    if (type === 'tool') {
      const toolId = agentForm.value.toolIds[0] || availableTools.value[0]?.id || '';
      return { toolId, args: { text: '{{input}}' }, nextIds: [] };
    }
    if (type === 'memory') return { agentId: agentForm.value.id, nextIds: [] };
    return { agentId: agentForm.value.id, input: '{{input}}', nextIds: [] };
  }

  // DAG节点拖拽
  let dagNodeDragging: DagNodeItem | null = null;

  function startDagNodeDrag(node: DagNodeItem) {
    dagNodeDragging = node;
  }

  function dropDagNode(event: DragEvent) {
    if (!dagNodeDragging) return;
    const draggedNode = dagNodeDragging;
    const canvas = event.currentTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left + canvas.scrollLeft - 95;
    const y = event.clientY - rect.top + canvas.scrollTop - 36;
    const maxX = Math.max(8, canvas.clientWidth - 210);
    const maxY = Math.max(8, canvas.clientHeight - 120);
    
    const count = workflowCanvasNodes.value.length;
    workflowCanvasNodes.value.push({
      id: createId(`dag-${draggedNode.type}`),
      type: draggedNode.type as any,
      name: draggedNode.label,
      config: {},
      x: Math.max(8, Math.min(maxX, x || 48 + (count % 4) * 230)),
      y: Math.max(8, Math.min(maxY, y || 72 + Math.floor(count / 4) * 136)),
    });
    
    dagNodeDragging = null;
    status.value = `已添加节点: ${draggedNode.label}`;
  }

  function addWorkflowCanvasNode(type: WorkflowNode['type']) {
    const count = workflowCanvasNodes.value.length;
    workflowCanvasNodes.value.push({
      id: createId(`wf-${type}`),
      type,
      name: workflowCanvasTypes.find((item) => item.type === type)?.label || type,
      config: createWorkflowNodeConfig(type),
      x: 36 + (count % 3) * 210,
      y: 72 + Math.floor(count / 3) * 118,
    });
  }

  function startWorkflowNodeDrag(node: WorkflowCanvasNode, event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const rect = target.parentElement?.getBoundingClientRect();
    workflowCanvasDrag.value = {
      id: node.id,
      offsetX: event.clientX - (rect?.left ?? 0) - node.x,
      offsetY: event.clientY - (rect?.top ?? 0) - node.y,
    };
  }

  function dragWorkflowNode(event: PointerEvent) {
    const drag = workflowCanvasDrag.value;
    if (!drag) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const canvas = event.currentTarget as HTMLElement;
    const node = workflowCanvasNodes.value.find((item) => item.id === drag.id);
    if (!node) return;
    node.x = Math.max(8, Math.min(Math.max(8, canvas.clientWidth - 210), event.clientX - rect.left - drag.offsetX));
    node.y = Math.max(8, Math.min(Math.max(8, canvas.clientHeight - 120), event.clientY - rect.top - drag.offsetY));
  }

  function stopWorkflowNodeDrag() {
    workflowCanvasDrag.value = null;
  }

  function connectWorkflowNode(nodeId: string) {
    if (!workflowCanvasConnecting.value) {
      workflowCanvasConnecting.value = nodeId;
      return;
    }
    if (workflowCanvasConnecting.value === nodeId) {
      workflowCanvasConnecting.value = '';
      return;
    }
    const source = workflowCanvasNodes.value.find((node) => node.id === workflowCanvasConnecting.value);
    if (source) {
      const nextIds = Array.isArray(source.config.nextIds) ? source.config.nextIds.map(String) : [];
      source.config = { ...source.config, nextIds: Array.from(new Set([...nextIds, nodeId])) };
    }
    workflowCanvasConnecting.value = '';
  }

  function removeWorkflowCanvasNode(nodeId: string) {
    workflowCanvasNodes.value = workflowCanvasNodes.value
      .filter((node) => node.id !== nodeId)
      .map((node) => {
        const nextIds = Array.isArray(node.config.nextIds) ? node.config.nextIds.map(String).filter((id) => id !== nodeId) : [];
        return { ...node, config: { ...node.config, nextIds } };
      });
    if (workflowCanvasConnecting.value === nodeId) workflowCanvasConnecting.value = '';
  }

  async function saveWorkflowCanvas() {
    if (workflowCanvasSaving.value || workflowCanvasNodes.value.length === 0) return;
    workflowCanvasSaving.value = true;
    try {
      const nodes: WorkflowNode[] = workflowCanvasNodes.value.map((node) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        config: {
          ...node.config,
          position: { x: node.x, y: node.y },
          nextIds: Array.isArray(node.config.nextIds) ? node.config.nextIds.map(String) : [],
        },
      }));
      const workflow = await apiCreateWorkflow({
        name: `${agentForm.value.name || '可视化'} DAG Workflow`,
        description: '通过可拖拽 DAG 编辑器创建，连线会决定执行顺序。',
        nodes,
      }, backendBaseUrl.value);
      workflows.value = [workflow, ...workflows.value.filter((item) => item.id !== workflow.id)];
      activeWorkflowId.value = workflow.id;
      status.value = 'Workflow DAG 已保存';
    } catch (error) {
      status.value = error instanceof Error ? error.message : '保存 Workflow DAG 失败';
    } finally {
      workflowCanvasSaving.value = false;
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

  function formatKeyRotationNotice(rotation: { provider?: string; attempts?: number; reason?: string } | null | undefined): string {
    if (!rotation?.provider) return '';
    const reasonLabel = rotation.reason === 'rate_limit'
      ? '限流'
      : rotation.reason === 'network'
        ? '网络重试'
        : rotation.reason === 'balance_exhausted'
          ? '余额不足'
          : '上游重试';
    return `Key 已轮转：${rotation.provider} · ${rotation.attempts || 1}次 · ${reasonLabel}`;
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
    let keyRotationNotice = '';

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
        const rotationHeader = res.headers.get('x-provider-key-rotation');
        if (rotationHeader) {
          try {
            keyRotationNotice = formatKeyRotationNotice(JSON.parse(rotationHeader));
            if (keyRotationNotice) status.value = keyRotationNotice;
          } catch {}
        }

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
        status.value = keyRotationNotice || '路由回复完成';
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
            onKeyRotation: (rotation) => {
              keyRotationNotice = formatKeyRotationNotice(rotation);
              if (keyRotationNotice) status.value = keyRotationNotice;
            },
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
            onDone: () => { status.value = keyRotationNotice || '回复生成完成'; triggerSync(); },
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
    adminNewKeyProvider.value =
      adminApiKeyProviderFilter.value ||
      adminProviderConfigs.value[0]?.providerName ||
      'qwen';
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
      pageModelsConfig.value = {
        ...pageModelsConfig.value,
        model_tier_mapping: JSON.stringify(adminModelTiers.value.tiers || {}),
        tier_labels: JSON.stringify(adminModelTiers.value.labels || {}),
        tier_examples: JSON.stringify(adminModelTiers.value.examples || {}),
      };
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
      adminTierEditExamples.value = adminModelTiers.value.examples?.[tierKey] || (adminModelTiers.value.tiers[tierKey] || []).join(', ');
      adminTierEditIsNew.value = false;
    } else {
      adminTierEditKey.value = '';
      adminTierEditLabel.value = '';
      adminTierEditPromptPrice.value = 0;
      adminTierEditCompletionPrice.value = 0;
      adminTierEditDesc.value = '';
      adminTierEditExamples.value = '';
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
      const newExamples = { ...(adminModelTiers.value.examples || {}) };
      const examples = adminTierEditExamples.value.trim();
      if (examples) newExamples[key] = examples;
      else delete newExamples[key];

      await updateAdminModelTiers({ tiers: newTiers, prices: newPrices, labels: newLabels, examples: newExamples }, backendBaseUrl.value);
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
      const newLabels = { ...(adminModelTiers.value.labels || {}) };
      delete newLabels[tierKey];
      const newExamples = { ...(adminModelTiers.value.examples || {}) };
      delete newExamples[tierKey];
      await updateAdminModelTiers({ tiers: newTiers, prices: newPrices, labels: newLabels, examples: newExamples }, backendBaseUrl.value);
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
    return models.value.filter((m) => m.id !== 'auto').map((m) => {
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
  interface TierRow { key: string; label: string; models: string[]; promptPrice: number; completionPrice: number; sampleModels: string }

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
      sampleModels: adminModelTiers.value.examples?.[key] || models.join(', '),
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
    let dbExamples: Record<string, string> = {};
    let tierModels: Record<string, string[]> = {};
    try {
      const raw = pageModelsConfig.value['tier_labels'];
      if (raw) dbLabels = JSON.parse(raw);
      const rawExamples = pageModelsConfig.value['tier_examples'];
      if (rawExamples) dbExamples = JSON.parse(rawExamples);
      const rawMapping = pageModelsConfig.value['model_tier_mapping'];
      if (rawMapping) tierModels = JSON.parse(rawMapping);
    } catch {}

    return Array.from(tierMap.entries()).map(([name, prices]) => {
      const label = dbLabels[`tier_${name}`] || defaultLabelMap[name]?.label || name;
      const tagType = defaultLabelMap[name]?.tagType || 'info';
      const tierKey = `tier_${name}`;
      const models = tierModels[tierKey] || tierModels[name] || [];
      const sampleModels = dbExamples[tierKey] || dbExamples[name] || models.join(', ');
      return { key: name, label, tagType, promptPrice: prices.prompt, completionPrice: prices.completion, sampleModels };
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
      else if (mode === 'rag') window.location.hash = '/rag';
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

  watch(builderBlockConfigs, () => {
    if (agentBuilderCanvas.value.length > 0) {
      applyBuilderConfigs();
    }
  }, { deep: true });

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

  return {
    Cpu,
    ChatDotRound,
    DataAnalysis,
    Delete,
    Document,
    EditPen,
    Headset,
    InfoFilled,
    Lightning,
    MoreFilled,
    Monitor,
    Picture,
    PictureFilled,
    Plus,
    Promotion,
    Refresh,
    Search,
    Setting,
    Star,
    Sunny,
    SwitchButton,
    TrendCharts,
    User,
    UserFilled,
    VideoCamera,
    Coin,
    useDagNodes,
    getModelLogo,
    createId,
    buildSessionTitle,
    pickTwoRandomModels,
    shuffleArray,
    formatTime,
    getStoredValue,
    setStoredValue,
    renderMarkdown,
    MagicStick,
    BASE_URL_KEY,
    THEME_KEY,
    getPreferredTheme,
    applyTheme,
    theme,
    isDark,
    darkMediaQuery,
    menuBgColor,
    menuTextColor,
    menuActiveColor,
    backendBaseUrl,
    isSettingsOpen,
    isAuthDialogOpen,
    authUser,
    authMode,
    authUsername,
    authPassword,
    authEmail,
    authVerificationCode,
    authInvitationCode,
    authLoading,
    authError,
    codeCountdown,
    codeTimer,
    userInvitationCode,
    topUpAmount,
    topUpLoading,
    rechargeDialogVisible,
    rechargeAmount,
    rechargeLoading,
    rechargeQrCode,
    rechargeOrderId,
    rechargeError,
    rechargeChecking,
    rechargePollTimer,
    rechargeOrders,
    rechargeOrdersLoading,
    billingRules,
    billingLedger,
    agents,
    activeAgentId,
    agentLoading,
    agentSaving,
    agentPublishing,
    agentRunning,
    agentGenerating,
    agentPrompt,
    agentImageUrlInput,
    agentRuns,
    activeAgentRun,
    agentWorkspaceMode,
    agentPageTab,
    agentConsoleTab,
    dagNodeCategories,
    dagTemplates,
    getDagNodeInfo,
    applyDagTemplate,
    applyWorkflowDagTemplate,
    availableTools,
    knowledgeBases,
    agentMemories,
    availableSkills,
    workflows,
    agentTeams,
    mcpServers,
    agentVersions,
    agentTestSuites,
    agentTestCases,
    marketplaceTemplates,
    agentResourceLoading,
    knowledgeCreating,
    knowledgeDocSaving,
    knowledgeFileParsing,
    knowledgeDocuments,
    knowledgeDocPreviewVisible,
    knowledgeDocPreview,
    showKnowledgeCreateDialog,
    memorySaving,
    skillCreating,
    showSkillCreateDialog,
    skillPreviewOpen,
    showTeamCreateDialog,
    showMcpCreateDialog,
    showMcpTestDialog,
    showTestSuiteCreateDialog,
    showTestCaseCreateDialog,
    showMarketplacePublishDialog,
    showVersionCreateDialog,
    showEvaluationDialog,
    showMemoryCreateDialog,
    skillTesting,
    activeSkill,
    activeSkillTestResult,
    skillTestInput,
    editingSkillId,
    skillFilters,
    workflowCreating,
    workflowRunning,
    teamCreating,
    teamRunning,
    mcpSaving,
    mcpTesting,
    versionSaving,
    testSaving,
    testRunning,
    marketplaceLoading,
    marketplaceInstalling,
    marketplacePublishing,
    activeWorkflowId,
    workflowInput,
    activeWorkflowRun,
    activeTeamId,
    teamInput,
    activeTeamRun,
    activeTestSuiteId,
    activeTestRun,
    activeMcpTestServerId,
    agentEvaluations,
    agentStats,
    agentEvaluationLoading,
    agentEvaluationSaving,
    evaluationForm,
    generatorForm,
    customTools,
    toolCreateDialogVisible,
    toolPreviewVisible,
    toolTestVisible,
    activeTool,
    toolTestInput,
    toolTestResult,
    toolTesting,
    toolCreating,
    toolEditingId,
    toolForm,
    dagNodeConfigVisible,
    activeDagNode,
    dagNodeConfig,
    agentForm,
    knowledgeForm,
    knowledgeDocForm,
    ragLabForm,
    ragLabSearching,
    ragLabResults,
    memoryForm,
    skillForm,
    teamForm,
    mcpForm,
    mcpServerOptions,
    versionForm,
    testSuiteForm,
    testCaseForm,
    marketplaceForm,
    agentBuilderBlocks,
    agentBuilderCanvas,
    agentBuilderDragging,
    agentBuilderSkillDragging,
    showBuilderGuide,
    activeBuilderBlock,
    builderBlockConfigs,
    workflowCanvasNodes,
    workflowCanvasConnecting,
    workflowCanvasDrag,
    workflowCanvasSaving,
    workflowCanvasTypes,
    selectedWorkflow,
    workflowCanvasEdges,
    skillCategories,
    filteredSkills,
    agentPublicEndpoint,
    agentApiEndpoint,
    agentGuideCards,
    apiKeys,
    apiKeyLoading,
    apiKeyCreateDialog,
    apiKeyNewName,
    errorCodes,
    models,
    selectedModel,
    pageModelsConfig,
    getModelStorageKey,
    restoreSelectedModel,
    persistSelectedModel,
    getMmModelKey,
    restoreMmModel,
    persistMmModel,
    getTtsModelKey,
    restoreTtsModel,
    persistTtsModel,
    getVisionModelKey,
    restoreVisionModel,
    persistVisionModel,
    isLoadingModels,
    status,
    isAuthLoaded,
    sessions,
    activeSessionId,
    draft,
    isComposing,
    isSubmitting,
    requestId,
    isSessionLoaded,
    pageMode,
    battlePrompt,
    isBattling,
    battleStatus,
    battleLeftModel,
    battleRightModel,
    battlePanels,
    groupPrompt,
    isGrouping,
    groupMessages,
    routerEnabled,
    routerIntent,
    routerConfidence,
    routerSelectedModel,
    routerReason,
    routerFallbacks,
    routerDebug,
    routerRules,
    routerLoading,
    collabMode,
    collabPrompt,
    collabRunning,
    collabModels,
    collabSelectedModels,
    collabModelPickerOpen,
    collabPanels,
    collabSummary,
    collabSummaryStatus,
    collabAbortController,
    collabLastQuery,
    collabLastMode,
    getCollabModelLogo,
    adminStats,
    adminUsers,
    adminUsersTotal,
    adminUsersPage,
    adminUsersSearch,
    adminBilling,
    adminBillingTotal,
    adminBillingPage,
    adminBillingFilterUserId,
    adminBillingFilterModel,
    adminEditUserDialog,
    adminEditUserId,
    adminEditUserCredits,
    adminEditUserRole,
    adminEditUserUsername,
    adminTab,
    adminDailyUsage,
    adminChartDays,
    adminTodayStats,
    adminModelUsage,
    adminResetPwdDialog,
    adminResetPwdUserId,
    adminResetPwdUsername,
    adminResetPwdValue,
    adminBillingFromDate,
    adminBillingToDate,
    adminProviderKeyCounts,
    adminApiKeyProviderFilter,
    adminSettings,
    adminEditSettingDialog,
    adminEditSettingKey,
    adminEditSettingValue,
    adminEditSettingDesc,
    adminEditSettingModels,
    adminEditModelTags,
    adminModelTiers,
    adminTierEditDialog,
    adminTierEditKey,
    adminTierEditLabel,
    adminTierEditPromptPrice,
    adminTierEditCompletionPrice,
    adminTierEditDesc,
    adminTierEditExamples,
    adminTierEditIsNew,
    adminEditSettingTagFilter,
    adminEditSettingTextMode,
    filteredModelsForSetting,
    consoleDailyUsage,
    consoleChartDays,
    adminProviderKeys,
    adminAddKeyDialog,
    adminNewKeyProvider,
    adminNewKeyName,
    adminNewKeyValue,
    adminProviderConfigs,
    adminEditConfigDialog,
    adminEditConfigId,
    adminEditConfigForm,
    adminIsNewConfig,
    adminChartInstance,
    consoleChartInstance,
    threadRef,
    groupThreadRef,
    chatAbortController,
    battleAbortController,
    groupAbortController,
    sessionsSyncTimer,
    activeSession,
    activeMessages,
    sidebarSessions,
    isAuthenticated,
    isAdmin,
    activeAgent,
    authCreditsText,
    authSpentText,
    apiBaseUrl,
    battleStatusTagType,
    panelStatusTagType,
    onConsoleEnter,
    triggerSync,
    loadModels,
    resetAgentForm,
    fillAgentForm,
    refreshAgentStudio,
    loadAgentResources,
    loadAgentMemories,
    loadAgentEvaluations,
    loadAgentVersions,
    loadAgentTestSuites,
    loadAgents,
    loadAgentRuns,
    createAgentDraft,
    selectAgent,
    selectAgentById,
    startAgentBuilderDrag,
    startSkillBuilderDrag,
    dropAgentBuilderBlock,
    removeAgentBuilderBlock,
    clearAgentBuilderCanvas,
    applyAgentBuilder,
    applyBuilderConfigs,
    persistAgent,
    saveAgentPublication,
    generateAgentFromRequirement,
    installMarketplaceTemplate,
    publishCurrentAgentToMarketplace,
    getToolLabelById,
    confirmToolExecutionIfNeeded,
    saveAgent,
    removeAgent,
    runCurrentAgent,
    selectAgentRun,
    agentRunTagType,
    agentEvalTagType,
    evaluateActiveAgentRun,
    formatAgentDate,
    formatStepMetadata,
    createKnowledgeBaseFromForm,
    addDocumentToKnowledgeBase,
    handleKnowledgeFileUpload,
    loadKnowledgeDocuments,
    previewKnowledgeDocument,
    deleteKnowledgeDocument,
    formatDate,
    runRagLabSearch,
    createAgentMemory,
    createSkillFromForm,
    exportSkillAsMarkdown,
    exportAgentAsJson,
    exportAgentAsMarkdown,
    previewSkill,
    previewSkillById,
    runActiveSkillTest,
    copySkillToCustom,
    deleteCustomSkill,
    startEditSkill,
    cancelSkillEdit,
    bindSkillToCurrentAgent,
    skillRiskTagType,
    openToolCreateDialog,
    editTool,
    saveTool,
    deleteTool,
    previewTool,
    openToolTest,
    runToolTest,
    toggleToolStatus,
    openDagNodeConfig,
    saveDagNodeConfig,
    createDefaultWorkflow,
    createTeamFromForm,
    runSelectedTeam,
    createVersionFromForm,
    restoreVersion,
    createTestSuiteFromForm,
    createTestCaseFromForm,
    loadSelectedTestCases,
    runSelectedTestSuite,
    createMcpServerFromForm,
    testMcpServer,
    openMcpTestDialog,
    syncWorkflowCanvasFromSelected,
    createWorkflowNodeConfig,
    dagNodeDragging,
    startDagNodeDrag,
    dropDagNode,
    addWorkflowCanvasNode,
    startWorkflowNodeDrag,
    dragWorkflowNode,
    stopWorkflowNodeDrag,
    connectWorkflowNode,
    removeWorkflowCanvasNode,
    saveWorkflowCanvas,
    runSelectedWorkflow,
    bootstrapAuth,
    fetchUserInvitationCode,
    submitAuth,
    onAuthDialogClosed,
    handleSendCode,
    loadUserData,
    handleUserMenu,
    logout,
    handleTopUp,
    openRechargeDialog,
    submitRecharge,
    startRechargePolling,
    stopRechargePolling,
    loadRechargeOrders,
    handleCheckPayment,
    closeRechargeDialog,
    refreshBillingData,
    upsertActiveSession,
    submitPrompt,
    stopChatGeneration,
    loadRouterRules,
    submitRouterPrompt,
    startCollab,
    clearCollab,
    stopCollab,
    createNewChat,
    handleSoftDeleteSession,
    clearChat,
    loadAdminStats,
    loadAdminUsers,
    loadAdminBilling,
    openEditUser,
    saveEditUser,
    loadAdminProviderKeys,
    openAddProviderKey,
    saveAddProviderKey,
    deleteProviderKey,
    loadAdminProviderConfigs,
    openAddConfig,
    openEditConfig,
    saveConfig,
    toggleProvider,
    deleteProviderConfig,
    loadAdminTodayStats,
    loadAdminModelUsage,
    modelChartInstance,
    viewUserBilling,
    openResetPassword,
    saveResetPassword,
    handleDeleteUser,
    handleExportBillingCsv,
    loadAdminBillingWithDates,
    loadAdminProviderKeyCounts,
    loadAdminSettings,
    loadAdminModelTiers,
    openEditTier,
    saveTierEdit,
    deleteAdminTier,
    modelTierSearch,
    modelTierTagFilter,
    modelTierMap,
    allModelTierRows,
    filteredModelTierRows,
    unassignedCount,
    changeModelTier,
    tierDefaultLabels,
    tierRows,
    tierTagType,
    defaultPricePrompt,
    defaultPriceCompletion,
    adminDefaultPromptPrice,
    adminDefaultCompletionPrice,
    initDefaultPriceFields,
    saveDefaultPrices,
    consolePricingRows,
    openEditSetting,
    toggleModelTag,
    toggleSettingTextMode,
    saveEditSetting,
    adminRouterRules,
    adminRouterEditDialog,
    adminRouterEditIntent,
    adminRouterEditModels,
    loadAdminRouterRules,
    openAdminRouterEdit,
    saveAdminRouterRule,
    deleteAdminRouterRule,
    renderLineChart,
    renderModelUsageChart,
    loadAdminDailyUsage,
    loadConsoleDailyUsage,
    disposeCharts,
    darkMediaQuery2,
    onDarkChange,
    switchPage,
    startBattle,
    stopBattle,
    startGroupChat,
    clearGroupChat,
    stopGroupChat,
    visionPrompt,
    visionImageBase64,
    visionImageName,
    visionModel,
    visionMessages,
    isVisionSubmitting,
    visionFileRef,
    visionAbortController,
    modelTagsMap,
    getModelTags,
    chatModels,
    battleModels,
    groupModelList,
    getPageModels,
    visionModels,
    ttsText,
    ttsVoice,
    ttsStyleTag,
    ttsStyleInstruction,
    ttsSingingMode,
    ttsModeSegment,
    ttsAudioUrl,
    ttsAudioLoading,
    ttsError,
    ttsAudioRef,
    ttsHistory,
    ttsModel,
    ttsModels,
    multimodalTab,
    videoFile,
    videoUrl,
    videoAnalysis,
    videoAnalysisRunning,
    videoRef,
    drivingCanvasRef,
    drivingRunning,
    drivingSpeed,
    drivingSteering,
    drivingAutoPilot,
    drivingStats,
    drivingAnimationId,
    drivingLastTime,
    drivingRoadOffset,
    drivingVehicles,
    drivingEgoX,
    retrievalQuery,
    retrievalResults,
    retrievalLoading,
    mmChatMessages,
    mmChatPrompt,
    mmChatImageBase64,
    mmChatImageName,
    mmChatImages,
    mmChatAudioBase64,
    mmChatAudioName,
    mmChatVideoUrl,
    mmChatVideoName,
    mmChatMediaType,
    mmChatFileRef,
    mmChatAudioRef,
    mmChatVideoRef,
    isMmChatSubmitting,
    mmChatAbortController,
    drivingAiAnalyzing,
    drivingAiAnalysis,
    drivingAiAbortController,
    drivingAiCommand,
    drivingAiIntervalSec,
    drivingAiIntervalId,
    multimodalModel,
    handleVisionImageUpload,
    removeVisionImage,
    openImageInNewTab,
    submitVisionPrompt,
    clearVisionChat,
    stopVisionChat,
    TTS_STYLE_TAGS,
    TTS_AUDIO_TAGS,
    TTS_VOICES,
    insertTtsTag,
    onTtsModeChange,
    generateTts,
    initDrivingSim,
    LANE_COLORS,
    VEHICLE_TYPES,
    getLaneCenter,
    spawnVehicle,
    drawCar,
    tickDrivingSim,
    startDrivingSim,
    stopDrivingSim,
    handleVideoUpload,
    runVideoAnalysis,
    stopVideoAnalysis,
    searchImages,
    handleMmImageUpload,
    handleMmAudioUpload,
    handleMmVideoUpload,
    removeMmMedia,
    submitMmChat,
    stopMmChat,
    clearMmChat,
    analyzeDrivingScene,
    stopDrivingAnalysis,
    loadApiKeys,
    openCreateApiKey,
    createApiKey,
    revokeApiKey,
    copyToClipboard,
    openVideoUploadInput,
  }
}
