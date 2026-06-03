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
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>全模态 Beta</strong>
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
