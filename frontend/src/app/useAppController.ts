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
  deleteMemory as apiDeleteMemory,
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
  fetchAgentRun,
  fetchAgentEvaluations,
  fetchAgentStats,
  fetchAgentTestRuns,
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
  streamAgentRun,
  topUp,
  updateAgent as apiUpdateAgent,
  updateAgentPublication as apiUpdateAgentPublication,
  updateMemory as apiUpdateMemory,
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
  type AgentTestRun,
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
  let agentRunAbortController: AbortController | null = null;

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
  const activeAgentTraceStepId = ref<number | null>(null);
  const agentTraceReplayIndex = ref(0);
  const agentTraceReplayPlaying = ref(false);
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
  const agentTestRuns = ref<AgentTestRun[]>([]);
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
  const activeTestRun = ref<AgentTestRun | null>(null);
  const activeMcpTestServerId = ref('');
  const agentEvaluations = ref<AgentEvaluation[]>([]);
  const agentStats = ref<AgentRunStats | null>(null);
  const agentEvaluationLoading = ref(false);
  const agentEvaluationSaving = ref(false);
  const evaluationForm = ref({
    expectedOutput: '',
    rubric: '',
    judgeModel: '',
    mode: 'hybrid' as 'rules' | 'llm' | 'hybrid',
  });
  const generatorForm = ref({
    requirement: '',
  });
  const agentCreateWizardStep = ref(0);
  const agentCreateWizardAdvancedOpen = ref<string[]>([]);
  const selectedAgentTemplateId = ref('general');
  const agentCreationGoal = ref('');
  const showAgentExportDialog = ref(false);

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
  const editingMemoryId = ref('');
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
  const agentCreationTemplates = [
    {
      id: 'general',
      name: '通用任务助手',
      description: '适合问答、总结、写作和轻量任务处理。',
      icon: 'Sparkles',
      prompt: '你是一个可靠的通用任务型 AI Agent。先理解用户目标，再给出清晰、可执行、可复盘的结果。',
      example: '请总结这段需求，并给出下一步行动清单。',
      toolNames: ['current_time', 'calculator', 'text_stats'],
      skillNames: [],
      memoryEnabled: true,
      temperature: 0.7,
      maxTokens: 2048,
    },
    {
      id: 'support',
      name: '客服支持 Agent',
      description: '适合基于知识库回答客户问题、整理工单和生成回复。',
      icon: 'Headphones',
      prompt: '你是一个专业、耐心的客服支持 Agent。优先基于可用知识库和上下文回答，语气友好，结论明确；无法确定时说明需要补充的信息。',
      example: '客户询问退款规则，请基于知识库给出一段可直接发送的回复。',
      toolNames: ['current_time', 'text_stats'],
      skillNames: ['Research Planner'],
      memoryEnabled: true,
      temperature: 0.4,
      maxTokens: 2048,
    },
    {
      id: 'research',
      name: '研究分析 Agent',
      description: '适合资料梳理、观点对比、报告提纲和结论提炼。',
      icon: 'Search',
      prompt: '你是一个严谨的研究分析 Agent。先拆解问题，再汇总证据、比较观点，最后给出结论、风险和待验证事项。',
      example: '请把这个主题拆成研究问题，并输出一份调研提纲。',
      toolNames: ['current_time', 'text_stats'],
      skillNames: ['Research Planner', 'Data Analyst'],
      memoryEnabled: true,
      temperature: 0.5,
      maxTokens: 4096,
    },
    {
      id: 'code',
      name: '代码协作 Agent',
      description: '适合代码解释、方案设计、调试建议和实现规划。',
      icon: 'Code',
      prompt: '你是一个资深代码协作 Agent。先阅读上下文，优先给出最小可行修改；解释风险、测试方式和边界条件。',
      example: '请分析这个报错原因，并给出最小修复方案。',
      toolNames: ['javascript_runner', 'text_stats'],
      skillNames: ['Code Operator'],
      memoryEnabled: false,
      temperature: 0.3,
      maxTokens: 4096,
    },
    {
      id: 'data',
      name: '数据分析 Agent',
      description: '适合指标解释、表格分析、趋势归因和洞察输出。',
      icon: 'DataAnalysis',
      prompt: '你是一个数据分析 Agent。先确认指标口径，再进行对比、趋势和异常分析，输出结论、证据和后续建议。',
      example: '请分析这组业务指标，找出异常变化和可能原因。',
      toolNames: ['calculator', 'text_stats', 'javascript_runner'],
      skillNames: ['Data Analyst'],
      memoryEnabled: true,
      temperature: 0.4,
      maxTokens: 4096,
    },
    {
      id: 'workflow',
      name: '工作流编排 Agent',
      description: '适合多步骤任务拆解、工具调用和结果自检。',
      icon: 'Promotion',
      prompt: '你是一个工作流编排 Agent。你会把目标拆成步骤，选择合适工具或能力执行，并在输出前进行自检。',
      example: '请把这个任务拆成执行计划，并说明每一步需要的工具。',
      toolNames: ['current_time', 'calculator', 'javascript_runner'],
      skillNames: ['Workflow Orchestrator', 'Research Planner'],
      memoryEnabled: true,
      temperature: 0.5,
      maxTokens: 4096,
    },
  ];

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
    if (saved && saved !== 'qwen3.6-plus' && saved !== 'qwen-3.6-plus' && saved !== 'qwen-3.7-max' && visions.some((m) => m.id === saved)) {
      multimodalModel.value = saved;
    } else if (visions.some((m) => m.id === DRIVING_VISION_MODEL)) {
      multimodalModel.value = DRIVING_VISION_MODEL;
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
  const adminBillingFilterUsername = ref('');
  const adminBillingFilterUserId = adminBillingFilterUsername;
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
    activeAgentTraceStepId.value = null;
    agentTraceReplayIndex.value = 0;
    agentTraceReplayPlaying.value = false;
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
      agentTestRuns.value = [];
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
        agentTestRuns.value = await fetchAgentTestRuns(activeTestSuiteId.value, backendBaseUrl.value);
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
    agentCreateWizardStep.value = 0;
    selectedAgentTemplateId.value = 'general';
    agentCreationGoal.value = '';
    agentCreateWizardAdvancedOpen.value = [];
    agentWorkspaceMode.value = 'develop';
    agentPageTab.value = 'basic';
    status.value = '已创建本地 Agent 草稿';
  }

  function resolveAgentTemplate() {
    return agentCreationTemplates.find((template) => template.id === selectedAgentTemplateId.value)
      ?? agentCreationTemplates[0];
  }

  function resolveToolIdsByNames(names: string[]) {
    return availableTools.value
      .filter((tool) => names.includes(tool.name) || names.includes(tool.displayName))
      .map((tool) => tool.id);
  }

  function resolveSkillIdsByNames(names: string[]) {
    return availableSkills.value
      .filter((skill) => names.includes(skill.name))
      .map((skill) => skill.id);
  }

  function applyAgentTemplate(templateId = selectedAgentTemplateId.value) {
    selectedAgentTemplateId.value = templateId;
    const template = resolveAgentTemplate();
    const defaultModel = agentForm.value.model || (selectedModel.value && selectedModel.value !== 'auto'
      ? selectedModel.value
      : (chatModels.value[0]?.id || models.value[0]?.id || ''));
    const goal = agentCreationGoal.value.trim();
    agentForm.value.name = agentForm.value.id ? agentForm.value.name : template.name;
    agentForm.value.description = goal || template.description;
    agentForm.value.model = defaultModel;
    agentForm.value.systemPrompt = goal
      ? `${template.prompt}\n\n# 当前目标\n${goal}`
      : template.prompt;
    agentForm.value.temperature = template.temperature;
    agentForm.value.maxTokens = template.maxTokens;
    agentForm.value.memoryEnabled = template.memoryEnabled;
    agentForm.value.toolIds = Array.from(new Set([...agentForm.value.toolIds, ...resolveToolIdsByNames(template.toolNames)]));
    agentForm.value.skillIds = Array.from(new Set([...agentForm.value.skillIds, ...resolveSkillIdsByNames(template.skillNames)]));
    if (knowledgeBases.value[0] && ['support', 'research', 'workflow'].includes(template.id)) {
      agentForm.value.knowledgeBaseIds = Array.from(new Set([...agentForm.value.knowledgeBaseIds, knowledgeBases.value[0].id]));
    }
    agentPrompt.value = template.example;
    status.value = `已应用模板：${template.name}`;
  }

  function nextAgentWizardStep() {
    if (agentCreateWizardStep.value === 0) {
      applyAgentTemplate();
    }
    agentCreateWizardStep.value = Math.min(3, agentCreateWizardStep.value + 1);
  }

  function previousAgentWizardStep() {
    agentCreateWizardStep.value = Math.max(0, agentCreateWizardStep.value - 1);
  }

  async function saveAgentFromWizard(runAfterSave = false) {
    if (!agentForm.value.name.trim() || !agentForm.value.model.trim()) {
      status.value = '请填写 Agent 名称并选择模型';
      return;
    }
    if (!agentForm.value.systemPrompt.trim()) {
      const template = resolveAgentTemplate();
      agentForm.value.systemPrompt = template.prompt;
    }
    const saved = await persistAgent();
    if (!saved) return;
    if (runAfterSave) {
      agentWorkspaceMode.value = 'invoke';
      if (!agentPrompt.value.trim()) agentPrompt.value = resolveAgentTemplate().example;
    }
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
      agentCreateWizardStep.value = 3;
      agentWorkspaceMode.value = 'develop';
      agentPageTab.value = 'basic';
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
    activeAgentTraceStepId.value = null;
    agentTraceReplayIndex.value = 0;
    agentTraceReplayPlaying.value = false;
    status.value = 'Agent 正在执行';
    agentRunAbortController = new AbortController();
    try {
      const imageUrls = agentImageUrlInput.value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
      await streamAgentRun(agent.id, { input, imageUrls }, {
        onEvent: (event) => {
          applyAgentRunStreamEvent(event);
        },
        onDone: () => {
          status.value = activeAgentRun.value?.status === 'failed' ? 'Agent 执行失败' : 'Agent 执行完成';
        },
        onAbort: () => {
          status.value = 'Agent 执行已停止';
        },
      }, backendBaseUrl.value, agentRunAbortController.signal);
      agentPrompt.value = '';
      try { authUser.value = await fetchMe(backendBaseUrl.value); } catch {}
      try { billingLedger.value = await fetchBillingLedger(backendBaseUrl.value); } catch {}
      if (agent.id) {
        try { agentRuns.value = await fetchAgentRuns(agent.id, backendBaseUrl.value); } catch {}
      }
      void loadAgents();
    } catch (error) {
      status.value = error instanceof Error ? error.message : '运行 Agent 失败';
    } finally {
      agentRunning.value = false;
      agentRunAbortController = null;
    }
  }

  function applyAgentRunStreamEvent(event: any) {
    if (event.type === 'run_created') {
      activeAgentRun.value = event.run;
      agentRuns.value = [event.run, ...agentRuns.value.filter((item) => item.id !== event.run.id)].slice(0, 20);
      status.value = 'Agent Trace 已开始';
      return;
    }
    if (!activeAgentRun.value && event.runId) return;
    if (event.type === 'step_started' || event.type === 'step_updated' || event.type === 'step_completed') {
      const step = event.step;
      if (!activeAgentRun.value) return;
      const steps = activeAgentRun.value.steps.filter((item) => item.id !== step.id);
      activeAgentRun.value = {
        ...activeAgentRun.value,
        steps: [...steps, step].sort((a, b) => a.id - b.id),
      };
      activeAgentTraceStepId.value = step.id;
      agentTraceReplayIndex.value = Math.max(0, activeAgentRun.value.steps.findIndex((item) => item.id === step.id));
      status.value = `${step.name} · ${step.status}`;
      return;
    }
    if (event.type === 'llm_delta' && activeAgentRun.value) {
      activeAgentRun.value = {
        ...activeAgentRun.value,
        output: event.output,
      };
      return;
    }
    if (event.type === 'run_completed') {
      activeAgentRun.value = event.run;
      activeAgentTraceStepId.value = event.run.steps[event.run.steps.length - 1]?.id ?? null;
      agentTraceReplayIndex.value = Math.max(0, event.run.steps.length - 1);
      agentRuns.value = [event.run, ...agentRuns.value.filter((item) => item.id !== event.run.id)].slice(0, 20);
      status.value = event.run.status === 'succeeded' ? 'Agent 执行完成' : 'Agent 执行失败';
      return;
    }
    if (event.type === 'error') {
      status.value = event.error || 'Agent 执行失败';
      if (activeAgentRun.value) {
        activeAgentRun.value = { ...activeAgentRun.value, status: 'failed', error: event.error || activeAgentRun.value.error };
      }
    }
  }

  function selectAgentRun(run: AgentRun) {
    activeAgentRun.value = run;
    activeAgentTraceStepId.value = run.steps[0]?.id ?? null;
    agentTraceReplayIndex.value = 0;
    agentTraceReplayPlaying.value = false;
  }

  async function openAgentRunTrace(runId: string) {
    if (!runId) return;
    try {
      const run = await fetchAgentRun(runId, backendBaseUrl.value);
      selectAgentRun(run);
      agentRuns.value = [run, ...agentRuns.value.filter((item) => item.id !== run.id)].slice(0, 20);
      agentWorkspaceMode.value = 'invoke';
      status.value = '已打开运行 Trace';
    } catch (error) {
      status.value = error instanceof Error ? error.message : '加载运行 Trace 失败';
    }
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
        judgeModel: evaluationForm.value.judgeModel.trim() || activeAgentRun.value.model || agentForm.value.model || undefined,
        mode: evaluationForm.value.mode,
      }, backendBaseUrl.value);
      agentEvaluations.value = [evaluation, ...agentEvaluations.value.filter((item) => item.id !== evaluation.id)];
      evaluationForm.value.expectedOutput = '';
      evaluationForm.value.rubric = '';
      evaluationForm.value.judgeModel = '';
      evaluationForm.value.mode = 'hybrid';
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

  const activeAgentTraceStep = computed(() => {
    const steps = activeAgentRun.value?.steps ?? [];
    if (activeAgentTraceStepId.value !== null) {
      return steps.find((step) => step.id === activeAgentTraceStepId.value) ?? steps[agentTraceReplayIndex.value] ?? null;
    }
    return steps[agentTraceReplayIndex.value] ?? null;
  });

  const agentTraceReplayMax = computed(() => Math.max(0, (activeAgentRun.value?.steps.length ?? 1) - 1));

  const agentTraceNodes = computed(() => {
    const steps = activeAgentRun.value?.steps ?? [];
    return steps.map((step, index) => ({
      id: String(step.id),
      label: step.name,
      type: step.stepType,
      status: step.status,
      latencyMs: step.latencyMs,
      active: step.id === activeAgentTraceStepId.value || index === agentTraceReplayIndex.value,
    }));
  });

  const agentTraceStageGroups = computed(() => {
    const stages = [
      { id: 'context', label: 'Context', types: ['context', 'memory_read', 'rag', 'knowledge', 'input'] },
      { id: 'capability', label: 'Skill / Tool / RAG', types: ['skill', 'tool', 'rag', 'knowledge_search'] },
      { id: 'llm', label: 'LLM', types: ['llm', 'llm_completion', 'completion'] },
      { id: 'memory', label: 'Memory Write', types: ['memory_write', 'memory'] },
      { id: 'other', label: 'Other', types: [] },
    ];
    const nodes = agentTraceNodes.value;
    return stages
      .map((stage) => ({
        ...stage,
        nodes: nodes.filter((node) => {
          const type = node.type.toLowerCase();
          if (stage.id === 'other') {
            return !stages.some((candidate) => candidate.id !== 'other' && candidate.types.some((item) => type.includes(item)));
          }
          return stage.types.some((item) => type.includes(item));
        }),
      }))
      .filter((stage) => stage.nodes.length > 0);
  });

  const agentTraceLatencyMax = computed(() => Math.max(1, ...agentTraceNodes.value.map((node) => node.latencyMs || 0)));

  const agentTraceEdges = computed(() => {
    const nodes = agentTraceNodes.value;
    return nodes.slice(1).map((node, index) => ({
      from: nodes[index].id,
      to: node.id,
    }));
  });

  function selectAgentTraceStep(stepId: number) {
    const index = activeAgentRun.value?.steps.findIndex((step) => step.id === stepId) ?? -1;
    activeAgentTraceStepId.value = stepId;
    if (index >= 0) agentTraceReplayIndex.value = index;
  }

  function setAgentTraceReplayIndex(index: number) {
    const steps = activeAgentRun.value?.steps ?? [];
    const nextIndex = Math.max(0, Math.min(index, Math.max(0, steps.length - 1)));
    agentTraceReplayIndex.value = nextIndex;
    activeAgentTraceStepId.value = steps[nextIndex]?.id ?? null;
  }

  function toggleAgentTraceReplay() {
    if (!activeAgentRun.value?.steps.length) return;
    agentTraceReplayPlaying.value = !agentTraceReplayPlaying.value;
  }

  let agentTraceReplayTimer: ReturnType<typeof setInterval> | null = null;
  watch(agentTraceReplayPlaying, (playing) => {
    if (agentTraceReplayTimer) {
      clearInterval(agentTraceReplayTimer);
      agentTraceReplayTimer = null;
    }
    if (!playing) return;
    agentTraceReplayTimer = setInterval(() => {
      if (agentTraceReplayIndex.value >= agentTraceReplayMax.value) {
        agentTraceReplayPlaying.value = false;
        return;
      }
      setAgentTraceReplayIndex(agentTraceReplayIndex.value + 1);
    }, 900);
  });

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

  function startEditAgentMemory(memory: MemoryItem) {
    editingMemoryId.value = memory.id;
    memoryForm.value = {
      content: memory.content,
      importance: memory.importance,
    };
    showMemoryCreateDialog.value = true;
  }

  function resetMemoryEditor() {
    editingMemoryId.value = '';
    memoryForm.value = { content: '', importance: 3 };
  }

  async function saveAgentMemory() {
    if (editingMemoryId.value) {
      const content = memoryForm.value.content.trim();
      if (!content || memorySaving.value) return;
      memorySaving.value = true;
      try {
        await apiUpdateMemory(editingMemoryId.value, {
          content,
          importance: memoryForm.value.importance,
        }, backendBaseUrl.value);
        showMemoryCreateDialog.value = false;
        resetMemoryEditor();
        await loadAgentMemories(agentForm.value.id);
        status.value = '记忆已更新';
      } catch (error) {
        status.value = error instanceof Error ? error.message : '更新记忆失败';
      } finally {
        memorySaving.value = false;
      }
      return;
    }
    await createAgentMemory();
  }

  async function deleteAgentMemory(memory: MemoryItem) {
    try {
      await ElMessageBox.confirm(`确定删除这条长期记忆吗？\n\n${memory.content.slice(0, 120)}`, '删除记忆', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch {
      return;
    }
    try {
      await apiDeleteMemory(memory.id, backendBaseUrl.value);
      agentMemories.value = agentMemories.value.filter((item) => item.id !== memory.id);
      status.value = '记忆已删除';
    } catch (error) {
      status.value = error instanceof Error ? error.message : '删除记忆失败';
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

  function buildAgentExportBundle() {
    const boundTools = availableTools.value.filter(t => agentForm.value.toolIds.includes(t.id));
    const boundSkills = availableSkills.value.filter(s => agentForm.value.skillIds.includes(s.id));
    const boundKBs = knowledgeBases.value.filter(kb => agentForm.value.knowledgeBaseIds.includes(kb.id));
    const customToolByName = new Map(customTools.value.map((tool) => [tool.name, tool]));
    return {
      schemaVersion: 'agent.portable.v1',
      exportedAt: new Date().toISOString(),
      agent: {
        name: agentForm.value.name,
        description: agentForm.value.description,
        status: agentForm.value.status,
      },
      prompt: {
        systemPrompt: agentForm.value.systemPrompt,
      },
      runtime: {
        model: agentForm.value.model,
        temperature: agentForm.value.temperature,
        maxTokens: agentForm.value.maxTokens,
        memoryEnabled: agentForm.value.memoryEnabled,
      },
      publication: {
        published: agentForm.value.published,
        apiEnabled: agentForm.value.apiEnabled,
        publicSlug: agentForm.value.publicSlug,
      },
      tools: boundTools.map((tool) => {
        const customTool = customToolByName.get(tool.name);
        const portableTool: Record<string, unknown> = {
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          schema: tool.schema,
          implementationType: tool.implementationType,
          enabled: tool.enabled,
          portable: Boolean(customTool && customTool.code),
        };
        if (customTool) {
          portableTool.runtime = customTool.runtime;
          portableTool.code = customTool.code;
          portableTool.entry = customTool.entry;
          portableTool.inputSchema = customTool.inputSchema;
          portableTool.outputSchema = customTool.outputSchema;
          portableTool.permissions = customTool.permissions;
          portableTool.timeout = customTool.timeout;
          portableTool.retries = customTool.retries;
        }
        return portableTool;
      }),
      skills: boundSkills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          content: skill.content,
          category: skill.category,
          icon: skill.icon,
          source: skill.source,
          inputSchema: skill.inputSchema,
          outputSchema: skill.outputSchema,
          permissions: skill.permissions,
          exampleInput: skill.exampleInput,
          exampleOutput: skill.exampleOutput,
          riskLevel: skill.riskLevel,
          version: skill.version,
          enabled: skill.enabled,
        })),
      knowledgeBases: boundKBs.map((kb) => ({
          name: kb.name,
          description: kb.description,
          documentCount: kb.documentCount,
          chunkCount: kb.chunkCount,
          portable: false,
          note: '知识库原文未包含在 Agent Bundle 中；请在目标平台重新导入同名知识库或单独迁移文档。',
        })),
      excluded: {
        runHistory: true,
        evaluations: true,
        memories: true,
        knowledgeDocuments: true,
      },
    };
  }

  const agentExportPreview = computed(() => {
    const bundle = buildAgentExportBundle();
    return {
      fileName: `agent-${agentForm.value.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.agent.json`,
      toolCount: bundle.tools.length,
      skillCount: bundle.skills.length,
      knowledgeBaseCount: bundle.knowledgeBases.length,
      portableToolCount: bundle.tools.filter((tool) => tool.portable).length,
      model: bundle.runtime.model,
      memoryEnabled: bundle.runtime.memoryEnabled,
    };
  });

  function exportAgentAsJson() {
    if (!agentForm.value.id) {
      status.value = '请先保存 Agent';
      return;
    }
    showAgentExportDialog.value = true;
  }

  function confirmExportAgentBundle() {
    if (!agentForm.value.id) {
      status.value = '请先保存 Agent';
      return;
    }
    const exportData = buildAgentExportBundle();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = agentExportPreview.value.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAgentExportDialog.value = false;
    status.value = `Agent "${agentForm.value.name}" 已导出为 JSON Bundle`;
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
      agentTestRuns.value = [];
      return;
    }
    try {
      agentTestCases.value = await fetchAgentTestCases(activeTestSuiteId.value, backendBaseUrl.value);
      agentTestRuns.value = await fetchAgentTestRuns(activeTestSuiteId.value, backendBaseUrl.value);
    } catch (error) {
      status.value = error instanceof Error ? error.message : '加载测试用例失败';
    }
  }

  async function runSelectedTestSuite() {
    if (!activeTestSuiteId.value || testRunning.value) return;
    testRunning.value = true;
    try {
      activeTestRun.value = await apiRunAgentTestSuite(activeTestSuiteId.value, {
        judgeModel: evaluationForm.value.judgeModel.trim() || agentForm.value.model || undefined,
        evaluationMode: evaluationForm.value.mode,
      }, backendBaseUrl.value);
      agentTestRuns.value = await fetchAgentTestRuns(activeTestSuiteId.value, backendBaseUrl.value);
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
      const filters: { username?: string; model?: string; fromDate?: string; toDate?: string } = {};
      if (adminBillingFilterUsername.value) filters.username = adminBillingFilterUsername.value;
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

  function viewUserBilling(username: string) {
    adminBillingFilterUsername.value = username;
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
    const filters: { username?: string; model?: string; fromDate?: string; toDate?: string } = {};
    if (adminBillingFilterUsername.value) filters.username = adminBillingFilterUsername.value;
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
  const DRIVING_VISION_MODEL = 'qwen3.7-max';

  function preferredDrivingVisionModel(): string {
    const visions = visionModels.value;
    return visions.find((model) => model.id === DRIVING_VISION_MODEL)?.id
      || visions[0]?.id
      || selectedModel.value;
  }

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
  const drivingStats = ref({
    fps: 0,
    objects: 0,
    laneDev: 0,
    distance: 0,
    leadDistance: 999,
    ttc: 99,
    risk: 'nominal',
    fcw: false,
    ldw: false,
  });
  const drivingScenario = ref<'highway' | 'cutin' | 'construction' | 'curve' | 'night_rain'>('highway');
  const drivingWeather = ref<'clear' | 'rain' | 'fog' | 'night'>('clear');
  const drivingControlMode = ref<'vision' | 'hybrid' | 'openpilot'>('hybrid');
  const drivingOpenPilotMode = ref(true);
  const drivingScenarioOptions = [
    { label: '高速巡航', value: 'highway' },
    { label: '前车加塞', value: 'cutin' },
    { label: '施工收窄', value: 'construction' },
    { label: '弯道路段', value: 'curve' },
    { label: '夜雨低能见', value: 'night_rain' },
  ];
  const drivingControlModeOptions = [
    { label: '纯视觉模型', value: 'vision' },
    { label: '视觉 + openpilot', value: 'hybrid' },
    { label: '纯 openpilot', value: 'openpilot' },
  ];
  const drivingPerception = ref({
    laneConfidence: 0.98,
    leadDistance: 999,
    leadSpeed: 0,
    ttc: 99,
    curvature: 0,
    weather: 'clear',
    alert: '巡航正常',
  });
  const drivingOpenPilotState = ref({
    longState: 'pid' as 'off' | 'stopping' | 'starting' | 'pid',
    laneChangeState: 'off' as 'off' | 'preLaneChange' | 'laneChangeStarting' | 'laneChangeFinishing',
    desiredAccel: 0,
    outputAccel: 0,
    steerPid: 0,
    steerIntegral: 0,
    accelIntegral: 0,
    fcwCounter: 0,
  });
  let drivingAnimationId = 0;
  let drivingLastTime = 0;
  let drivingRoadOffset = 0;
  let drivingLastDisplayUpdate = 0;
  let drivingLeadVehicle: DrivingObject | null = null;
  let drivingStableRisk: 'nominal' | 'warning' | 'critical' = 'nominal';
  let drivingRiskHoldFrames = 0;
  let drivingOvertakeTargetLane: number | null = null;
  let drivingOvertakeTargetX: number | null = null;
  let drivingOvertakeUntil = 0;
  let drivingLaneChangeHoldUntil = 0;
  let drivingOvertakeLateralVelocity = 0;
  interface DrivingObject { x: number; y: number; w: number; h: number; speed: number; color: string; type: string; lane: number; changingLane: boolean; behavior?: string }
  let drivingVehicles: DrivingObject[] = [];
  let drivingEgoX = 0;
  const drivingFilteredPerception = {
    laneConfidence: 0.98,
    leadMeters: 999,
    leadSpeed: 0,
    ttc: 99,
    curvature: 0,
    laneDev: 0,
  };

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
        if (drivingRunning.value && isAuthenticated.value && drivingControlMode.value !== 'openpilot') analyzeDrivingScene();
      }, drivingAiIntervalSec.value * 1000);
    }
  });

  watch(builderBlockConfigs, () => {
    if (agentBuilderCanvas.value.length > 0) {
      applyBuilderConfigs();
    }
  }, { deep: true });

  function supportsDirectImageInput(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    if (!normalized) return true;
    if (normalized.includes('vl') || normalized.includes('vision') || normalized.includes('gemini') || normalized.includes('gui')) return true;
    return !/^qwen3(?:[.-]|$)/.test(normalized);
  }

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
    drivingLastDisplayUpdate = 0;
    drivingLeadVehicle = null;
    drivingStableRisk = 'nominal';
    drivingRiskHoldFrames = 0;
    drivingOvertakeTargetLane = null;
    drivingOvertakeTargetX = null;
    drivingOvertakeUntil = 0;
    drivingLaneChangeHoldUntil = 0;
    drivingOvertakeLateralVelocity = 0;
    Object.assign(drivingFilteredPerception, {
      laneConfidence: 0.98,
      leadMeters: 999,
      leadSpeed: drivingSpeed.value,
      ttc: 99,
      curvature: 0,
      laneDev: 0,
    });
    if (drivingScenario.value === 'night_rain') drivingWeather.value = 'night';
    else if (drivingScenario.value === 'construction') drivingWeather.value = 'clear';
    drivingStats.value = { fps: 0, objects: 0, laneDev: 0, distance: 0, leadDistance: 999, ttc: 99, risk: 'nominal', fcw: false, ldw: false };
    drivingPerception.value = { laneConfidence: 0.98, leadDistance: 999, leadSpeed: 0, ttc: 99, curvature: 0, weather: drivingWeather.value, alert: '巡航正常' };
  }

  const LANE_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];
  const VEHICLE_TYPES = ['car', 'truck', 'motorcycle'];

  function getLaneCenter(laneIdx: number, W: number): number {
    const laneW = W / 3;
    return laneIdx * laneW + laneW / 2;
  }

  function spawnVehicle(canvasW: number, egoCX: number, egoLane: number) {
    const laneW = canvasW / 3;
    // Aggressive sim: put slower lead vehicles in ego lane often enough to force overtakes.
    const laneWeights = [0, 1, 2].map(l => l === egoLane ? 4 : 2);
    const totalW = laneWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let lane = 0;
    for (let i = 0; i < 3; i++) { r -= laneWeights[i]; if (r <= 0) { lane = i; break; } }

    const isTruck = Math.random() < 0.12;
    const isMotorcycle = !isTruck && Math.random() < 0.06;
    const w = isTruck ? laneW * 0.46 : isMotorcycle ? laneW * 0.14 : laneW * 0.26;
    const h = isTruck ? w * 2.5 : isMotorcycle ? w * 1.8 : w * 1.8;
    const cx = getLaneCenter(lane, canvasW) + (Math.random() - 0.5) * laneW * 0.15;

    // Don't spawn on top of another vehicle just entering the scene.
    for (const v of drivingVehicles) {
      if (v.y < 0 && Math.abs(cx - (v.x + v.w / 2)) < laneW * 0.4) return;
    }

    const sameLaneAsEgo = lane === egoLane;
    const baseSpeed = sameLaneAsEgo
      ? Math.max(24, drivingSpeed.value - (18 + Math.random() * 26))
      : drivingScenario.value === 'cutin'
      ? 35 + Math.random() * 35
      : drivingScenario.value === 'construction'
        ? 25 + Math.random() * 45
        : 35 + Math.random() * 75;
    drivingVehicles.push({
      x: cx - w / 2,
      y: sameLaneAsEgo ? -h - 70 - Math.random() * 130 : -h - Math.random() * 350,
      w, h,
      speed: baseSpeed,
      color: LANE_COLORS[Math.floor(Math.random() * LANE_COLORS.length)],
      type: isTruck ? 'truck' : isMotorcycle ? 'motorcycle' : 'car',
      lane,
      changingLane: false,
      behavior: drivingScenario.value === 'cutin' && Math.random() < 0.35 ? 'cutin' : undefined,
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

  function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function lowPass(prev: number, next: number, alpha: number) {
    return prev + (next - prev) * clamp01(alpha);
  }

  function roundStep(value: number, step: number) {
    return Math.round(value / step) * step;
  }

  function computeDrivingPerception(W: number, H: number, egoCX: number, egoCY: number, egoH: number, dt: number) {
    const laneW = W / 3;
    const egoLane = Math.max(0, Math.min(2, Math.floor(egoCX / laneW)));
    const laneDev = ((egoCX % laneW + laneW) % laneW - laneW / 2);
    const metersPerPx = 0.22;
    const leadCandidates = drivingVehicles
      .map((v) => {
        const vcx = v.x + v.w / 2;
        const vLane = Math.floor(vcx / laneW);
        return {
          vehicle: v,
          vLane,
          aheadPx: egoCY - (v.y + v.h),
          lateralPx: Math.abs(vcx - egoCX),
        };
      })
      .filter((item) => item.vLane === egoLane && item.aheadPx > 0 && item.lateralPx < laneW * 0.52)
      .sort((a, b) => a.aheadPx - b.aheadPx);
    const tracked = drivingLeadVehicle
      ? leadCandidates.find((item) => item.vehicle === drivingLeadVehicle)
      : undefined;
    const nearest = leadCandidates[0];
    if (tracked && nearest && nearest.vehicle !== tracked.vehicle) {
      const trackedM = tracked.aheadPx * metersPerPx;
      const nearestM = nearest.aheadPx * metersPerPx;
      if (nearestM < trackedM - 8) drivingLeadVehicle = nearest.vehicle;
    } else if (tracked) {
      drivingLeadVehicle = tracked.vehicle;
    } else if (nearest) {
      drivingLeadVehicle = nearest.vehicle;
    } else if (drivingLeadVehicle && !drivingVehicles.includes(drivingLeadVehicle)) {
      drivingLeadVehicle = null;
    } else if (!nearest) {
      drivingLeadVehicle = null;
    }

    let leadDistancePx = 999;
    let leadSpeed = drivingSpeed.value;
    if (drivingLeadVehicle) {
      const vcx = drivingLeadVehicle.x + drivingLeadVehicle.w / 2;
      const vLane = Math.floor(vcx / laneW);
      const aheadPx = egoCY - (drivingLeadVehicle.y + drivingLeadVehicle.h);
      if (vLane === egoLane && aheadPx > 0 && Math.abs(vcx - egoCX) < laneW * 0.62) {
        leadDistancePx = aheadPx;
        leadSpeed = drivingLeadVehicle.speed;
      } else {
        drivingLeadVehicle = nearest?.vehicle || null;
        if (nearest) {
          leadDistancePx = nearest.aheadPx;
          leadSpeed = nearest.vehicle.speed;
        }
      }
    }

    const rawLeadMeters = leadDistancePx === 999 ? 999 : Math.max(0, leadDistancePx * metersPerPx);
    const rawClosingMps = Math.max(0, (drivingSpeed.value - leadSpeed) / 3.6);
    const rawTtc = rawLeadMeters >= 999 || rawClosingMps < 0.4 ? 99 : rawLeadMeters / rawClosingMps;
    const curvature = drivingScenario.value === 'curve' ? Math.sin(drivingRoadOffset / 90) * 0.55 : 0;
    const visibilityPenalty = drivingWeather.value === 'fog' ? 0.22 : drivingWeather.value === 'rain' ? 0.12 : drivingWeather.value === 'night' ? 0.18 : 0;
    const rawLaneConfidence = Math.max(0.42, Math.min(0.99, 0.97 - Math.abs(laneDev) / (laneW * 1.6) - visibilityPenalty - Math.abs(curvature) * 0.12));

    const alphaFast = Math.min(0.22, dt / 0.55);
    const alphaSlow = Math.min(0.14, dt / 0.9);
    if (rawLeadMeters >= 999 && drivingFilteredPerception.leadMeters < 999) {
      drivingFilteredPerception.leadMeters = lowPass(drivingFilteredPerception.leadMeters, 999, Math.min(0.04, dt / 2.4));
    } else if (drivingFilteredPerception.leadMeters >= 998 && rawLeadMeters < 999) {
      drivingFilteredPerception.leadMeters = rawLeadMeters;
    } else {
      drivingFilteredPerception.leadMeters = lowPass(drivingFilteredPerception.leadMeters, rawLeadMeters, alphaFast);
    }
    drivingFilteredPerception.leadSpeed = lowPass(drivingFilteredPerception.leadSpeed || leadSpeed, leadSpeed, alphaSlow);
    drivingFilteredPerception.ttc = rawTtc >= 99 && drivingFilteredPerception.ttc < 99
      ? lowPass(drivingFilteredPerception.ttc, 99, Math.min(0.04, dt / 2.4))
      : lowPass(drivingFilteredPerception.ttc >= 99 && rawTtc < 99 ? rawTtc : drivingFilteredPerception.ttc, rawTtc, alphaSlow);
    drivingFilteredPerception.curvature = lowPass(drivingFilteredPerception.curvature, curvature, alphaSlow);
    drivingFilteredPerception.laneDev = lowPass(drivingFilteredPerception.laneDev, laneDev, alphaFast);
    drivingFilteredPerception.laneConfidence = lowPass(drivingFilteredPerception.laneConfidence, rawLaneConfidence, alphaSlow);

    const leadMeters = Math.min(999, drivingFilteredPerception.leadMeters);
    const ttc = Math.min(99, drivingFilteredPerception.ttc);
    const laneConfidence = drivingFilteredPerception.laneConfidence;
    const stableLaneDev = drivingFilteredPerception.laneDev;
    const closingMps = Math.max(0, (drivingSpeed.value - drivingFilteredPerception.leadSpeed) / 3.6);
    const hardBrakeDistance = Math.max(5.5, egoH * metersPerPx * 1.05);
    const fcw = (ttc < 1.25 && closingMps > 1.2)
      || (leadMeters < hardBrakeDistance && closingMps > 2.2)
      || (leadMeters < 3.8);
    const ldw = Math.abs(stableLaneDev) > laneW * 0.3 || laneConfidence < 0.6;
    const closeFollowing = (ttc < 3.0 && closingMps > 0.8) || leadMeters < Math.max(9, egoH * metersPerPx * 1.45);
    const rawRisk: 'nominal' | 'warning' | 'critical' = fcw ? 'critical' : ldw || closeFollowing ? 'warning' : 'nominal';
    if (rawRisk !== drivingStableRisk) {
      drivingRiskHoldFrames += 1;
      const threshold = rawRisk === 'critical' ? 4 : 10;
      if (drivingRiskHoldFrames >= threshold) {
        drivingStableRisk = rawRisk;
        drivingRiskHoldFrames = 0;
      }
    } else {
      drivingRiskHoldFrames = 0;
    }
    const risk = drivingStableRisk;
    const alert = risk === 'critical'
      ? 'FCW 前向碰撞预警'
      : risk === 'warning'
        ? (ldw ? 'LDW 车道偏离/低置信' : '跟车距离偏近')
        : '巡航正常';
    const now = performance.now();
    if (now - drivingLastDisplayUpdate > 180 || drivingPerception.value.alert !== alert) {
      drivingLastDisplayUpdate = now;
      drivingPerception.value = {
        laneConfidence: Math.round(laneConfidence * 100) / 100,
        leadDistance: leadMeters >= 999 ? 999 : Math.round(roundStep(leadMeters, 0.5) * 10) / 10,
        leadSpeed: Math.round(drivingFilteredPerception.leadSpeed),
        ttc: ttc >= 99 ? 99 : Math.round(roundStep(ttc, 0.5) * 10) / 10,
        curvature: Math.round(drivingFilteredPerception.curvature * 100) / 100,
        weather: drivingWeather.value,
        alert,
      };
    }
    return { egoLane, laneDev: stableLaneDev, leadMeters, leadSpeed: drivingFilteredPerception.leadSpeed, ttc, fcw, ldw, risk, curvature: drivingFilteredPerception.curvature, laneConfidence };
  }

  function interp(x: number, xs: number[], ys: number[]) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / Math.max(0.0001, xs[i] - xs[i - 1]);
        return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
      }
    }
    return ys[ys.length - 1];
  }

  function laneClearanceScore(lane: number, laneW: number, egoCY: number, egoH: number, aggressive = false) {
    let aheadGap = Infinity;
    let rearGap = Infinity;
    let speedPenalty = 0;
    for (const v of drivingVehicles) {
      const vLane = Math.floor((v.x + v.w / 2) / laneW);
      if (vLane !== lane) continue;
      const centerY = v.y + v.h / 2;
      const gap = centerY - egoCY;
      if (gap < 0) {
        const ahead = Math.abs(gap);
        aheadGap = Math.min(aheadGap, ahead);
        if (v.speed < drivingSpeed.value) speedPenalty += (drivingSpeed.value - v.speed) * 0.7;
      } else {
        rearGap = Math.min(rearGap, gap);
        if (v.speed > drivingSpeed.value) speedPenalty += (v.speed - drivingSpeed.value) * 1.2;
      }
    }
    const minAhead = (aggressive ? egoH * 1.75 : egoH * 2.35) + Math.max(0, drivingSpeed.value - 55) * (aggressive ? 0.45 : 0.7);
    const minRear = (aggressive ? egoH * 1.25 : egoH * 1.65) + Math.max(0, drivingSpeed.value - 70) * (aggressive ? 0.35 : 0.55);
    const safe = aheadGap > minAhead && rearGap > minRear;
    const score = (Number.isFinite(aheadGap) ? aheadGap : egoH * 12)
      + (Number.isFinite(rearGap) ? rearGap * 0.45 : egoH * 4)
      - speedPenalty;
    return { safe, score, aheadGap, rearGap };
  }

  function gapClearanceScore(targetX: number, W: number, laneW: number, egoCY: number, egoW: number, egoH: number, aggressive = false) {
    let aheadGap = Infinity;
    let rearGap = Infinity;
    let lateralRisk = 0;
    const targetCanvasX = W / 2 + targetX;
    const halfWidth = egoW * (aggressive ? 0.42 : 0.5);
    for (const v of drivingVehicles) {
      const vcx = v.x + v.w / 2;
      const centerY = v.y + v.h / 2;
      const dy = centerY - egoCY;
      const lateralClearance = Math.abs(vcx - targetCanvasX) - (v.w / 2 + halfWidth);
      if (lateralClearance < laneW * 0.1 && Math.abs(dy) < egoH * 4.5) {
        lateralRisk += (laneW * 0.1 - lateralClearance) * (1 + (egoH * 4.5 - Math.abs(dy)) / Math.max(1, egoH * 4.5));
      }
      if (Math.abs(vcx - targetCanvasX) < laneW * 0.42) {
        if (dy < 0) aheadGap = Math.min(aheadGap, Math.abs(dy));
        else rearGap = Math.min(rearGap, dy);
      }
    }
    const roadMargin = laneW * 0.16;
    const withinRoad = targetCanvasX > roadMargin && targetCanvasX < W - roadMargin;
    const minAhead = egoH * (aggressive ? 1.0 : 1.45);
    const minRear = egoH * (aggressive ? 0.72 : 1.0);
    const safe = withinRoad && aheadGap > minAhead && rearGap > minRear && lateralRisk < laneW * (aggressive ? 0.42 : 0.25);
    const laneCenterBias = Math.abs(((targetCanvasX % laneW) + laneW) % laneW - laneW / 2);
    const score = (Number.isFinite(aheadGap) ? aheadGap : egoH * 12)
      + (Number.isFinite(rearGap) ? rearGap * 0.35 : egoH * 3)
      + laneCenterBias * (aggressive ? 0.55 : 0.2)
      - lateralRisk * 1.8;
    return { safe, score, aheadGap, rearGap, lateralRisk, targetX };
  }

  function chooseAggressiveGapTarget(W: number, laneW: number, egoCY: number, egoW: number, egoH: number, perception: any) {
    const urgent = perception.fcw || perception.ttc < 2.2;
    const shouldThreadGap = urgent || perception.leadMeters < 105 || drivingSpeed.value < 136;
    if (!shouldThreadGap) return null;
    const samples: number[] = [];
    const step = laneW / 6;
    for (let x = laneW * 0.18; x <= W - laneW * 0.18; x += step) {
      samples.push(x - W / 2);
    }
    const currentBias = drivingEgoX;
    const candidates = samples
      .map((x) => gapClearanceScore(x, W, laneW, egoCY, egoW, egoH, true))
      .filter((item) => item.safe || (urgent && item.aheadGap > egoH * 0.75 && item.rearGap > egoH * 0.55))
      .sort((a, b) => {
        const directionBiasA = Math.abs(a.targetX - currentBias) < laneW * 0.12 ? -40 : 0;
        const directionBiasB = Math.abs(b.targetX - currentBias) < laneW * 0.12 ? -40 : 0;
        return (b.score + directionBiasB) - (a.score + directionBiasA);
      });
    return candidates[0]?.targetX ?? null;
  }

  function chooseAggressiveOvertakeLane(egoLane: number, laneW: number, egoCY: number, egoH: number, perception: any, aggressive = false) {
    const hasSlowLead = perception.leadMeters < (aggressive ? 105 : 82) && perception.leadSpeed < drivingSpeed.value - (aggressive ? 0.5 : 2) && perception.ttc > (aggressive ? 1.35 : 1.7);
    const needsEvasiveSteer = aggressive && perception.fcw && perception.leadMeters < 55;
    const wantsProgress = needsEvasiveSteer || hasSlowLead || (drivingSpeed.value < (aggressive ? 132 : 120) && perception.leadMeters > (aggressive ? 18 : 28) && perception.ttc > (aggressive ? 1.9 : 2.4));
    if (!wantsProgress || (perception.fcw && !aggressive)) return null;
    const lanes = [egoLane - 1, egoLane + 1].filter((lane) => lane >= 0 && lane <= 2);
    const candidates = lanes
      .map((lane) => ({ lane, ...laneClearanceScore(lane, laneW, egoCY, egoH, aggressive) }))
      .filter((item) => item.safe);
    if (!candidates.length && aggressive && (hasSlowLead || needsEvasiveSteer) && perception.ttc > (needsEvasiveSteer ? 0.55 : 1.8)) {
      const fallback = lanes
        .map((lane) => ({ lane, ...laneClearanceScore(lane, laneW, egoCY, egoH, true) }))
        .sort((a, b) => b.score - a.score)[0];
      if (fallback && fallback.aheadGap > egoH * (needsEvasiveSteer ? 0.85 : 1.15) && fallback.rearGap > egoH * (needsEvasiveSteer ? 0.65 : 0.9)) return fallback.lane;
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const leftBiasA = a.lane < egoLane ? 24 : 0;
      const leftBiasB = b.lane < egoLane ? 24 : 0;
      return (b.score + leftBiasB) - (a.score + leftBiasA);
    });
    return candidates[0].lane;
  }

  function applyOpenPilotControl(dt: number, laneW: number, perception: any, aiCmdActive: boolean, aiCmd: any) {
    const state = drivingOpenPilotState.value;
    const vEgo = drivingSpeed.value / 3.6;
    const leadM = perception.leadMeters;
    const leadV = perception.leadSpeed / 3.6;
    const closing = vEgo - leadV;
    const aggressiveGapSeconds = drivingOvertakeTargetLane !== null ? 0.95 : 1.15;
    const desiredGap = Math.max(6, vEgo * aggressiveGapSeconds);
    const stopping = leadM < Math.max(4.5, desiredGap * 0.38) || perception.ttc < 1.45;
    const starting = state.longState === 'stopping' && leadM > desiredGap * 1.3 && perception.ttc > 4.5;
    let longState: typeof state.longState = 'pid';
    if (!drivingAutoPilot.value) longState = 'off';
    else if (stopping) longState = 'stopping';
    else if (starting) longState = 'starting';

    const accelMaxBySpeed = interp(drivingSpeed.value, [0, 30, 60, 115, 150], [3.4, 2.9, 2.2, 1.4, 0.65]);
    const turnAccelPenalty = Math.abs(perception.curvature) * Math.max(0, drivingSpeed.value - 35) * 0.012;
    const accelMax = Math.max(0.15, accelMaxBySpeed - turnAccelPenalty);
    const accelMin = perception.fcw ? -4.2 : -2.8;
    const gapError = leadM >= 999 ? 20 : leadM - desiredGap;
    let targetAccel = 0.45 + Math.min(1.35, gapError * 0.052) - Math.max(0, closing) * 0.42;
    if (aiCmdActive) {
      if (aiCmd.speed === '加速') targetAccel += 0.45;
      else if (aiCmd.speed === '减速') targetAccel -= 0.85;
    }
    if (longState === 'stopping') targetAccel = accelMin;
    else if (longState === 'starting') targetAccel = 0.9;
    targetAccel = Math.max(accelMin, Math.min(accelMax, targetAccel));
    state.accelIntegral = Math.max(-1.2, Math.min(1.2, state.accelIntegral + targetAccel * dt * 0.22));
    const rawOutputAccel = Math.max(accelMin, Math.min(accelMax, targetAccel + state.accelIntegral));
    const jerkLimit = (rawOutputAccel < state.outputAccel ? 2.8 : 1.2) * dt;
    const outputAccel = state.outputAccel + Math.max(-jerkLimit, Math.min(jerkLimit, rawOutputAccel - state.outputAccel));
    drivingSpeed.value = Math.max(0, Math.min(150, drivingSpeed.value + outputAccel * 3.6 * dt));

    const laneErr = -perception.laneDev / Math.max(1, laneW / 2);
    const desiredCurvatureSteer = -perception.curvature * 0.55;
    state.steerIntegral = Math.max(-0.6, Math.min(0.6, state.steerIntegral + laneErr * dt * 0.35));
    const laneKeepGain = drivingOvertakeTargetLane !== null ? 0.18 : 0.45;
    const integralGain = drivingOvertakeTargetLane !== null ? 0.45 : 1;
    const steerPid = Math.max(-1, Math.min(1, laneErr * laneKeepGain + state.steerIntegral * integralGain + desiredCurvatureSteer));

    if (perception.fcw) state.fcwCounter += 1;
    else state.fcwCounter = Math.max(0, state.fcwCounter - 1);

    const laneChangeActive = drivingOvertakeTargetLane !== null || (aiCmdActive && (aiCmd.action === '左转' || aiCmd.action === '右转'));
    let laneChangeState: typeof state.laneChangeState = Date.now() < drivingLaneChangeHoldUntil ? state.laneChangeState : 'off';
    if (laneChangeActive) {
      drivingLaneChangeHoldUntil = Date.now() + 1400;
      laneChangeState = state.laneChangeState === 'off' ? 'preLaneChange' : 'laneChangeStarting';
    } else if (state.laneChangeState === 'laneChangeStarting' && Date.now() < drivingLaneChangeHoldUntil) {
      laneChangeState = 'laneChangeFinishing';
    }

    drivingOpenPilotState.value = {
      ...state,
      longState,
      laneChangeState,
      desiredAccel: Math.round(targetAccel * 100) / 100,
      outputAccel: Math.round(outputAccel * 100) / 100,
      steerPid: Math.round(steerPid * 100) / 100,
      fcwCounter: state.fcwCounter,
    };
    return steerPid;
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
    const perception = computeDrivingPerception(W, H, egoCX, egoCY, egoH, dt);

    // Steering - auto pilot
    if (drivingAutoPilot.value) {
      const egoLane = perception.egoLane;
      let targetSteer = -perception.curvature * 0.35;
      let closestThreatDist = Infinity;
      const aiCmd = drivingAiCommand.value;
      const aiCmdActive = aiCmd && Date.now() < aiCmd.until;
      const useOpenPilot = drivingControlMode.value === 'hybrid' || drivingControlMode.value === 'openpilot';
      const useVisionControl = drivingControlMode.value === 'hybrid' || drivingControlMode.value === 'vision';
      const pureOpenPilot = drivingControlMode.value === 'openpilot';

      if (useOpenPilot) {
        targetSteer += applyOpenPilotControl(dt, laneW, perception, Boolean(aiCmdActive), aiCmd);
      }

      if (useOpenPilot) {
        const now = performance.now();
        const chosenGap = pureOpenPilot ? chooseAggressiveGapTarget(W, laneW, egoCY, egoW, egoH, perception) : null;
        const chosenLane = chooseAggressiveOvertakeLane(egoLane, laneW, egoCY, egoH, perception, pureOpenPilot);
        if (chosenGap !== null && (drivingOvertakeTargetX === null || now > drivingOvertakeUntil)) {
          drivingOvertakeTargetX = chosenGap;
          drivingOvertakeTargetLane = Math.max(0, Math.min(2, Math.floor((W / 2 + chosenGap) / laneW)));
          drivingOvertakeUntil = now + 7200;
        } else if (chosenLane !== null && (drivingOvertakeTargetLane === null || now > drivingOvertakeUntil)) {
          drivingOvertakeTargetLane = chosenLane;
          drivingOvertakeTargetX = chosenLane * laneW + laneW / 2 - W / 2;
          drivingOvertakeUntil = now + (pureOpenPilot ? 9500 : 8000);
        }
        if (drivingOvertakeTargetLane !== null || drivingOvertakeTargetX !== null) {
          const targetCX = drivingOvertakeTargetX ?? ((drivingOvertakeTargetLane ?? egoLane) * laneW + laneW / 2 - W / 2);
          const targetLaneForScore = drivingOvertakeTargetLane ?? Math.max(0, Math.min(2, Math.floor((W / 2 + targetCX) / laneW)));
          const laneScore = laneClearanceScore(targetLaneForScore, laneW, egoCY, egoH, pureOpenPilot);
          const laneErrPx = targetCX - drivingEgoX;
          targetSteer += laneErrPx * (pureOpenPilot ? 0.018 : 0.011) + Math.sign(laneErrPx) * (pureOpenPilot ? 0.95 : 0.62);
          const gapScore = drivingOvertakeTargetX !== null ? gapClearanceScore(drivingOvertakeTargetX, W, laneW, egoCY, egoW, egoH, pureOpenPilot) : null;
          const pathSafe = gapScore?.safe ?? laneScore.safe;
          if (!perception.fcw && pathSafe && perception.ttc > (pureOpenPilot ? 1.25 : 2.8)) {
            drivingSpeed.value = Math.min(pureOpenPilot ? 150 : 136, drivingSpeed.value + (pureOpenPilot ? 24 : 9) * dt);
          }
          drivingOpenPilotState.value = {
            ...drivingOpenPilotState.value,
            laneChangeState: Math.abs(laneErrPx) < laneW * 0.18 ? 'laneChangeFinishing' : 'laneChangeStarting',
          };
          if (Math.abs(targetCX - drivingEgoX) < laneW * 0.055 || now > drivingOvertakeUntil || (!perception.fcw && !laneScore.safe && Math.abs(laneErrPx) > laneW * (pureOpenPilot ? 0.45 : 0.3))) {
            drivingOvertakeTargetLane = null;
            drivingOvertakeTargetX = null;
            drivingOvertakeUntil = 0;
            drivingOvertakeLateralVelocity = 0;
          }
        }
      }

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
      if (useVisionControl && aiCmdActive) {
        // Steer toward the target lane center
        let targetLane = egoLane;
        if (aiCmd.action === '左转') targetLane = Math.max(0, egoLane - 1);
        else if (aiCmd.action === '右转') targetLane = Math.min(2, egoLane + 1);
        // '直行' keeps current lane (lane-keep toward current lane center)
        const targetCX = targetLane * laneW + laneW / 2 - W / 2;
        targetSteer += (targetCX - drivingEgoX) * (useOpenPilot ? 0.035 : 0.07);
        if (!useOpenPilot) {
          if (aiCmd.speed === '加速' && !perception.fcw) drivingSpeed.value = Math.min(138, drivingSpeed.value + 10 * dt);
          else if (aiCmd.speed === '减速' || perception.ttc < 3.2) drivingSpeed.value = Math.max(0, drivingSpeed.value - 18 * dt);
        }
      } else if (!useOpenPilot) {
        targetSteer += -perception.laneDev * 0.01;
        if (perception.fcw) drivingSpeed.value = Math.max(0, drivingSpeed.value - 35 * dt);
        const overtakeLane = chooseAggressiveOvertakeLane(egoLane, laneW, egoCY, egoH, perception);
        if (overtakeLane !== null) {
          const targetCX = overtakeLane * laneW + laneW / 2 - W / 2;
          const laneErrPx = targetCX - drivingEgoX;
          targetSteer += laneErrPx * 0.012 + Math.sign(laneErrPx) * 0.58;
          drivingSpeed.value = Math.min(134, drivingSpeed.value + 7 * dt);
        }
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
        targetSteer += -perception.laneDev * 0.012;
      }

      } // end rule-based fallback
      } // end !emergency

      // Smoothing: higher damping for AI commands to prevent oscillation during lane changes
      targetSteer = Math.max(-1, Math.min(1, targetSteer));
      const smooth = closestThreatDist < egoH * 3 ? 9 : (drivingOvertakeTargetLane !== null && pureOpenPilot ? 10 : aiCmdActive ? 7 : 4.5);
      const desiredSteer = drivingSteering.value + (targetSteer - drivingSteering.value) * Math.min(1, smooth * dt);
      const maxSteerRate = (perception.fcw && drivingOvertakeTargetLane !== null ? 4.8 : perception.fcw ? 2.4 : drivingOvertakeTargetLane !== null ? (pureOpenPilot ? 3.8 : 2.35) : 1.15) * dt;
      drivingSteering.value += Math.max(-maxSteerRate, Math.min(maxSteerRate, desiredSteer - drivingSteering.value));
    }

    if (drivingControlMode.value === 'openpilot' && (drivingOvertakeTargetLane !== null || drivingOvertakeTargetX !== null)) {
      const targetCX = drivingOvertakeTargetX ?? ((drivingOvertakeTargetLane ?? perception.egoLane) * laneW + laneW / 2 - W / 2);
      const laneErrPx = targetCX - drivingEgoX;
      const latVelLimit = perception.fcw ? 620 : 520;
      const desiredLatVel = Math.max(-latVelLimit, Math.min(latVelLimit, laneErrPx * (perception.fcw ? 5.2 : 4.4) + Math.sign(laneErrPx) * (perception.fcw ? 180 : 125)));
      drivingOvertakeLateralVelocity += (desiredLatVel - drivingOvertakeLateralVelocity) * Math.min(1, (perception.fcw ? 13 : 9) * dt);
      drivingEgoX += drivingOvertakeLateralVelocity * dt;
    } else {
      drivingOvertakeLateralVelocity *= Math.max(0, 1 - 8 * dt);
      drivingEgoX += drivingSteering.value * 155 * dt;
    }
    drivingEgoX = Math.max(-laneW * 1.22, Math.min(laneW * 1.22, drivingEgoX));

    // Spawn vehicles (avoid ego lane)
    const spawnRate = drivingControlMode.value === 'openpilot'
      ? 0.024
      : drivingScenario.value === 'cutin' ? 0.02 : drivingScenario.value === 'construction' ? 0.018 : 0.012;
    if (drivingVehicles.length < 14 && Math.random() < spawnRate * (drivingSpeed.value / 40)) {
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
      if (v.behavior === 'cutin' && v.y > H * 0.12 && v.y < H * 0.58) {
        const egoLane = Math.floor(egoCX / laneW);
        if (v.lane !== egoLane) {
          v.changingLane = true;
          v.lane = egoLane;
        }
      }
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

    if (drivingScenario.value === 'curve') {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#60a5fa';
      const curveX = W / 2 + Math.sin(drivingRoadOffset / 90) * laneW * 0.5;
      ctx.beginPath();
      ctx.ellipse(curveX, H * 0.25, W * 0.38, H * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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

    if (drivingOvertakeTargetLane !== null || drivingOvertakeTargetX !== null) {
      const targetCenterX = drivingOvertakeTargetX !== null
        ? W / 2 + drivingOvertakeTargetX
        : (drivingOvertakeTargetLane ?? currentLane) * laneW + laneW / 2;
      const targetX = Math.max(0, targetCenterX - laneW * 0.28);
      ctx.save();
      const evasive = perception.fcw;
      ctx.fillStyle = evasive ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.14)';
      ctx.fillRect(targetX, 0, laneW * 0.56, H);
      ctx.strokeStyle = evasive ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(targetX + 6, 10, laneW * 0.56 - 12, H - 20);
      ctx.setLineDash([]);
      ctx.fillStyle = evasive ? '#ef4444' : '#22c55e';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(evasive ? 'EVASIVE GAP' : 'FAST GAP', targetX + 12, 52);
      ctx.restore();
    }

    if (drivingScenario.value === 'construction') {
      ctx.save();
      const closedLane = 2;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fillRect(closedLane * laneW, 0, laneW, H);
      for (let y = (drivingRoadOffset % 72) - 72; y < H + 72; y += 72) {
        const x = closedLane * laneW + laneW * 0.18;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 9, y + 24);
        ctx.lineTo(x + 9, y + 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 7, y + 12, 14, 3);
      }
      ctx.restore();
    }

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

    // OpenPilot-style perception overlay
    ctx.save();
    ctx.strokeStyle = perception.fcw ? '#ef4444' : perception.ldw ? '#f59e0b' : 'rgba(34,197,94,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(currentLane * laneW + 8, 8, laneW - 16, H - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = perception.fcw ? 'rgba(239,68,68,0.18)' : perception.ldw ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.10)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${drivingPerception.value.alert} | lead ${drivingPerception.value.leadDistance}m | TTC ${drivingPerception.value.ttc}s | lane conf ${drivingPerception.value.laneConfidence}`, 12, 22);
    ctx.restore();

    if (drivingWeather.value === 'rain' || drivingWeather.value === 'night') {
      ctx.save();
      ctx.strokeStyle = drivingWeather.value === 'night' ? 'rgba(180,210,255,0.25)' : 'rgba(210,230,255,0.38)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 80; i++) {
        const x = (i * 73 + drivingRoadOffset * 5) % W;
        const y = (i * 41 + drivingRoadOffset * 8) % H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 18);
        ctx.stroke();
      }
      if (drivingWeather.value === 'night') {
        ctx.fillStyle = 'rgba(2,6,23,0.42)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    } else if (drivingWeather.value === 'fog') {
      ctx.save();
      ctx.fillStyle = 'rgba(226,232,240,0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Update stats
    drivingStats.value = {
      fps: Math.round(1 / (dt || 0.016)),
      objects: drivingVehicles.length,
      laneDev: Math.round(perception.laneDev * 10) / 10,
      distance: Math.round(drivingRoadOffset / 60 * 10) / 10,
      leadDistance: perception.leadMeters >= 999 ? 999 : Math.round(roundStep(perception.leadMeters, 0.5) * 10) / 10,
      ttc: perception.ttc >= 99 ? 99 : Math.round(roundStep(perception.ttc, 0.5) * 10) / 10,
      risk: perception.risk,
      fcw: perception.fcw,
      ldw: perception.ldw || drivingOpenPilotState.value.fcwCounter >= 3,
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
      if (drivingRunning.value && isAuthenticated.value && drivingControlMode.value !== 'openpilot') analyzeDrivingScene();
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

  onUnmounted(() => {
    stopDrivingSim();
    if (agentTraceReplayTimer) clearInterval(agentTraceReplayTimer);
    agentRunAbortController?.abort();
  });

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
      const modelToUse = (multimodalModel.value && multimodalModel.value !== 'qwen3.6-plus' && multimodalModel.value !== 'qwen-3.6-plus' && multimodalModel.value !== 'qwen-3.7-max')
        ? multimodalModel.value
        : preferredDrivingVisionModel();

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
    if (drivingControlMode.value === 'openpilot') {
      status.value = '纯 openpilot 模式不调用视觉模型';
      return;
    }
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
    const p = drivingPerception.value;
    const modelToUse = multimodalModel.value || visionModels.value[0]?.id || selectedModel.value;
    const usesImageInput = supportsDirectImageInput(modelToUse);
    const nearbyVehicles = drivingVehicles
      .filter((vehicle) => vehicle.y > -120 && vehicle.y < (canvas.height || 520) + 80)
      .sort((a, b) => b.y - a.y)
      .slice(0, 6)
      .map((vehicle, index) => {
        const lane = laneNames[Math.min(2, Math.max(0, vehicle.lane))] || `车道${vehicle.lane + 1}`;
        const relY = Math.round((canvas.height || 520) - vehicle.y);
        return `${index + 1}. ${vehicle.type} 位于${lane}, 相对纵向距离约${relY}px, 速度${Math.round(vehicle.speed)}km/h${vehicle.changingLane ? ', 正在变道' : ''}`;
      });
    const sceneCtx = [
      `当前车速${Math.round(drivingSpeed.value)}km/h，主车在${laneNames[Math.min(2, Math.max(0, egoLane))]}。`,
      `OpenPilot风格感知: 场景=${drivingScenario.value}, 天气=${p.weather}, 前车距离=${p.leadDistance}m, 前车速度=${p.leadSpeed}km/h, TTC=${p.ttc}s, 车道置信度=${p.laneConfidence}, 曲率=${p.curvature}, 告警=${p.alert}。`,
      `OpenPilot控制状态: LongControl=${drivingOpenPilotState.value.longState}, LaneChange=${drivingOpenPilotState.value.laneChangeState}, 纵向加速度=${drivingOpenPilotState.value.outputAccel}m/s², 横向PID=${drivingOpenPilotState.value.steerPid}。`,
      nearbyVehicles.length ? `仿真感知目标:\n${nearbyVehicles.join('\n')}` : '仿真感知目标: 近距离内无明显车辆。',
    ].join('\n');

    const parseDrivingCommand = (txt: string) => {
      let action = '直行', speed = '匀速';
      const jsonMatch = txt.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as { action?: string; speed?: string };
          if (/左转|向左|左道|左变道/.test(parsed.action || '')) action = '左转';
          else if (/右转|向右|右道|右变道/.test(parsed.action || '')) action = '右转';
          if (/加速|提速/.test(parsed.speed || '')) speed = '加速';
          else if (/减速|刹车|降速/.test(parsed.speed || '')) speed = '减速';
          return { action, speed };
        } catch {
          // Fall through to compact text parsing.
        }
      }
      const allMatches = [...txt.matchAll(/【决策[：:]([^】]+)】/g)];
      const m = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;
      const cmds = m ? m[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
      const tokens = cmds.length ? cmds : [txt];
      for (const c of tokens) {
        if (/左转|向左|左道|左变道/.test(c)) action = '左转';
        else if (/右转|向右|右道|右变道/.test(c)) action = '右转';
        if (/加速|提速|加快|快一[点些]/.test(c)) speed = '加速';
        else if (/减速|降速|刹车|减慢|慢一[点些]/.test(c)) speed = '减速';
      }
      return { action, speed };
    };
    const applyDrivingCommand = (cmd: { action: string; speed: string }) => {
      drivingAiCommand.value = { ...cmd, until: Date.now() + 4500 };
      if (cmd.action === '左转' || cmd.action === '右转') {
        drivingLaneChangeHoldUntil = Date.now() + 2200;
        drivingOpenPilotState.value = {
          ...drivingOpenPilotState.value,
          laneChangeState: drivingOpenPilotState.value.laneChangeState === 'off' ? 'preLaneChange' : 'laneChangeStarting',
        };
      }
      if (cmd.speed === '加速') drivingSpeed.value = Math.min(140, Math.round((drivingSpeed.value + 10) / 5) * 5);
      else if (cmd.speed === '减速') drivingSpeed.value = Math.max(10, Math.round((drivingSpeed.value - 10) / 5) * 5);
    };

    try {
      status.value = `正在用 ${modelToUse} 分析驾驶场景`;
      const drivingPrompt = `${sceneCtx}\n你是激进高效自动驾驶决策器。输出必须很短，最多两行，不要Markdown。第1行必须是JSON: {"action":"左转|右转|直行","speed":"加速|减速|匀速","risk":"low|mid|high"}。第2行用不超过18个中文说明原因。能安全超车就优先左转或右转并加速；TTC<2或FCW时减速；车道不安全才直行。`;
      const drivingContent = usesImageInput
        ? [
            { type: 'image_url', image_url: { url: imageBase64 } },
            { type: 'text', text: drivingPrompt },
          ]
        : `${drivingPrompt}\n\n注意：当前模型不接收 image_url 内容，本次请仅基于上述仿真感知、openpilot状态和场景参数进行驾驶策略判断。`;
      await streamCompletion(
        {
          model: modelToUse,
          messages: [{
            role: 'user',
            content: drivingContent as any,
          }],
          temperature: 0.5,
          max_tokens: 80,
        },
        {
          onChunk: (chunk) => {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) {
              drivingAiAnalysis.value += token;
              const compact = drivingAiAnalysis.value.trim();
              if (!drivingAiCommand.value || Date.now() > drivingAiCommand.value.until - 3800) {
                if (/\{[\s\S]*?\}/.test(compact) || /【决策[：:][^】]+】/.test(compact)) {
                  applyDrivingCommand(parseDrivingCommand(compact));
                }
              }
            }
          },
          onDone: () => {
            status.value = `${modelToUse} 场景分析完成`;
            const txt = drivingAiAnalysis.value;
            applyDrivingCommand(parseDrivingCommand(txt));
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
    activeAgentTraceStepId,
    activeAgentTraceStep,
    agentTraceReplayIndex,
    agentTraceReplayMax,
    agentTraceReplayPlaying,
    agentTraceNodes,
    agentTraceEdges,
    agentTraceStageGroups,
    agentTraceLatencyMax,
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
    agentTestRuns,
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
    agentCreateWizardStep,
    agentCreateWizardAdvancedOpen,
    selectedAgentTemplateId,
    agentCreationGoal,
    showAgentExportDialog,
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
    editingMemoryId,
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
    agentCreationTemplates,
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
    adminBillingFilterUsername,
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
    applyAgentTemplate,
    nextAgentWizardStep,
    previousAgentWizardStep,
    saveAgentFromWizard,
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
    openAgentRunTrace,
    selectAgentTraceStep,
    setAgentTraceReplayIndex,
    toggleAgentTraceReplay,
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
    startEditAgentMemory,
    resetMemoryEditor,
    saveAgentMemory,
    deleteAgentMemory,
    createSkillFromForm,
    exportSkillAsMarkdown,
    agentExportPreview,
    exportAgentAsJson,
    confirmExportAgentBundle,
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
    drivingScenario,
    drivingWeather,
    drivingControlMode,
    drivingOpenPilotMode,
    drivingScenarioOptions,
    drivingControlModeOptions,
    drivingPerception,
    drivingOpenPilotState,
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
