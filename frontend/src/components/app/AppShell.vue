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
const EditPen = bind(app, 'EditPen');
const Headset = bind(app, 'Headset');
const InfoFilled = bind(app, 'InfoFilled');
const Lightning = bind(app, 'Lightning');
const MoreFilled = bind(app, 'MoreFilled');
const Monitor = bind(app, 'Monitor');
const Picture = bind(app, 'Picture');
const PictureFilled = bind(app, 'PictureFilled');
const Plus = bind(app, 'Plus');
const Promotion = bind(app, 'Promotion');
const Refresh = bind(app, 'Refresh');
const Search = bind(app, 'Search');
const Setting = bind(app, 'Setting');
const Star = bind(app, 'Star');
const Sunny = bind(app, 'Sunny');
const SwitchButton = bind(app, 'SwitchButton');
const TrendCharts = bind(app, 'TrendCharts');
const User = bind(app, 'User');
const UserFilled = bind(app, 'UserFilled');
const VideoCamera = bind(app, 'VideoCamera');
const Coin = bind(app, 'Coin');
const useDagNodes = bind(app, 'useDagNodes');
const getModelLogo = bind(app, 'getModelLogo');
const createId = bind(app, 'createId');
const buildSessionTitle = bind(app, 'buildSessionTitle');
const pickTwoRandomModels = bind(app, 'pickTwoRandomModels');
const shuffleArray = bind(app, 'shuffleArray');
const formatTime = bind(app, 'formatTime');
const getStoredValue = bind(app, 'getStoredValue');
const setStoredValue = bind(app, 'setStoredValue');
const renderMarkdown = bind(app, 'renderMarkdown');
const MagicStick = bind(app, 'MagicStick');
const BASE_URL_KEY = bind(app, 'BASE_URL_KEY');
const THEME_KEY = bind(app, 'THEME_KEY');
const getPreferredTheme = bind(app, 'getPreferredTheme');
const applyTheme = bind(app, 'applyTheme');
const theme = bind(app, 'theme');
const isDark = bind(app, 'isDark');
const darkMediaQuery = bind(app, 'darkMediaQuery');
const menuBgColor = bind(app, 'menuBgColor');
const menuTextColor = bind(app, 'menuTextColor');
const menuActiveColor = bind(app, 'menuActiveColor');
const backendBaseUrl = bind(app, 'backendBaseUrl');
const isSettingsOpen = bind(app, 'isSettingsOpen');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const authMode = bind(app, 'authMode');
const authUsername = bind(app, 'authUsername');
const authPassword = bind(app, 'authPassword');
const authEmail = bind(app, 'authEmail');
const authVerificationCode = bind(app, 'authVerificationCode');
const authInvitationCode = bind(app, 'authInvitationCode');
const authLoading = bind(app, 'authLoading');
const authError = bind(app, 'authError');
const codeCountdown = bind(app, 'codeCountdown');
const codeTimer = bind(app, 'codeTimer');
const userInvitationCode = bind(app, 'userInvitationCode');
const topUpAmount = bind(app, 'topUpAmount');
const topUpLoading = bind(app, 'topUpLoading');
const rechargeDialogVisible = bind(app, 'rechargeDialogVisible');
const rechargeAmount = bind(app, 'rechargeAmount');
const rechargeLoading = bind(app, 'rechargeLoading');
const rechargeQrCode = bind(app, 'rechargeQrCode');
const rechargeOrderId = bind(app, 'rechargeOrderId');
const rechargeError = bind(app, 'rechargeError');
const rechargeChecking = bind(app, 'rechargeChecking');
const rechargePollTimer = bind(app, 'rechargePollTimer');
const rechargeOrders = bind(app, 'rechargeOrders');
const rechargeOrdersLoading = bind(app, 'rechargeOrdersLoading');
const billingRules = bind(app, 'billingRules');
const billingLedger = bind(app, 'billingLedger');
const agents = bind(app, 'agents');
const activeAgentId = bind(app, 'activeAgentId');
const agentLoading = bind(app, 'agentLoading');
const agentSaving = bind(app, 'agentSaving');
const agentPublishing = bind(app, 'agentPublishing');
const agentRunning = bind(app, 'agentRunning');
const agentGenerating = bind(app, 'agentGenerating');
const agentPrompt = bind(app, 'agentPrompt');
const agentImageUrlInput = bind(app, 'agentImageUrlInput');
const agentRuns = bind(app, 'agentRuns');
const activeAgentRun = bind(app, 'activeAgentRun');
const agentPageTab = bind(app, 'agentPageTab');
const agentConsoleTab = bind(app, 'agentConsoleTab');
const dagNodeCategories = bind(app, 'dagNodeCategories');
const dagTemplates = bind(app, 'dagTemplates');
const getDagNodeInfo = bind(app, 'getDagNodeInfo');
const applyDagTemplate = bind(app, 'applyDagTemplate');
const availableTools = bind(app, 'availableTools');
const knowledgeBases = bind(app, 'knowledgeBases');
const agentMemories = bind(app, 'agentMemories');
const availableSkills = bind(app, 'availableSkills');
const workflows = bind(app, 'workflows');
const agentTeams = bind(app, 'agentTeams');
const mcpServers = bind(app, 'mcpServers');
const agentVersions = bind(app, 'agentVersions');
const agentTestSuites = bind(app, 'agentTestSuites');
const agentTestCases = bind(app, 'agentTestCases');
const marketplaceTemplates = bind(app, 'marketplaceTemplates');
const agentResourceLoading = bind(app, 'agentResourceLoading');
const knowledgeCreating = bind(app, 'knowledgeCreating');
const knowledgeDocSaving = bind(app, 'knowledgeDocSaving');
const knowledgeFileParsing = bind(app, 'knowledgeFileParsing');
const knowledgeDocuments = bind(app, 'knowledgeDocuments');
const knowledgeDocPreviewVisible = bind(app, 'knowledgeDocPreviewVisible');
const knowledgeDocPreview = bind(app, 'knowledgeDocPreview');
const showKnowledgeCreateDialog = bind(app, 'showKnowledgeCreateDialog');
const memorySaving = bind(app, 'memorySaving');
const skillCreating = bind(app, 'skillCreating');
const showSkillCreateDialog = bind(app, 'showSkillCreateDialog');
const skillPreviewOpen = bind(app, 'skillPreviewOpen');
const skillTesting = bind(app, 'skillTesting');
const activeSkill = bind(app, 'activeSkill');
const activeSkillTestResult = bind(app, 'activeSkillTestResult');
const skillTestInput = bind(app, 'skillTestInput');
const editingSkillId = bind(app, 'editingSkillId');
const skillFilters = bind(app, 'skillFilters');
const workflowCreating = bind(app, 'workflowCreating');
const workflowRunning = bind(app, 'workflowRunning');
const teamCreating = bind(app, 'teamCreating');
const teamRunning = bind(app, 'teamRunning');
const mcpSaving = bind(app, 'mcpSaving');
const mcpTesting = bind(app, 'mcpTesting');
const versionSaving = bind(app, 'versionSaving');
const testSaving = bind(app, 'testSaving');
const testRunning = bind(app, 'testRunning');
const marketplaceLoading = bind(app, 'marketplaceLoading');
const marketplaceInstalling = bind(app, 'marketplaceInstalling');
const marketplacePublishing = bind(app, 'marketplacePublishing');
const activeWorkflowId = bind(app, 'activeWorkflowId');
const workflowInput = bind(app, 'workflowInput');
const activeWorkflowRun = bind(app, 'activeWorkflowRun');
const activeTeamId = bind(app, 'activeTeamId');
const teamInput = bind(app, 'teamInput');
const activeTeamRun = bind(app, 'activeTeamRun');
const activeTestSuiteId = bind(app, 'activeTestSuiteId');
const activeTestRun = bind(app, 'activeTestRun');
const agentEvaluations = bind(app, 'agentEvaluations');
const agentStats = bind(app, 'agentStats');
const agentEvaluationLoading = bind(app, 'agentEvaluationLoading');
const agentEvaluationSaving = bind(app, 'agentEvaluationSaving');
const evaluationForm = bind(app, 'evaluationForm');
const generatorForm = bind(app, 'generatorForm');
const customTools = bind(app, 'customTools');
const toolCreateDialogVisible = bind(app, 'toolCreateDialogVisible');
const toolPreviewVisible = bind(app, 'toolPreviewVisible');
const toolTestVisible = bind(app, 'toolTestVisible');
const activeTool = bind(app, 'activeTool');
const toolTestInput = bind(app, 'toolTestInput');
const toolTestResult = bind(app, 'toolTestResult');
const toolTesting = bind(app, 'toolTesting');
const toolCreating = bind(app, 'toolCreating');
const toolEditingId = bind(app, 'toolEditingId');
const toolForm = bind(app, 'toolForm');
const dagNodeConfigVisible = bind(app, 'dagNodeConfigVisible');
const activeDagNode = bind(app, 'activeDagNode');
const dagNodeConfig = bind(app, 'dagNodeConfig');
const agentForm = bind(app, 'agentForm');
const knowledgeForm = bind(app, 'knowledgeForm');
const knowledgeDocForm = bind(app, 'knowledgeDocForm');
const ragLabForm = bind(app, 'ragLabForm');
const ragLabSearching = bind(app, 'ragLabSearching');
const ragLabResults = bind(app, 'ragLabResults');
const memoryForm = bind(app, 'memoryForm');
const skillForm = bind(app, 'skillForm');
const teamForm = bind(app, 'teamForm');
const mcpForm = bind(app, 'mcpForm');
const versionForm = bind(app, 'versionForm');
const testSuiteForm = bind(app, 'testSuiteForm');
const testCaseForm = bind(app, 'testCaseForm');
const marketplaceForm = bind(app, 'marketplaceForm');
const agentBuilderBlocks = bind(app, 'agentBuilderBlocks');
const agentBuilderCanvas = bind(app, 'agentBuilderCanvas');
const agentBuilderDragging = bind(app, 'agentBuilderDragging');
const agentBuilderSkillDragging = bind(app, 'agentBuilderSkillDragging');
const showBuilderGuide = bind(app, 'showBuilderGuide');
const activeBuilderBlock = bind(app, 'activeBuilderBlock');
const builderBlockConfigs = bind(app, 'builderBlockConfigs');
const workflowCanvasNodes = bind(app, 'workflowCanvasNodes');
const workflowCanvasConnecting = bind(app, 'workflowCanvasConnecting');
const workflowCanvasDrag = bind(app, 'workflowCanvasDrag');
const workflowCanvasSaving = bind(app, 'workflowCanvasSaving');
const workflowCanvasTypes = bind(app, 'workflowCanvasTypes');
const selectedWorkflow = bind(app, 'selectedWorkflow');
const workflowCanvasEdges = bind(app, 'workflowCanvasEdges');
const skillCategories = bind(app, 'skillCategories');
const filteredSkills = bind(app, 'filteredSkills');
const agentPublicEndpoint = bind(app, 'agentPublicEndpoint');
const agentApiEndpoint = bind(app, 'agentApiEndpoint');
const agentGuideCards = bind(app, 'agentGuideCards');
const apiKeys = bind(app, 'apiKeys');
const apiKeyLoading = bind(app, 'apiKeyLoading');
const apiKeyCreateDialog = bind(app, 'apiKeyCreateDialog');
const apiKeyNewName = bind(app, 'apiKeyNewName');
const errorCodes = bind(app, 'errorCodes');
const models = bind(app, 'models');
const selectedModel = bind(app, 'selectedModel');
const pageModelsConfig = bind(app, 'pageModelsConfig');
const getModelStorageKey = bind(app, 'getModelStorageKey');
const restoreSelectedModel = bind(app, 'restoreSelectedModel');
const persistSelectedModel = bind(app, 'persistSelectedModel');
const getMmModelKey = bind(app, 'getMmModelKey');
const restoreMmModel = bind(app, 'restoreMmModel');
const persistMmModel = bind(app, 'persistMmModel');
const getTtsModelKey = bind(app, 'getTtsModelKey');
const restoreTtsModel = bind(app, 'restoreTtsModel');
const persistTtsModel = bind(app, 'persistTtsModel');
const getVisionModelKey = bind(app, 'getVisionModelKey');
const restoreVisionModel = bind(app, 'restoreVisionModel');
const persistVisionModel = bind(app, 'persistVisionModel');
const isLoadingModels = bind(app, 'isLoadingModels');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const sessions = bind(app, 'sessions');
const activeSessionId = bind(app, 'activeSessionId');
const draft = bind(app, 'draft');
const isComposing = bind(app, 'isComposing');
const isSubmitting = bind(app, 'isSubmitting');
const requestId = bind(app, 'requestId');
const isSessionLoaded = bind(app, 'isSessionLoaded');
const pageMode = bind(app, 'pageMode');
const battlePrompt = bind(app, 'battlePrompt');
const isBattling = bind(app, 'isBattling');
const battleStatus = bind(app, 'battleStatus');
const battleLeftModel = bind(app, 'battleLeftModel');
const battleRightModel = bind(app, 'battleRightModel');
const battlePanels = bind(app, 'battlePanels');
const groupPrompt = bind(app, 'groupPrompt');
const isGrouping = bind(app, 'isGrouping');
const groupMessages = bind(app, 'groupMessages');
const routerEnabled = bind(app, 'routerEnabled');
const routerIntent = bind(app, 'routerIntent');
const routerConfidence = bind(app, 'routerConfidence');
const routerSelectedModel = bind(app, 'routerSelectedModel');
const routerReason = bind(app, 'routerReason');
const routerFallbacks = bind(app, 'routerFallbacks');
const routerDebug = bind(app, 'routerDebug');
const routerRules = bind(app, 'routerRules');
const routerLoading = bind(app, 'routerLoading');
const collabMode = bind(app, 'collabMode');
const collabPrompt = bind(app, 'collabPrompt');
const collabRunning = bind(app, 'collabRunning');
const collabModels = bind(app, 'collabModels');
const collabSelectedModels = bind(app, 'collabSelectedModels');
const collabModelPickerOpen = bind(app, 'collabModelPickerOpen');
const collabPanels = bind(app, 'collabPanels');
const collabSummary = bind(app, 'collabSummary');
const collabSummaryStatus = bind(app, 'collabSummaryStatus');
const collabAbortController = bind(app, 'collabAbortController');
const collabLastQuery = bind(app, 'collabLastQuery');
const collabLastMode = bind(app, 'collabLastMode');
const getCollabModelLogo = bind(app, 'getCollabModelLogo');
const adminStats = bind(app, 'adminStats');
const adminUsers = bind(app, 'adminUsers');
const adminUsersTotal = bind(app, 'adminUsersTotal');
const adminUsersPage = bind(app, 'adminUsersPage');
const adminUsersSearch = bind(app, 'adminUsersSearch');
const adminBilling = bind(app, 'adminBilling');
const adminBillingTotal = bind(app, 'adminBillingTotal');
const adminBillingPage = bind(app, 'adminBillingPage');
const adminBillingFilterUserId = bind(app, 'adminBillingFilterUserId');
const adminBillingFilterModel = bind(app, 'adminBillingFilterModel');
const adminEditUserDialog = bind(app, 'adminEditUserDialog');
const adminEditUserId = bind(app, 'adminEditUserId');
const adminEditUserCredits = bind(app, 'adminEditUserCredits');
const adminEditUserRole = bind(app, 'adminEditUserRole');
const adminEditUserUsername = bind(app, 'adminEditUserUsername');
const adminTab = bind(app, 'adminTab');
const adminDailyUsage = bind(app, 'adminDailyUsage');
const adminChartDays = bind(app, 'adminChartDays');
const adminTodayStats = bind(app, 'adminTodayStats');
const adminModelUsage = bind(app, 'adminModelUsage');
const adminResetPwdDialog = bind(app, 'adminResetPwdDialog');
const adminResetPwdUserId = bind(app, 'adminResetPwdUserId');
const adminResetPwdUsername = bind(app, 'adminResetPwdUsername');
const adminResetPwdValue = bind(app, 'adminResetPwdValue');
const adminBillingFromDate = bind(app, 'adminBillingFromDate');
const adminBillingToDate = bind(app, 'adminBillingToDate');
const adminProviderKeyCounts = bind(app, 'adminProviderKeyCounts');
const adminApiKeyProviderFilter = bind(app, 'adminApiKeyProviderFilter');
const adminSettings = bind(app, 'adminSettings');
const adminEditSettingDialog = bind(app, 'adminEditSettingDialog');
const adminEditSettingKey = bind(app, 'adminEditSettingKey');
const adminEditSettingValue = bind(app, 'adminEditSettingValue');
const adminEditSettingDesc = bind(app, 'adminEditSettingDesc');
const adminEditSettingModels = bind(app, 'adminEditSettingModels');
const adminEditModelTags = bind(app, 'adminEditModelTags');
const adminModelTiers = bind(app, 'adminModelTiers');
const adminTierEditDialog = bind(app, 'adminTierEditDialog');
const adminTierEditKey = bind(app, 'adminTierEditKey');
const adminTierEditLabel = bind(app, 'adminTierEditLabel');
const adminTierEditPromptPrice = bind(app, 'adminTierEditPromptPrice');
const adminTierEditCompletionPrice = bind(app, 'adminTierEditCompletionPrice');
const adminTierEditDesc = bind(app, 'adminTierEditDesc');
const adminTierEditIsNew = bind(app, 'adminTierEditIsNew');
const adminEditSettingTagFilter = bind(app, 'adminEditSettingTagFilter');
const adminEditSettingTextMode = bind(app, 'adminEditSettingTextMode');
const filteredModelsForSetting = bind(app, 'filteredModelsForSetting');
const consoleDailyUsage = bind(app, 'consoleDailyUsage');
const consoleChartDays = bind(app, 'consoleChartDays');
const adminProviderKeys = bind(app, 'adminProviderKeys');
const adminAddKeyDialog = bind(app, 'adminAddKeyDialog');
const adminNewKeyProvider = bind(app, 'adminNewKeyProvider');
const adminNewKeyName = bind(app, 'adminNewKeyName');
const adminNewKeyValue = bind(app, 'adminNewKeyValue');
const adminProviderConfigs = bind(app, 'adminProviderConfigs');
const adminEditConfigDialog = bind(app, 'adminEditConfigDialog');
const adminEditConfigId = bind(app, 'adminEditConfigId');
const adminEditConfigForm = bind(app, 'adminEditConfigForm');
const adminIsNewConfig = bind(app, 'adminIsNewConfig');
const adminChartInstance = bind(app, 'adminChartInstance');
const consoleChartInstance = bind(app, 'consoleChartInstance');
const threadRef = bind(app, 'threadRef');
const groupThreadRef = bind(app, 'groupThreadRef');
const chatAbortController = bind(app, 'chatAbortController');
const battleAbortController = bind(app, 'battleAbortController');
const groupAbortController = bind(app, 'groupAbortController');
const sessionsSyncTimer = bind(app, 'sessionsSyncTimer');
const activeSession = bind(app, 'activeSession');
const activeMessages = bind(app, 'activeMessages');
const sidebarSessions = bind(app, 'sidebarSessions');
const isAuthenticated = bind(app, 'isAuthenticated');
const isAdmin = bind(app, 'isAdmin');
const activeAgent = bind(app, 'activeAgent');
const authCreditsText = bind(app, 'authCreditsText');
const authSpentText = bind(app, 'authSpentText');
const apiBaseUrl = bind(app, 'apiBaseUrl');
const battleStatusTagType = bind(app, 'battleStatusTagType');
const panelStatusTagType = bind(app, 'panelStatusTagType');
const onConsoleEnter = bind(app, 'onConsoleEnter');
const triggerSync = bind(app, 'triggerSync');
const loadModels = bind(app, 'loadModels');
const resetAgentForm = bind(app, 'resetAgentForm');
const fillAgentForm = bind(app, 'fillAgentForm');
const refreshAgentStudio = bind(app, 'refreshAgentStudio');
const loadAgentResources = bind(app, 'loadAgentResources');
const loadAgentMemories = bind(app, 'loadAgentMemories');
const loadAgentEvaluations = bind(app, 'loadAgentEvaluations');
const loadAgentVersions = bind(app, 'loadAgentVersions');
const loadAgentTestSuites = bind(app, 'loadAgentTestSuites');
const loadAgents = bind(app, 'loadAgents');
const loadAgentRuns = bind(app, 'loadAgentRuns');
const createAgentDraft = bind(app, 'createAgentDraft');
const selectAgent = bind(app, 'selectAgent');
const selectAgentById = bind(app, 'selectAgentById');
const startAgentBuilderDrag = bind(app, 'startAgentBuilderDrag');
const startSkillBuilderDrag = bind(app, 'startSkillBuilderDrag');
const dropAgentBuilderBlock = bind(app, 'dropAgentBuilderBlock');
const removeAgentBuilderBlock = bind(app, 'removeAgentBuilderBlock');
const clearAgentBuilderCanvas = bind(app, 'clearAgentBuilderCanvas');
const applyAgentBuilder = bind(app, 'applyAgentBuilder');
const applyBuilderConfigs = bind(app, 'applyBuilderConfigs');
const persistAgent = bind(app, 'persistAgent');
const saveAgentPublication = bind(app, 'saveAgentPublication');
const generateAgentFromRequirement = bind(app, 'generateAgentFromRequirement');
const installMarketplaceTemplate = bind(app, 'installMarketplaceTemplate');
const publishCurrentAgentToMarketplace = bind(app, 'publishCurrentAgentToMarketplace');
const getToolLabelById = bind(app, 'getToolLabelById');
const confirmToolExecutionIfNeeded = bind(app, 'confirmToolExecutionIfNeeded');
const saveAgent = bind(app, 'saveAgent');
const removeAgent = bind(app, 'removeAgent');
const runCurrentAgent = bind(app, 'runCurrentAgent');
const selectAgentRun = bind(app, 'selectAgentRun');
const agentRunTagType = bind(app, 'agentRunTagType');
const agentEvalTagType = bind(app, 'agentEvalTagType');
const evaluateActiveAgentRun = bind(app, 'evaluateActiveAgentRun');
const formatAgentDate = bind(app, 'formatAgentDate');
const formatStepMetadata = bind(app, 'formatStepMetadata');
const createKnowledgeBaseFromForm = bind(app, 'createKnowledgeBaseFromForm');
const addDocumentToKnowledgeBase = bind(app, 'addDocumentToKnowledgeBase');
const handleKnowledgeFileUpload = bind(app, 'handleKnowledgeFileUpload');
const loadKnowledgeDocuments = bind(app, 'loadKnowledgeDocuments');
const previewKnowledgeDocument = bind(app, 'previewKnowledgeDocument');
const deleteKnowledgeDocument = bind(app, 'deleteKnowledgeDocument');
const formatDate = bind(app, 'formatDate');
const runRagLabSearch = bind(app, 'runRagLabSearch');
const createAgentMemory = bind(app, 'createAgentMemory');
const createSkillFromForm = bind(app, 'createSkillFromForm');
const exportSkillAsMarkdown = bind(app, 'exportSkillAsMarkdown');
const exportAgentAsJson = bind(app, 'exportAgentAsJson');
const exportAgentAsMarkdown = bind(app, 'exportAgentAsMarkdown');
const previewSkill = bind(app, 'previewSkill');
const previewSkillById = bind(app, 'previewSkillById');
const runActiveSkillTest = bind(app, 'runActiveSkillTest');
const copySkillToCustom = bind(app, 'copySkillToCustom');
const deleteCustomSkill = bind(app, 'deleteCustomSkill');
const startEditSkill = bind(app, 'startEditSkill');
const cancelSkillEdit = bind(app, 'cancelSkillEdit');
const bindSkillToCurrentAgent = bind(app, 'bindSkillToCurrentAgent');
const skillRiskTagType = bind(app, 'skillRiskTagType');
const openToolCreateDialog = bind(app, 'openToolCreateDialog');
const editTool = bind(app, 'editTool');
const saveTool = bind(app, 'saveTool');
const deleteTool = bind(app, 'deleteTool');
const previewTool = bind(app, 'previewTool');
const openToolTest = bind(app, 'openToolTest');
const runToolTest = bind(app, 'runToolTest');
const toggleToolStatus = bind(app, 'toggleToolStatus');
const openDagNodeConfig = bind(app, 'openDagNodeConfig');
const saveDagNodeConfig = bind(app, 'saveDagNodeConfig');
const createDefaultWorkflow = bind(app, 'createDefaultWorkflow');
const createTeamFromForm = bind(app, 'createTeamFromForm');
const runSelectedTeam = bind(app, 'runSelectedTeam');
const createVersionFromForm = bind(app, 'createVersionFromForm');
const restoreVersion = bind(app, 'restoreVersion');
const createTestSuiteFromForm = bind(app, 'createTestSuiteFromForm');
const createTestCaseFromForm = bind(app, 'createTestCaseFromForm');
const loadSelectedTestCases = bind(app, 'loadSelectedTestCases');
const runSelectedTestSuite = bind(app, 'runSelectedTestSuite');
const createMcpServerFromForm = bind(app, 'createMcpServerFromForm');
const testMcpServer = bind(app, 'testMcpServer');
const syncWorkflowCanvasFromSelected = bind(app, 'syncWorkflowCanvasFromSelected');
const createWorkflowNodeConfig = bind(app, 'createWorkflowNodeConfig');
const dagNodeDragging = bind(app, 'dagNodeDragging');
const startDagNodeDrag = bind(app, 'startDagNodeDrag');
const dropDagNode = bind(app, 'dropDagNode');
const addWorkflowCanvasNode = bind(app, 'addWorkflowCanvasNode');
const startWorkflowNodeDrag = bind(app, 'startWorkflowNodeDrag');
const dragWorkflowNode = bind(app, 'dragWorkflowNode');
const stopWorkflowNodeDrag = bind(app, 'stopWorkflowNodeDrag');
const connectWorkflowNode = bind(app, 'connectWorkflowNode');
const removeWorkflowCanvasNode = bind(app, 'removeWorkflowCanvasNode');
const saveWorkflowCanvas = bind(app, 'saveWorkflowCanvas');
const runSelectedWorkflow = bind(app, 'runSelectedWorkflow');
const bootstrapAuth = bind(app, 'bootstrapAuth');
const fetchUserInvitationCode = bind(app, 'fetchUserInvitationCode');
const submitAuth = bind(app, 'submitAuth');
const onAuthDialogClosed = bind(app, 'onAuthDialogClosed');
const handleSendCode = bind(app, 'handleSendCode');
const loadUserData = bind(app, 'loadUserData');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const handleTopUp = bind(app, 'handleTopUp');
const openRechargeDialog = bind(app, 'openRechargeDialog');
const submitRecharge = bind(app, 'submitRecharge');
const startRechargePolling = bind(app, 'startRechargePolling');
const stopRechargePolling = bind(app, 'stopRechargePolling');
const loadRechargeOrders = bind(app, 'loadRechargeOrders');
const handleCheckPayment = bind(app, 'handleCheckPayment');
const closeRechargeDialog = bind(app, 'closeRechargeDialog');
const refreshBillingData = bind(app, 'refreshBillingData');
const upsertActiveSession = bind(app, 'upsertActiveSession');
const submitPrompt = bind(app, 'submitPrompt');
const stopChatGeneration = bind(app, 'stopChatGeneration');
const loadRouterRules = bind(app, 'loadRouterRules');
const submitRouterPrompt = bind(app, 'submitRouterPrompt');
const startCollab = bind(app, 'startCollab');
const clearCollab = bind(app, 'clearCollab');
const stopCollab = bind(app, 'stopCollab');
const createNewChat = bind(app, 'createNewChat');
const handleSoftDeleteSession = bind(app, 'handleSoftDeleteSession');
const clearChat = bind(app, 'clearChat');
const loadAdminStats = bind(app, 'loadAdminStats');
const loadAdminUsers = bind(app, 'loadAdminUsers');
const loadAdminBilling = bind(app, 'loadAdminBilling');
const openEditUser = bind(app, 'openEditUser');
const saveEditUser = bind(app, 'saveEditUser');
const loadAdminProviderKeys = bind(app, 'loadAdminProviderKeys');
const openAddProviderKey = bind(app, 'openAddProviderKey');
const saveAddProviderKey = bind(app, 'saveAddProviderKey');
const deleteProviderKey = bind(app, 'deleteProviderKey');
const loadAdminProviderConfigs = bind(app, 'loadAdminProviderConfigs');
const openAddConfig = bind(app, 'openAddConfig');
const openEditConfig = bind(app, 'openEditConfig');
const saveConfig = bind(app, 'saveConfig');
const toggleProvider = bind(app, 'toggleProvider');
const deleteProviderConfig = bind(app, 'deleteProviderConfig');
const loadAdminTodayStats = bind(app, 'loadAdminTodayStats');
const loadAdminModelUsage = bind(app, 'loadAdminModelUsage');
const modelChartInstance = bind(app, 'modelChartInstance');
const viewUserBilling = bind(app, 'viewUserBilling');
const openResetPassword = bind(app, 'openResetPassword');
const saveResetPassword = bind(app, 'saveResetPassword');
const handleDeleteUser = bind(app, 'handleDeleteUser');
const handleExportBillingCsv = bind(app, 'handleExportBillingCsv');
const loadAdminBillingWithDates = bind(app, 'loadAdminBillingWithDates');
const loadAdminProviderKeyCounts = bind(app, 'loadAdminProviderKeyCounts');
const loadAdminSettings = bind(app, 'loadAdminSettings');
const loadAdminModelTiers = bind(app, 'loadAdminModelTiers');
const openEditTier = bind(app, 'openEditTier');
const saveTierEdit = bind(app, 'saveTierEdit');
const deleteAdminTier = bind(app, 'deleteAdminTier');
const modelTierSearch = bind(app, 'modelTierSearch');
const modelTierTagFilter = bind(app, 'modelTierTagFilter');
const modelTierMap = bind(app, 'modelTierMap');
const allModelTierRows = bind(app, 'allModelTierRows');
const filteredModelTierRows = bind(app, 'filteredModelTierRows');
const unassignedCount = bind(app, 'unassignedCount');
const changeModelTier = bind(app, 'changeModelTier');
const tierDefaultLabels = bind(app, 'tierDefaultLabels');
const tierRows = bind(app, 'tierRows');
const tierTagType = bind(app, 'tierTagType');
const defaultPricePrompt = bind(app, 'defaultPricePrompt');
const defaultPriceCompletion = bind(app, 'defaultPriceCompletion');
const adminDefaultPromptPrice = bind(app, 'adminDefaultPromptPrice');
const adminDefaultCompletionPrice = bind(app, 'adminDefaultCompletionPrice');
const initDefaultPriceFields = bind(app, 'initDefaultPriceFields');
const saveDefaultPrices = bind(app, 'saveDefaultPrices');
const consolePricingRows = bind(app, 'consolePricingRows');
const openEditSetting = bind(app, 'openEditSetting');
const toggleModelTag = bind(app, 'toggleModelTag');
const toggleSettingTextMode = bind(app, 'toggleSettingTextMode');
const saveEditSetting = bind(app, 'saveEditSetting');
const adminRouterRules = bind(app, 'adminRouterRules');
const adminRouterEditDialog = bind(app, 'adminRouterEditDialog');
const adminRouterEditIntent = bind(app, 'adminRouterEditIntent');
const adminRouterEditModels = bind(app, 'adminRouterEditModels');
const loadAdminRouterRules = bind(app, 'loadAdminRouterRules');
const openAdminRouterEdit = bind(app, 'openAdminRouterEdit');
const saveAdminRouterRule = bind(app, 'saveAdminRouterRule');
const deleteAdminRouterRule = bind(app, 'deleteAdminRouterRule');
const renderLineChart = bind(app, 'renderLineChart');
const renderModelUsageChart = bind(app, 'renderModelUsageChart');
const loadAdminDailyUsage = bind(app, 'loadAdminDailyUsage');
const loadConsoleDailyUsage = bind(app, 'loadConsoleDailyUsage');
const disposeCharts = bind(app, 'disposeCharts');
const darkMediaQuery2 = bind(app, 'darkMediaQuery2');
const onDarkChange = bind(app, 'onDarkChange');
const switchPage = bind(app, 'switchPage');
const startBattle = bind(app, 'startBattle');
const stopBattle = bind(app, 'stopBattle');
const startGroupChat = bind(app, 'startGroupChat');
const clearGroupChat = bind(app, 'clearGroupChat');
const stopGroupChat = bind(app, 'stopGroupChat');
const visionPrompt = bind(app, 'visionPrompt');
const visionImageBase64 = bind(app, 'visionImageBase64');
const visionImageName = bind(app, 'visionImageName');
const visionModel = bind(app, 'visionModel');
const visionMessages = bind(app, 'visionMessages');
const isVisionSubmitting = bind(app, 'isVisionSubmitting');
const visionFileRef = bind(app, 'visionFileRef');
const visionAbortController = bind(app, 'visionAbortController');
const modelTagsMap = bind(app, 'modelTagsMap');
const getModelTags = bind(app, 'getModelTags');
const chatModels = bind(app, 'chatModels');
const battleModels = bind(app, 'battleModels');
const groupModelList = bind(app, 'groupModelList');
const getPageModels = bind(app, 'getPageModels');
const visionModels = bind(app, 'visionModels');
const ttsText = bind(app, 'ttsText');
const ttsVoice = bind(app, 'ttsVoice');
const ttsStyleTag = bind(app, 'ttsStyleTag');
const ttsStyleInstruction = bind(app, 'ttsStyleInstruction');
const ttsSingingMode = bind(app, 'ttsSingingMode');
const ttsModeSegment = bind(app, 'ttsModeSegment');
const ttsAudioUrl = bind(app, 'ttsAudioUrl');
const ttsAudioLoading = bind(app, 'ttsAudioLoading');
const ttsError = bind(app, 'ttsError');
const ttsAudioRef = bind(app, 'ttsAudioRef');
const ttsHistory = bind(app, 'ttsHistory');
const ttsModel = bind(app, 'ttsModel');
const ttsModels = bind(app, 'ttsModels');
const multimodalTab = bind(app, 'multimodalTab');
const videoFile = bind(app, 'videoFile');
const videoUrl = bind(app, 'videoUrl');
const videoAnalysis = bind(app, 'videoAnalysis');
const videoAnalysisRunning = bind(app, 'videoAnalysisRunning');
const videoRef = bind(app, 'videoRef');
const drivingCanvasRef = bind(app, 'drivingCanvasRef');
const drivingRunning = bind(app, 'drivingRunning');
const drivingSpeed = bind(app, 'drivingSpeed');
const drivingSteering = bind(app, 'drivingSteering');
const drivingAutoPilot = bind(app, 'drivingAutoPilot');
const drivingStats = bind(app, 'drivingStats');
const drivingAnimationId = bind(app, 'drivingAnimationId');
const drivingLastTime = bind(app, 'drivingLastTime');
const drivingRoadOffset = bind(app, 'drivingRoadOffset');
const drivingVehicles = bind(app, 'drivingVehicles');
const drivingEgoX = bind(app, 'drivingEgoX');
const retrievalQuery = bind(app, 'retrievalQuery');
const retrievalResults = bind(app, 'retrievalResults');
const retrievalLoading = bind(app, 'retrievalLoading');
const mmChatMessages = bind(app, 'mmChatMessages');
const mmChatPrompt = bind(app, 'mmChatPrompt');
const mmChatImageBase64 = bind(app, 'mmChatImageBase64');
const mmChatImageName = bind(app, 'mmChatImageName');
const mmChatImages = bind(app, 'mmChatImages');
const mmChatAudioBase64 = bind(app, 'mmChatAudioBase64');
const mmChatAudioName = bind(app, 'mmChatAudioName');
const mmChatVideoUrl = bind(app, 'mmChatVideoUrl');
const mmChatVideoName = bind(app, 'mmChatVideoName');
const mmChatMediaType = bind(app, 'mmChatMediaType');
const mmChatFileRef = bind(app, 'mmChatFileRef');
const mmChatAudioRef = bind(app, 'mmChatAudioRef');
const mmChatVideoRef = bind(app, 'mmChatVideoRef');
const isMmChatSubmitting = bind(app, 'isMmChatSubmitting');
const mmChatAbortController = bind(app, 'mmChatAbortController');
const drivingAiAnalyzing = bind(app, 'drivingAiAnalyzing');
const drivingAiAnalysis = bind(app, 'drivingAiAnalysis');
const drivingAiAbortController = bind(app, 'drivingAiAbortController');
const drivingAiCommand = bind(app, 'drivingAiCommand');
const drivingAiIntervalSec = bind(app, 'drivingAiIntervalSec');
const drivingAiIntervalId = bind(app, 'drivingAiIntervalId');
const multimodalModel = bind(app, 'multimodalModel');
const handleVisionImageUpload = bind(app, 'handleVisionImageUpload');
const removeVisionImage = bind(app, 'removeVisionImage');
const openImageInNewTab = bind(app, 'openImageInNewTab');
const submitVisionPrompt = bind(app, 'submitVisionPrompt');
const clearVisionChat = bind(app, 'clearVisionChat');
const stopVisionChat = bind(app, 'stopVisionChat');
const TTS_STYLE_TAGS = bind(app, 'TTS_STYLE_TAGS');
const TTS_AUDIO_TAGS = bind(app, 'TTS_AUDIO_TAGS');
const TTS_VOICES = bind(app, 'TTS_VOICES');
const insertTtsTag = bind(app, 'insertTtsTag');
const onTtsModeChange = bind(app, 'onTtsModeChange');
const generateTts = bind(app, 'generateTts');
const initDrivingSim = bind(app, 'initDrivingSim');
const LANE_COLORS = bind(app, 'LANE_COLORS');
const VEHICLE_TYPES = bind(app, 'VEHICLE_TYPES');
const getLaneCenter = bind(app, 'getLaneCenter');
const spawnVehicle = bind(app, 'spawnVehicle');
const drawCar = bind(app, 'drawCar');
const tickDrivingSim = bind(app, 'tickDrivingSim');
const startDrivingSim = bind(app, 'startDrivingSim');
const stopDrivingSim = bind(app, 'stopDrivingSim');
const handleVideoUpload = bind(app, 'handleVideoUpload');
const runVideoAnalysis = bind(app, 'runVideoAnalysis');
const stopVideoAnalysis = bind(app, 'stopVideoAnalysis');
const searchImages = bind(app, 'searchImages');
const handleMmImageUpload = bind(app, 'handleMmImageUpload');
const handleMmAudioUpload = bind(app, 'handleMmAudioUpload');
const handleMmVideoUpload = bind(app, 'handleMmVideoUpload');
const removeMmMedia = bind(app, 'removeMmMedia');
const submitMmChat = bind(app, 'submitMmChat');
const stopMmChat = bind(app, 'stopMmChat');
const clearMmChat = bind(app, 'clearMmChat');
const analyzeDrivingScene = bind(app, 'analyzeDrivingScene');
const stopDrivingAnalysis = bind(app, 'stopDrivingAnalysis');
const loadApiKeys = bind(app, 'loadApiKeys');
const openCreateApiKey = bind(app, 'openCreateApiKey');
const createApiKey = bind(app, 'createApiKey');
const revokeApiKey = bind(app, 'revokeApiKey');
const copyToClipboard = bind(app, 'copyToClipboard');
const openVideoUploadInput = bind(app, 'openVideoUploadInput');
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
