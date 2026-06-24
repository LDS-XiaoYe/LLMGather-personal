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
const MagicStick = bind(app, 'MagicStick');
const Plus = bind(app, 'Plus');
const Promotion = bind(app, 'Promotion');
const Refresh = bind(app, 'Refresh');
const Search = bind(app, 'Search');
const SwitchButton = bind(app, 'SwitchButton');
const renderMarkdown = bind(app, 'renderMarkdown');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const agents = bind(app, 'agents');
const agentLoading = bind(app, 'agentLoading');
const agentSaving = bind(app, 'agentSaving');
const agentPublishing = bind(app, 'agentPublishing');
const agentRunning = bind(app, 'agentRunning');
const agentGenerating = bind(app, 'agentGenerating');
const agentPrompt = bind(app, 'agentPrompt');
const agentImageUrlInput = bind(app, 'agentImageUrlInput');
const agentInvokeMaxSteps = bind(app, 'agentInvokeMaxSteps');
const agentConversationId = bind(app, 'agentConversationId');
const agentInvokePanelTab = bind(app, 'agentInvokePanelTab');
const agentImageInputOpen = bind(app, 'agentImageInputOpen');
const agentLastPrompt = bind(app, 'agentLastPrompt');
const agentRunHistoryFilter = bind(app, 'agentRunHistoryFilter');
const agentRunHistorySort = bind(app, 'agentRunHistorySort');
const agentImprovementSuggestions = bind(app, 'agentImprovementSuggestions');
const agentImprovementLoading = bind(app, 'agentImprovementLoading');
const agentRuns = bind(app, 'agentRuns');
const activeAgentRun = bind(app, 'activeAgentRun');
const activeAgentTraceStep = bind(app, 'activeAgentTraceStep');
const agentTraceReplayIndex = bind(app, 'agentTraceReplayIndex');
const agentTraceReplayMax = bind(app, 'agentTraceReplayMax');
const agentTraceReplayPlaying = bind(app, 'agentTraceReplayPlaying');
const agentTraceNodes = bind(app, 'agentTraceNodes');
const agentTraceEdges = bind(app, 'agentTraceEdges');
const agentTraceStageGroups = bind(app, 'agentTraceStageGroups');
const agentTraceLatencyMax = bind(app, 'agentTraceLatencyMax');
const agentFailedTraceSteps = bind(app, 'agentFailedTraceSteps');
const agentSlowTraceSteps = bind(app, 'agentSlowTraceSteps');
const agentExecutionTraceFlow = bind(app, 'agentExecutionTraceFlow');
const agentTraceSnapshot = bind(app, 'agentTraceSnapshot');
const activeAgentToolResultCards = bind(app, 'activeAgentToolResultCards');
const agentTraceDebuggerState = bind(app, 'agentTraceDebuggerState');
const agentComparativeReplay = bind(app, 'agentComparativeReplay');
const agentHarnessMetrics = bind(app, 'agentHarnessMetrics');
const skillMarketStats = bind(app, 'skillMarketStats');
const skillMarketRows = bind(app, 'skillMarketRows');
const agentContextSourceSummary = bind(app, 'agentContextSourceSummary');
const filteredAgentRuns = bind(app, 'filteredAgentRuns');
const agentWorkspaceMode = bind(app, 'agentWorkspaceMode');
const agentPageTab = bind(app, 'agentPageTab');
const dagNodeCategories = bind(app, 'dagNodeCategories');
const dagTemplates = bind(app, 'dagTemplates');
const getDagNodeInfo = bind(app, 'getDagNodeInfo');
const applyWorkflowDagTemplate = bind(app, 'applyWorkflowDagTemplate');
const availableTools = bind(app, 'availableTools');
const knowledgeBases = bind(app, 'knowledgeBases');
const agentMemories = bind(app, 'agentMemories');
const agentUserPreferenceMemories = bind(app, 'agentUserPreferenceMemories');
const agentScopedMemories = bind(app, 'agentScopedMemories');
const availableSkills = bind(app, 'availableSkills');
const workflows = bind(app, 'workflows');
const agentTeams = bind(app, 'agentTeams');
const mcpServers = bind(app, 'mcpServers');
const agentVersions = bind(app, 'agentVersions');
const agentVersionCompare = bind(app, 'agentVersionCompare');
const agentVersionCompareVisible = bind(app, 'agentVersionCompareVisible');
const marketplaceTemplates = bind(app, 'marketplaceTemplates');
const builtinAgents = bind(app, 'builtinAgents');
const agentResourceLoading = bind(app, 'agentResourceLoading');
const memorySaving = bind(app, 'memorySaving');
const skillCreating = bind(app, 'skillCreating');
const showSkillCreateDialog = bind(app, 'showSkillCreateDialog');
const skillPreviewOpen = bind(app, 'skillPreviewOpen');
const showTeamCreateDialog = bind(app, 'showTeamCreateDialog');
const showMcpCreateDialog = bind(app, 'showMcpCreateDialog');
const showMcpTestDialog = bind(app, 'showMcpTestDialog');
const showMarketplacePublishDialog = bind(app, 'showMarketplacePublishDialog');
const showVersionCreateDialog = bind(app, 'showVersionCreateDialog');
const showVersionPublishDialog = bind(app, 'showVersionPublishDialog');
const showEvaluationDialog = bind(app, 'showEvaluationDialog');
const showMemoryCreateDialog = bind(app, 'showMemoryCreateDialog');
const skillTesting = bind(app, 'skillTesting');
const activeSkill = bind(app, 'activeSkill');
const activeSkillTestResult = bind(app, 'activeSkillTestResult');
const skillTestInput = bind(app, 'skillTestInput');
const workflowRunning = bind(app, 'workflowRunning');
const teamCreating = bind(app, 'teamCreating');
const teamRunning = bind(app, 'teamRunning');
const mcpSaving = bind(app, 'mcpSaving');
const mcpTesting = bind(app, 'mcpTesting');
const versionSaving = bind(app, 'versionSaving');
const marketplaceInstalling = bind(app, 'marketplaceInstalling');
const marketplacePublishing = bind(app, 'marketplacePublishing');
const workflowInput = bind(app, 'workflowInput');
const activeWorkflowRun = bind(app, 'activeWorkflowRun');
const activeTeamId = bind(app, 'activeTeamId');
const teamInput = bind(app, 'teamInput');
const activeTeamRun = bind(app, 'activeTeamRun');
const activeMcpTestServerId = bind(app, 'activeMcpTestServerId');
const agentEvaluations = bind(app, 'agentEvaluations');
const agentStats = bind(app, 'agentStats');
const agentEvaluationLoading = bind(app, 'agentEvaluationLoading');
const agentEvaluationSaving = bind(app, 'agentEvaluationSaving');
const beginnerAssistTarget = bind(app, 'beginnerAssistTarget');
const evaluationForm = bind(app, 'evaluationForm');
const generatorForm = bind(app, 'generatorForm');
const agentCreateWizardStep = bind(app, 'agentCreateWizardStep');
const agentCreateWizardAdvancedOpen = bind(app, 'agentCreateWizardAdvancedOpen');
const selectedAgentTemplateId = bind(app, 'selectedAgentTemplateId');
const agentCreationGoal = bind(app, 'agentCreationGoal');
const beginnerAgentForm = bind(app, 'beginnerAgentForm');
const beginnerAgentPlainGuide = bind(app, 'beginnerAgentPlainGuide');
const beginnerAgentProgress = bind(app, 'beginnerAgentProgress');
const showAgentExportDialog = bind(app, 'showAgentExportDialog');
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
const dagNodeConfigErrors = bind(app, 'dagNodeConfigErrors');
const agentForm = bind(app, 'agentForm');
const memoryForm = bind(app, 'memoryForm');
const memoryTypeOptions = bind(app, 'memoryTypeOptions');
const editingMemoryId = bind(app, 'editingMemoryId');
const skillForm = bind(app, 'skillForm');
const teamForm = bind(app, 'teamForm');
const teamTemplates = bind(app, 'teamTemplates');
const mcpForm = bind(app, 'mcpForm');
const mcpServerOptions = bind(app, 'mcpServerOptions');
const versionForm = bind(app, 'versionForm');
const marketplaceForm = bind(app, 'marketplaceForm');
const agentCreationTemplates = bind(app, 'agentCreationTemplates');
const workflowCanvasNodes = bind(app, 'workflowCanvasNodes');
const workflowCanvasConnecting = bind(app, 'workflowCanvasConnecting');
const workflowCanvasSaving = bind(app, 'workflowCanvasSaving');
const workflowCanvasEdges = bind(app, 'workflowCanvasEdges');
const workflowConnectingNode = vueComputed(() => {
  const node = workflowCanvasNodes.value.find((item: any) => item.id === workflowCanvasConnecting.value);
  if (!node) return null;
  const info = unref(getDagNodeInfo)?.(node.type);
  return {
    ...node,
    label: node.name || info?.label || node.type,
  };
});
const agentPublicEndpoint = bind(app, 'agentPublicEndpoint');
const agentApiEndpoint = bind(app, 'agentApiEndpoint');
const agentGuideCards = bind(app, 'agentGuideCards');
const isLoadingModels = bind(app, 'isLoadingModels');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isComposing = bind(app, 'isComposing');
const isAuthenticated = bind(app, 'isAuthenticated');
const loadModels = bind(app, 'loadModels');
const refreshAgentStudio = bind(app, 'refreshAgentStudio');
const loadAgentResources = bind(app, 'loadAgentResources');
const createAgentDraft = bind(app, 'createAgentDraft');
const applyAgentTemplate = bind(app, 'applyAgentTemplate');
const applyBeginnerExample = bind(app, 'applyBeginnerExample');
const applyBeginnerFormToAgent = bind(app, 'applyBeginnerFormToAgent');
const generateBeginnerAgentDraft = bind(app, 'generateBeginnerAgentDraft');
const improveBeginnerText = bind(app, 'improveBeginnerText');
const nextAgentWizardStep = bind(app, 'nextAgentWizardStep');
const previousAgentWizardStep = bind(app, 'previousAgentWizardStep');
const saveAgentFromWizard = bind(app, 'saveAgentFromWizard');
const saveAgentPublication = bind(app, 'saveAgentPublication');
const generateAgentFromRequirement = bind(app, 'generateAgentFromRequirement');
const installMarketplaceTemplate = bind(app, 'installMarketplaceTemplate');
const installBuiltinAgentFromSpec = bind(app, 'installBuiltinAgentFromSpec');
const publishCurrentAgentToMarketplace = bind(app, 'publishCurrentAgentToMarketplace');
const deleteMarketplaceTemplate = bind(app, 'deleteMarketplaceTemplate');
const saveAgent = bind(app, 'saveAgent');
const removeAgent = bind(app, 'removeAgent');
const runCurrentAgent = bind(app, 'runCurrentAgent');
const stopCurrentAgentRun = bind(app, 'stopCurrentAgentRun');
const clearAgentPrompt = bind(app, 'clearAgentPrompt');
const fillAgentPromptExample = bind(app, 'fillAgentPromptExample');
const rerunLastAgentPrompt = bind(app, 'rerunLastAgentPrompt');
const copyActiveAgentOutput = bind(app, 'copyActiveAgentOutput');
const selectAgentRun = bind(app, 'selectAgentRun');
const openAgentRunTrace = bind(app, 'openAgentRunTrace');
const selectAgentTraceStep = bind(app, 'selectAgentTraceStep');
const pauseAgentTraceReplay = bind(app, 'pauseAgentTraceReplay');
const resumeAgentTraceReplay = bind(app, 'resumeAgentTraceReplay');
const stepIntoAgentTrace = bind(app, 'stepIntoAgentTrace');
const stepOverAgentTrace = bind(app, 'stepOverAgentTrace');
const restartAgentFromTraceNode = bind(app, 'restartAgentFromTraceNode');
const agentRunTagType = bind(app, 'agentRunTagType');
const agentRunStatusLabel = bind(app, 'agentRunStatusLabel');
const agentStepTypeLabel = bind(app, 'agentStepTypeLabel');
const agentLifecycleStatusLabel = bind(app, 'agentLifecycleStatusLabel');
const riskLevelLabel = bind(app, 'riskLevelLabel');
const teamStrategyLabel = bind(app, 'teamStrategyLabel');
const agentVersionStatusLabel = bind(app, 'agentVersionStatusLabel');
const agentVersionStatusType = bind(app, 'agentVersionStatusType');
const agentEvalTagType = bind(app, 'agentEvalTagType');
const evaluateActiveAgentRun = bind(app, 'evaluateActiveAgentRun');
const generateCurrentAgentImprovementSuggestions = bind(app, 'generateCurrentAgentImprovementSuggestions');
const formatAgentDate = bind(app, 'formatAgentDate');
const formatStepMetadata = bind(app, 'formatStepMetadata');
const createAgentMemory = bind(app, 'createAgentMemory');
const startEditAgentMemory = bind(app, 'startEditAgentMemory');
const resetMemoryEditor = bind(app, 'resetMemoryEditor');
const saveAgentMemory = bind(app, 'saveAgentMemory');
const deleteAgentMemory = bind(app, 'deleteAgentMemory');
const createSkillFromForm = bind(app, 'createSkillFromForm');
const exportSkillAsMarkdown = bind(app, 'exportSkillAsMarkdown');
const agentExportPreview = bind(app, 'agentExportPreview');
const exportAgentAsJson = bind(app, 'exportAgentAsJson');
const confirmExportAgentBundle = bind(app, 'confirmExportAgentBundle');
const exportAgentAsMarkdown = bind(app, 'exportAgentAsMarkdown');
const previewSkill = bind(app, 'previewSkill');
const previewSkillById = bind(app, 'previewSkillById');
const runActiveSkillTest = bind(app, 'runActiveSkillTest');
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
const getDagNodeConfigGuide = bind(app, 'getDagNodeConfigGuide');
const createDefaultWorkflow = bind(app, 'createDefaultWorkflow');
const openTeamCreateDialog = bind(app, 'openTeamCreateDialog');
const applyTeamTemplate = bind(app, 'applyTeamTemplate');
const addTeamFormMember = bind(app, 'addTeamFormMember');
const removeTeamFormMember = bind(app, 'removeTeamFormMember');
const createTeamFromForm = bind(app, 'createTeamFromForm');
const runSelectedTeam = bind(app, 'runSelectedTeam');
const createVersionFromForm = bind(app, 'createVersionFromForm');
const publishVersionFromForm = bind(app, 'publishVersionFromForm');
const openVersionPublishDialog = bind(app, 'openVersionPublishDialog');
const restoreVersion = bind(app, 'restoreVersion');
const rollbackVersion = bind(app, 'rollbackVersion');
const compareVersions = bind(app, 'compareVersions');
const createMcpServerFromForm = bind(app, 'createMcpServerFromForm');
const testMcpServer = bind(app, 'testMcpServer');
const openMcpTestDialog = bind(app, 'openMcpTestDialog');
const startDagNodeDrag = bind(app, 'startDagNodeDrag');
const dropDagNode = bind(app, 'dropDagNode');
const startWorkflowNodeDrag = bind(app, 'startWorkflowNodeDrag');
const dragWorkflowNode = bind(app, 'dragWorkflowNode');
const stopWorkflowNodeDrag = bind(app, 'stopWorkflowNodeDrag');
const connectWorkflowNode = bind(app, 'connectWorkflowNode');
const removeWorkflowCanvasNode = bind(app, 'removeWorkflowCanvasNode');
const saveWorkflowCanvas = bind(app, 'saveWorkflowCanvas');
const runSelectedWorkflow = bind(app, 'runSelectedWorkflow');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const switchPage = bind(app, 'switchPage');
const getModelTags = bind(app, 'getModelTags');
const chatModels = bind(app, 'chatModels');

function formatTraceDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '无';
  if (Array.isArray(value) && value.length === 0) return '无';
  if (typeof value !== 'string') return JSON.stringify(value, null, 2);
  const raw = value.trim();
  if (!raw) return '无';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 0) return '无';
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const payload = parsed as Record<string, unknown>;
      if ('result' in payload || 'stdout' in payload || 'logs' in payload) {
        if (payload.result && typeof payload.result === 'object') return JSON.stringify(payload.result, null, 2);
        if (typeof payload.stdout === 'string' && payload.stdout.trim()) {
          try {
            const stdoutPayload = JSON.parse(payload.stdout.trim());
            return typeof stdoutPayload === 'string' ? stdoutPayload : JSON.stringify(stdoutPayload, null, 2);
          } catch {
            return payload.stdout.trim();
          }
        }
      }
    }
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    return value
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ');
  }
}
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>Agent 工作台</strong>
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

        <div class="agent-studio-shell">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以创建和运行 Agent" />

          <template v-else>
            <div class="agent-workspace-switch">
              <div class="agent-current-info">
                <div class="agent-current-avatar">
                  <el-avatar :size="32" :style="{ backgroundColor: '#2563eb' }">
                    {{ agentForm.name ? agentForm.name.charAt(0).toUpperCase() : 'A' }}
                  </el-avatar>
                </div>
                <div class="agent-current-detail">
                  <span class="agent-current-name">{{ agentForm.name || '未命名 Agent' }}</span>
                  <span class="agent-current-meta">
                    <el-tag v-if="agentForm.model" size="small" type="info">{{ agentForm.model }}</el-tag>
                    <el-tag v-else size="small" type="warning">未选模型</el-tag>
                    <el-tag v-if="agentForm.id" size="small" type="success">已保存</el-tag>
                    <el-tag v-else size="small" type="info">未保存</el-tag>
                  </span>
                </div>
              </div>
              <div class="agent-workspace-actions">
                <el-button size="small" type="primary" plain :disabled="!agentForm.id" @click="exportAgentAsJson()">导出 JSON 包</el-button>
              </div>
            </div>

            <div class="agent-mode-nav">
              <div class="agent-workspace-tabs">
                <button
                  type="button"
                  class="agent-workspace-tab"
                  :class="{ active: agentWorkspaceMode === 'develop' }"
                  @click="agentWorkspaceMode = 'develop'"
                >
                  <span>开发</span>
                </button>
                <button
                  type="button"
                  class="agent-workspace-tab"
                  :class="{ active: agentWorkspaceMode === 'invoke' }"
                  @click="agentWorkspaceMode = 'invoke'"
                >
                  <span>调用</span>
                </button>
              </div>
              <template v-if="agentWorkspaceMode === 'develop'">
                <el-segmented
                  class="agent-page-tabs"
                  v-model="agentPageTab"
                  :options="[
                    { label: '从零搭建', value: 'starter' },
                    { label: '总览', value: 'overview' },
                    { label: '基础', value: 'basic' },
                    { label: '能力', value: 'capabilities' },
                    { label: '工具', value: 'tools' },
                    { label: '工作流', value: 'workflow' },
                    { label: '协作', value: 'collab' },
                    { label: '集成', value: 'integration' },
                    { label: '发布', value: 'publish' },
                    { label: '提示词', value: 'prompt' },
                    { label: '市场', value: 'marketplace' },
                  ]"
                />
              </template>
            </div>

            <div v-if="agentWorkspaceMode === 'develop'" class="agent-page" :class="`agent-mode-${agentPageTab}`">
            <!-- ========== 从零搭建 Tab ========== -->
            <el-card v-show="agentPageTab === 'starter'" class="agent-panel agent-starter-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>从零搭建 Agent</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="success">新手模式</el-tag>

                  </div>
                </div>
              </template>

              <div class="agent-starter-shell">
                <aside class="agent-starter-rail">
                  <button
                    v-for="(label, index) in ['选场景', '说需求', '补能力', '试一下']"
                    :key="label"
                    type="button"
                    class="agent-starter-step"
                    :class="{ active: agentCreateWizardStep === index, done: beginnerAgentProgress > index }"
                    @click="agentCreateWizardStep = index"
                  >
                    <span>{{ index + 1 }}</span>
                    <strong>{{ label }}</strong>
                  </button>
                </aside>

                <main class="agent-starter-main">
                  <section v-show="agentCreateWizardStep === 0" class="agent-starter-section">
                    <div class="agent-starter-title">
                      <div>
                        <strong>先选一个最像的场景</strong>
                        <p>不用选得很准，后面还可以改。模板只是帮你少填几项。</p>
                      </div>
                      <el-button :icon="MagicStick" plain @click="applyBeginnerExample(selectedAgentTemplateId)">一键填示例</el-button>
                    </div>
                    <div class="agent-template-grid compact">
                      <button
                        v-for="template in agentCreationTemplates"
                        :key="template.id"
                        type="button"
                        class="agent-template-card"
                        :class="{ active: selectedAgentTemplateId === template.id }"
                        @click="selectedAgentTemplateId = template.id; applyAgentTemplate(template.id); applyBeginnerExample(template.id)"
                      >
                        <span class="agent-template-icon">{{ template.name.slice(0, 1) }}</span>
                        <strong>{{ template.name }}</strong>
                        <small>{{ template.description }}</small>
                      </button>
                    </div>
                  </section>

                  <section v-show="agentCreateWizardStep === 1" class="agent-starter-section">
                    <div class="agent-starter-title">
                      <div>
                        <strong>你可以用大白话告诉这个 Agent 要帮谁、做什么</strong>
                        <p>这里不是写代码，也不是写提示词。像交代一个可靠的新同事一样就行。</p>
                      </div>
                      <el-button :icon="MagicStick" type="primary" plain :loading="agentGenerating" @click="generateBeginnerAgentDraft()">AI 生成整套草稿</el-button>
                    </div>
                    <div class="agent-starter-form-grid agent-starter-brief-grid">
                      <label class="agent-starter-field">
                        <span>它主要帮谁？</span>
                        <el-input v-model="beginnerAgentForm.audience" placeholder="例如：客服同事、运营、我自己、客户" @change="applyBeginnerFormToAgent()" />
                      </label>
                      <label class="agent-starter-field wide">
                        <span>它要帮你做什么？</span>
                        <el-input v-model="beginnerAgentForm.job" type="textarea" :rows="3" resize="vertical" placeholder="例如：根据产品资料回答客户问题，并整理可直接发送的回复" @change="applyBeginnerFormToAgent()" />
                        <div class="agent-starter-field-actions">
                          <el-button size="small" type="primary" plain :icon="MagicStick" :loading="beginnerAssistTarget === 'goal'" @click="improveBeginnerText('goal')">AI 扩写</el-button>
                        </div>
                      </label>
                      <label class="agent-starter-field">
                        <span>怎样算做得好？</span>
                        <el-input v-model="beginnerAgentForm.success" placeholder="例如：回答准确、能给下一步建议、客户能看懂" @change="applyBeginnerFormToAgent()" />
                        <div class="agent-starter-field-actions">
                          <el-button size="small" type="primary" plain :icon="MagicStick" :loading="beginnerAssistTarget === 'success'" @click="improveBeginnerText('success')">AI 补标准</el-button>
                        </div>
                      </label>
                      <label class="agent-starter-field">
                        <span>说话风格</span>
                        <el-input v-model="beginnerAgentForm.tone" placeholder="例如：专业但不生硬，少废话" @change="applyBeginnerFormToAgent()" />
                      </label>
                      <label class="agent-starter-field wide">
                        <span>哪些事不要做？</span>
                        <el-input v-model="beginnerAgentForm.avoid" placeholder="例如：不要编造政策，不确定时先问我" @change="applyBeginnerFormToAgent()" />
                        <div class="agent-starter-field-actions">
                          <el-button size="small" type="primary" plain :icon="MagicStick" :loading="beginnerAssistTarget === 'avoid'" @click="improveBeginnerText('avoid')">AI 补边界</el-button>
                        </div>
                      </label>
                    </div>
                  </section>

                  <section v-show="agentCreateWizardStep === 2" class="agent-starter-section">
                    <div class="agent-starter-title">
                      <div>
                        <strong>给它加能力，可跳过</strong>
                        <p>知识库像资料夹，工具像计算器或执行器，技能像已经打包好的专门能力。</p>
                      </div>
                      <el-button :icon="MagicStick" plain :loading="agentGenerating" @click="generateBeginnerAgentDraft()">AI 按需求推荐</el-button>
                    </div>
                    <div class="agent-starter-ability-grid">
                      <div>
                        <span>知识库</span>
                        <small>让 Agent 按你的资料回答。</small>
                        <el-select v-model="agentForm.knowledgeBaseIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="可不选" style="width:100%">
                          <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                        </el-select>
                      </div>
                      <div>
                        <span>工具</span>
                        <small>让 Agent 计算、处理文本或执行动作。</small>
                        <el-select v-model="agentForm.toolIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="可不选" style="width:100%">
                          <el-option v-for="tool in availableTools" :key="tool.id" :label="tool.displayName" :value="tool.id" />
                        </el-select>
                      </div>
                      <div>
                        <span>技能</span>
                        <small>让 Agent 做研究、分析、代码等专门任务。</small>
                        <el-select v-model="agentForm.skillIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="可不选" style="width:100%">
                          <el-option v-for="skill in availableSkills" :key="skill.id" :label="skill.name" :value="skill.id" />
                        </el-select>
                      </div>
                      <div class="agent-starter-memory">
                        <span>长期记忆</span>
                        <small>开启后，它能记住偏好和背景。涉及隐私的场景可以关闭。</small>
                        <el-switch v-model="agentForm.memoryEnabled" active-text="开启" inactive-text="关闭" />
                      </div>
                    </div>
                  </section>

                  <section v-show="agentCreateWizardStep === 3" class="agent-starter-section">
                    <div class="agent-starter-title">
                      <div>
                        <strong>最后试一句</strong>
                        <p>保存后会进入调用页，用这句话检查它是不是按你的想法工作。</p>
                      </div>
                      <el-button :icon="MagicStick" type="primary" plain :loading="beginnerAssistTarget === 'sample'" @click="improveBeginnerText('sample')">AI 填试用问题</el-button>
                    </div>
                    <div class="agent-starter-final">
                      <label>
                        <span>Agent 名称</span>
                        <el-input v-model="agentForm.name" maxlength="80" show-word-limit placeholder="例如：产品客服 Agent" />
                      </label>
                      <label>
                        <span>模型</span>
                        <el-select v-model="agentForm.model" placeholder="选择模型" filterable style="width:100%">
                          <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                        </el-select>
                      </label>
                      <label class="wide">
                        <span>试运行输入</span>
                        <el-input v-model="agentPrompt" type="textarea" :rows="4" resize="vertical" placeholder="例如：客户问退款规则，请给一段可以直接发送的回复。" />
                      </label>
                    </div>
                  </section>

                  <div class="agent-starter-actions">
                    <el-button @click="createAgentDraft" :icon="Plus">重新开始</el-button>
                    <el-button :disabled="agentCreateWizardStep === 0" @click="previousAgentWizardStep()">上一步</el-button>
                    <el-button v-if="agentCreateWizardStep < 3" type="primary" @click="agentCreateWizardStep === 1 ? (applyBeginnerFormToAgent(), nextAgentWizardStep()) : nextAgentWizardStep()">下一步</el-button>
                    <template v-else>
                      <el-button type="primary" :loading="agentSaving" @click="applyBeginnerFormToAgent(); saveAgentFromWizard(false)">保存草稿</el-button>
                      <el-button type="success" :loading="agentSaving" @click="applyBeginnerFormToAgent(); saveAgentFromWizard(true)">保存并去试用</el-button>
                    </template>
                  </div>
                </main>

                <aside class="agent-starter-guide">
                  <div class="agent-guide-box">
                    <span>现在这个 Agent</span>
                    <strong>{{ beginnerAgentPlainGuide.title }}</strong>
                    <p>{{ beginnerAgentPlainGuide.does }}</p>
                  </div>
                  <div class="agent-guide-box">
                    <span>它会怎么做</span>
                    <p>{{ beginnerAgentPlainGuide.abilities }}</p>
                  </div>
                  <div class="agent-guide-box">
                    <span>你怎么用</span>
                    <p>{{ beginnerAgentPlainGuide.howToUse }}</p>
                  </div>
                  <div class="agent-guide-box">
                    <span>它不会乱来</span>
                    <p>{{ beginnerAgentPlainGuide.safety }}</p>
                  </div>
                </aside>
              </div>
            </el-card>

            <!-- ========== 总览 Tab ========== -->
            <el-card v-show="agentPageTab === 'overview'" class="agent-panel agent-overview-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 总览</span>
                  <div class="agent-head-tags">
                    <el-button size="small" text :loading="agentResourceLoading" @click="loadAgentResources()">刷新</el-button>
                  </div>
                </div>
              </template>

              <div class="agent-overview-stats">
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
                  <span>Token</span>
                </div>
              </div>

              <el-divider />

              <div class="agent-overview-section">
                <div class="agent-section-title">
                  <span>版本历史</span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :disabled="!agentForm.id"
                    @click="showVersionCreateDialog = true"
                  >
                    创建版本快照
                  </el-button>
                </div>
                <div class="agent-resource-stack">
                  <div v-for="version in agentVersions" :key="version.id" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>v{{ version.versionNumber }} · {{ version.label }}</span>
                      <div class="agent-inline-actions">
                        <el-tag size="small" :type="agentVersionStatusType(version.status)">{{ agentVersionStatusLabel(version.status) }}</el-tag>
                        <el-button size="small" text :loading="versionSaving" @click="openVersionPublishDialog(version, 'stable')">发布</el-button>
                        <el-button size="small" text :loading="versionSaving" @click="openVersionPublishDialog(version, 'canary')">灰度</el-button>
                        <el-button size="small" text :loading="versionSaving" @click="restoreVersion(version.id)">恢复编辑</el-button>
                        <el-button size="small" text type="danger" :loading="versionSaving" @click="rollbackVersion(version.id)">回滚</el-button>
                      </div>
                    </div>
                    <div class="agent-resource-meta">
                      {{ formatAgentDate(version.createdAt) }}
                      <template v-if="version.status === 'canary'"> · 灰度 {{ version.trafficPercent }}%</template>
                      <template v-if="version.publishedAt"> · 发布于 {{ formatAgentDate(version.publishedAt) }}</template>
                    </div>
                    <div v-if="version.notes" class="agent-resource-content">{{ version.notes }}</div>
                  </div>
                  <el-empty v-if="agentVersions.length === 0" description="暂无版本" :image-size="72" />
                </div>
                <div v-if="agentVersions.length >= 2" class="agent-version-compare-row">
                  <el-select v-model="versionForm.compareLeftId" placeholder="选择基准版本" size="small" style="width: 180px">
                    <el-option v-for="version in agentVersions" :key="version.id" :label="`v${version.versionNumber} · ${version.label}`" :value="version.id" />
                  </el-select>
                  <el-select v-model="versionForm.compareRightId" placeholder="选择目标版本" size="small" style="width: 180px">
                    <el-option v-for="version in agentVersions" :key="version.id" :label="`v${version.versionNumber} · ${version.label}`" :value="version.id" />
                  </el-select>
                  <el-button size="small" :loading="versionSaving" @click="compareVersions()">对比版本</el-button>
                </div>
                <el-dialog v-model="showVersionCreateDialog" title="创建版本快照" width="520px" :close-on-click-modal="false" append-to-body>
                  <el-form label-position="top">
                    <el-form-item label="版本标签">
                      <el-input v-model="versionForm.label" placeholder="例如 release-1，留空则自动生成" maxlength="120" />
                    </el-form-item>
                    <el-form-item label="发布备注">
                      <el-input v-model="versionForm.notes" type="textarea" :rows="3" placeholder="记录目标、变更点和验证结论" maxlength="1000" show-word-limit />
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showVersionCreateDialog = false">取消</el-button>
                    <el-button type="primary" :loading="versionSaving" :disabled="!agentForm.id" @click="createVersionFromForm()">创建</el-button>
                  </template>
                </el-dialog>
                <el-dialog v-model="showVersionPublishDialog" title="发布版本" width="560px" :close-on-click-modal="false" append-to-body>
                  <el-form label-position="top">
                    <el-form-item label="发布方式">
                      <el-segmented v-model="versionForm.releaseMode" :options="[
                        { label: '稳定发布', value: 'stable' },
                        { label: '灰度发布', value: 'canary' },
                      ]" />
                    </el-form-item>
                    <el-form-item v-if="versionForm.releaseMode === 'canary'" label="灰度流量">
                      <el-input-number v-model="versionForm.trafficPercent" :min="1" :max="99" :step="1" style="width:100%" />
                    </el-form-item>
                    <el-form-item v-if="!versionForm.targetVersionId" label="版本标签">
                      <el-input v-model="versionForm.label" placeholder="留空则创建新的发布版本" maxlength="120" />
                    </el-form-item>
                    <el-form-item label="发布备注">
                      <el-input v-model="versionForm.notes" type="textarea" :rows="3" placeholder="说明本次发布目标、风险和回滚依据" maxlength="1000" show-word-limit />
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showVersionPublishDialog = false">取消</el-button>
                    <el-button type="primary" :loading="versionSaving" :disabled="!agentForm.id" @click="publishVersionFromForm()">确认发布</el-button>
                  </template>
                </el-dialog>
                <el-dialog v-model="agentVersionCompareVisible" title="版本对比" width="760px" append-to-body>
                  <el-table :data="agentVersionCompare?.changes || []" empty-text="两个版本没有关键差异" style="width:100%">
                    <el-table-column label="字段" prop="field" width="140" />
                    <el-table-column label="基准版本" min-width="240">
                      <template #default="{ row }"><pre class="agent-mini-pre">{{ JSON.stringify(row.left, null, 2) }}</pre></template>
                    </el-table-column>
                    <el-table-column label="目标版本" min-width="240">
                      <template #default="{ row }"><pre class="agent-mini-pre">{{ JSON.stringify(row.right, null, 2) }}</pre></template>
                    </el-table-column>
                  </el-table>
                </el-dialog>
              </div>

              <el-divider />

              <div class="agent-overview-section">
                <div class="agent-section-title">
                  <span>评测</span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :disabled="!activeAgentRun"
                    @click="showEvaluationDialog = true"
                  >
                    评测当前运行
                  </el-button>
                </div>
                <div class="agent-resource-stack">
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
                <el-dialog v-model="showEvaluationDialog" title="评测当前运行" width="620px" :close-on-click-modal="false">
                  <el-form label-position="top">
                    <el-form-item label="评测模式">
                      <el-segmented
                        v-model="evaluationForm.mode"
                        :options="[
                          { label: '混合', value: 'hybrid' },
                          { label: '规则', value: 'rules' },
                          { label: 'LLM', value: 'llm' },
                        ]"
                      />
                    </el-form-item>
                    <el-form-item label="评审模型">
                      <el-select v-model="evaluationForm.judgeModel" placeholder="默认使用当前 Agent 模型" clearable filterable style="width:100%">
                        <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="期望答案或关键点">
                      <el-input
                        v-model="evaluationForm.expectedOutput"
                        type="textarea"
                        :rows="3"
                        resize="vertical"
                        placeholder="可选"
                      />
                    </el-form-item>
                    <el-form-item label="评测标准">
                      <el-input
                        v-model="evaluationForm.rubric"
                        type="textarea"
                        :rows="3"
                        resize="vertical"
                        placeholder="可选：自定义通过标准"
                      />
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showEvaluationDialog = false">取消</el-button>
                    <el-button type="primary" :loading="agentEvaluationSaving" :disabled="!activeAgentRun" @click="evaluateActiveAgentRun()">开始评测</el-button>
                  </template>
                </el-dialog>
              </div>
            </el-card>

            <!-- ========== 基础 Tab ========== -->
            <el-card v-show="agentPageTab === 'basic'" class="agent-panel agent-basic-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>专业配置</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" :type="agentForm.status === 'active' ? 'success' : 'info'">{{ agentLifecycleStatusLabel(agentForm.status) }}</el-tag>
                    <el-tag size="small" type="info">子 Agent {{ agentForm.subAgentIds.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-pro-config">
                <section class="agent-pro-section">
                  <div class="agent-section-title">身份与运行</div>
                  <el-form label-position="top" class="agent-pro-form">
                    <div class="agent-pro-grid">
                      <el-form-item label="名称">
                        <el-input v-model="agentForm.name" maxlength="80" show-word-limit placeholder="例如：产品客服 Agent" />
                      </el-form-item>
                      <el-form-item label="模型">
                        <el-select v-model="agentForm.model" placeholder="选择模型" filterable style="width:100%">
                          <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id">
                            <span>{{ model.id }}</span>
                            <el-tag v-if="getModelTags(model.id).includes('vision')" size="small" type="warning" style="margin-left:6px">视觉</el-tag>
                          </el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item label="状态">
                        <el-segmented
                          v-model="agentForm.status"
                          :options="[
                            { label: '启用', value: 'active' },
                            { label: '归档', value: 'archived' },
                          ]"
                        />
                      </el-form-item>
                      <el-form-item label="长期记忆">
                        <el-switch v-model="agentForm.memoryEnabled" active-text="开启" inactive-text="关闭" />
                      </el-form-item>
                    </div>
                    <el-form-item label="描述">
                      <el-input v-model="agentForm.description" maxlength="500" show-word-limit placeholder="这个 Agent 适合处理什么任务" />
                    </el-form-item>
                    <div class="agent-pro-grid compact">
                      <el-form-item label="温度">
                        <el-input-number v-model="agentForm.temperature" :min="0" :max="2" :step="0.1" :precision="1" style="width:100%" />
                      </el-form-item>
                      <el-form-item label="最大 Token">
                        <el-input-number v-model="agentForm.maxTokens" :min="1" :max="32000" :step="256" style="width:100%" />
                      </el-form-item>
                    </div>
                  </el-form>
                </section>

                <section class="agent-pro-section">
                  <div class="agent-section-title">
                    <span>Sub-Agent 编排</span>
                    <el-tag size="small" type="info">无感自动委派</el-tag>
                  </div>
                  <div class="agent-harness-note">
                    Harness 会让模型在同一轮里自主选择普通 Tool、子 Agent 或直接回答；子 Agent 只处理被明确拆出的子任务。
                  </div>
                  <el-select
                    v-model="agentForm.subAgentIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择可被当前 Agent 调用的子 Agent"
                    style="width:100%"
                  >
                    <el-option
                      v-for="agent in agents.filter((item:any) => item.id !== agentForm.id && item.status === 'active')"
                      :key="agent.id"
                      :label="agent.name"
                      :value="agent.id"
                    >
                      <span>{{ agent.name }}</span>
                      <el-text type="info" size="small" style="margin-left:8px">{{ agent.description || agent.model }}</el-text>
                    </el-option>
                  </el-select>
                  <div v-if="agentForm.subAgentIds.length" class="agent-subagent-list">
                    <div v-for="subAgentId in agentForm.subAgentIds" :key="subAgentId" class="agent-subagent-item">
                      <div>
                        <strong>{{ agents.find((item:any) => item.id === subAgentId)?.name || subAgentId }}</strong>
                        <span>{{ agents.find((item:any) => item.id === subAgentId)?.description || '已绑定为子 Agent' }}</span>
                      </div>
                      <el-button size="small" text type="danger" @click="agentForm.subAgentIds = agentForm.subAgentIds.filter((id:any) => id !== subAgentId)">移除</el-button>
                    </div>
                  </div>
                </section>

                <section class="agent-pro-section">
                  <div class="agent-section-title">能力契约</div>
                  <div class="agent-contract-grid">
                    <div class="agent-contract-item">
                      <strong>Tool</strong>
                      <span>可执行动作，有输入结构、超时、风险和真实运行结果。</span>
                      <el-tag size="small" type="warning">已选 {{ agentForm.toolIds.length }}</el-tag>
                    </div>
                    <div class="agent-contract-item">
                      <strong>Skill</strong>
                      <span>工作方法和步骤，会注入提示词，不会自己执行外部动作。</span>
                      <el-tag size="small" type="success">已选 {{ agentForm.skillIds.length }}</el-tag>
                    </div>
                    <div class="agent-contract-item">
                      <strong>Knowledge</strong>
                      <span>检索资料来源，适合产品文档、FAQ、项目知识。</span>
                      <el-tag size="small" type="primary">已选 {{ agentForm.knowledgeBaseIds.length }}</el-tag>
                    </div>
                    <div class="agent-contract-item">
                      <strong>Memory</strong>
                      <span>长期上下文，用户偏好会作为全局画像给所有 Agent 使用。</span>
                      <el-tag size="small" :type="agentForm.memoryEnabled ? 'success' : 'info'">{{ agentForm.memoryEnabled ? '开启' : '关闭' }}</el-tag>
                    </div>
                  </div>
                </section>

                <section class="agent-pro-section">
                  <div class="agent-section-title">提示词与安全边界</div>
                  <el-input
                    v-model="agentForm.systemPrompt"
                    type="textarea"
                    :rows="10"
                    resize="vertical"
                    maxlength="12000"
                    show-word-limit
                    placeholder="写清楚角色、任务边界、输出格式、失败时怎么处理。"
                  />
                </section>

                <div class="agent-create-actions">
                  <el-button @click="createAgentDraft" :icon="Plus">新草稿</el-button>
                  <el-button type="primary" :loading="agentSaving" @click="saveAgent()">保存配置</el-button>
                </div>
              </div>
            </el-card>

            <!-- ========== 能力 Tab ========== -->
            <el-card v-show="agentPageTab === 'capabilities'" class="agent-panel agent-capabilities-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 能力</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="warning">工具 {{ agentForm.toolIds.length }}</el-tag>
                    <el-tag size="small" type="success">技能 {{ agentForm.skillIds.length }}</el-tag>
                    <el-tag size="small" type="primary">RAG {{ agentForm.knowledgeBaseIds.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-capability-primer">
                <div><strong>Tool</strong><span>真实执行动作，返回可追踪结果。</span></div>
                <div><strong>Skill</strong><span>工作方法，注入提示词。</span></div>
                <div><strong>Knowledge</strong><span>检索资料，不负责执行。</span></div>
                <div><strong>Memory</strong><span>长期上下文，偏好可跨 Agent 使用。</span></div>
              </div>

              <div class="agent-capabilities-grid">
                <div class="agent-cap-section">
                  <div class="agent-section-title">工具</div>
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
                </div>

                <div class="agent-cap-section">
                  <div class="agent-section-title">
                    <span>技能</span>
                    <el-button size="small" text type="primary" @click="showSkillCreateDialog = true">创建技能</el-button>
                  </div>
                  <div v-if="agentForm.skillIds.length" class="agent-bound-skill-list">
                    <div v-for="skillId in agentForm.skillIds" :key="skillId" class="agent-bound-skill-item">
                      <span>{{ availableSkills.find((skill) => skill.id === skillId)?.name || skillId }}</span>
                      <div>
                        <el-tag v-if="availableSkills.find((skill) => skill.id === skillId)" size="small" :type="skillRiskTagType(availableSkills.find((skill) => skill.id === skillId)!.riskLevel)">
                          {{ riskLevelLabel(availableSkills.find((skill) => skill.id === skillId)!.riskLevel) }}
                        </el-tag>
                        <el-button size="small" text @click="previewSkillById(skillId)">预览</el-button>
                        <el-button
                          size="small"
                          text
                          :disabled="!availableSkills.find((skill) => skill.id === skillId)"
                          @click="exportSkillAsMarkdown(availableSkills.find((skill) => skill.id === skillId)!)"
                        >
                          导出
                        </el-button>
                        <el-button size="small" text type="danger" @click="agentForm.skillIds = agentForm.skillIds.filter((id) => id !== skillId)">移除</el-button>
                      </div>
                    </div>
                  </div>
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
                </div>

                <div class="agent-cap-section">
                  <div class="agent-section-title">知识库</div>
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
                  <div class="agent-field-foot">
                    <span>文档上传和检索测试在 RAG 页面完成。</span>
                    <el-button size="small" text type="primary" @click="switchPage('rag')">打开 RAG</el-button>
                  </div>
                </div>

                <div class="agent-cap-section">
                  <div class="agent-section-title">
                    <span>记忆</span>
                    <el-button
                      size="small"
                      type="primary"
                      plain
                      :disabled="!agentForm.id"
                      @click="resetMemoryEditor(); showMemoryCreateDialog = true"
                    >
                      写入记忆
                    </el-button>
                  </div>
                  <div class="agent-memory-group-title">用户偏好 Memory</div>
                  <div v-for="memory in agentUserPreferenceMemories" :key="memory.id" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <div>
                        <el-tag size="small" type="success">用户偏好</el-tag>
                        <span style="margin-left:6px">重要性 {{ memory.importance }}</span>
                      </div>
                      <div>
                        <el-button size="small" text @click="startEditAgentMemory(memory)">编辑</el-button>
                        <el-button size="small" text type="danger" @click="deleteAgentMemory(memory)">删除</el-button>
                      </div>
                    </div>
                    <div class="agent-resource-content">{{ memory.content }}</div>
                  </div>
                  <el-empty v-if="agentUserPreferenceMemories.length === 0" description="暂无用户偏好" :image-size="56" />

                  <div class="agent-memory-group-title">当前 Agent 专属记忆</div>
                  <div v-for="memory in agentScopedMemories" :key="memory.id" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <div>
                        <el-tag size="small" type="info">{{ memory.memoryType }}</el-tag>
                        <span style="margin-left:6px">重要性 {{ memory.importance }}</span>
                      </div>
                      <div>
                        <el-button size="small" text @click="startEditAgentMemory(memory)">编辑</el-button>
                        <el-button size="small" text type="danger" @click="deleteAgentMemory(memory)">删除</el-button>
                      </div>
                    </div>
                    <div class="agent-resource-content">{{ memory.content }}</div>
                  </div>
                  <el-empty v-if="agentScopedMemories.length === 0" description="暂无 Agent 专属记忆" :image-size="56" />
                  <el-dialog
                    v-model="showMemoryCreateDialog"
                    :title="editingMemoryId ? '编辑长期记忆' : '写入长期记忆'"
                    width="560px"
                    :close-on-click-modal="false"
                    @closed="resetMemoryEditor()"
                  >
                    <el-form label-position="top">
                      <el-form-item label="记忆范围">
                        <el-segmented
                          v-model="memoryForm.scope"
                          :disabled="Boolean(editingMemoryId)"
                          :options="[
                            { label: '用户偏好', value: 'user_profile' },
                            { label: '当前 Agent', value: 'agent' },
                          ]"
                        />
                      </el-form-item>
                      <el-form-item label="记忆内容" required>
                        <el-input v-model="memoryForm.content" type="textarea" :rows="4" resize="vertical" placeholder="写入一条长期记忆" />
                      </el-form-item>
                      <el-form-item v-if="memoryForm.scope === 'agent'" label="记忆类型">
                        <el-select v-model="memoryForm.memoryType" style="width:100%">
                          <el-option v-for="item in memoryTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="重要性">
                        <el-segmented
                          v-model="memoryForm.importance"
                          :options="[
                            { label: '1', value: 1 },
                            { label: '2', value: 2 },
                            { label: '3', value: 3 },
                            { label: '4', value: 4 },
                            { label: '5', value: 5 },
                          ]"
                        />
                      </el-form-item>
                    </el-form>
                    <template #footer>
                      <el-button @click="showMemoryCreateDialog = false">取消</el-button>
                      <el-button
                        type="primary"
                        :loading="memorySaving"
                        :disabled="!memoryForm.content.trim() || (memoryForm.scope === 'agent' && !agentForm.id)"
                        @click="saveAgentMemory()"
                      >
                        {{ editingMemoryId ? '保存' : '写入' }}
                      </el-button>
                    </template>
                  </el-dialog>
                </div>
              </div>

              <div class="agent-actions">
                <el-button type="primary" :loading="agentSaving" @click="saveAgent()">保存能力配置</el-button>
              </div>

              <el-dialog v-model="showSkillCreateDialog" title="创建技能" width="600px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="名称" required>
                    <el-input v-model="skillForm.name" placeholder="技能名称" maxlength="80" />
                  </el-form-item>
                  <el-form-item label="分类">
                    <el-input v-model="skillForm.category" placeholder="例如 research / code / data" maxlength="64" />
                  </el-form-item>
                  <el-form-item label="描述">
                    <el-input v-model="skillForm.description" placeholder="简要描述这个技能的功能" maxlength="500" />
                  </el-form-item>
                  <el-form-item label="风险等级">
                    <el-segmented
                      v-model="skillForm.riskLevel"
                      :options="[
                        { label: '低风险', value: 'low' },
                        { label: '中风险', value: 'medium' },
                        { label: '高风险', value: 'high' },
                      ]"
                    />
                  </el-form-item>
                  <el-form-item label="能力说明" required>
                    <el-input v-model="skillForm.content" type="textarea" :rows="6" placeholder="详细说明技能能力、步骤约束、调用策略" />
                  </el-form-item>
                  <el-form-item label="示例输入">
                    <el-input v-model="skillForm.exampleInput" type="textarea" :rows="2" placeholder="示例输入内容" />
                  </el-form-item>
                  <el-form-item label="示例输出">
                    <el-input v-model="skillForm.exampleOutput" type="textarea" :rows="2" placeholder="示例输出内容" />
                  </el-form-item>
                </el-form>
                <template #footer>
                  <el-button @click="showSkillCreateDialog = false">取消</el-button>
                  <el-button type="primary" :loading="skillCreating" :disabled="!skillForm.name.trim() || !skillForm.content.trim()" @click="createSkillFromForm(); showSkillCreateDialog = false">
                    创建
                  </el-button>
                </template>
              </el-dialog>
            </el-card>

            <!-- ========== 协作 Tab ========== -->
            <el-card v-show="agentPageTab === 'collab'" class="agent-panel agent-collab-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>协作</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="info">团队 {{ agentTeams.length }}</el-tag>
                    <el-tag size="small" type="info">工作流 {{ workflows.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-collab-grid">
                <div class="agent-adv-section agent-team-section">
                  <div class="agent-section-title">
                    <span>团队协作</span>
                    <el-button size="small" type="primary" plain @click="openTeamCreateDialog()">创建团队</el-button>
                  </div>
                  <div class="agent-team-template-row">
                    <button
                      v-for="template in teamTemplates"
                      :key="template.id"
                      type="button"
                      class="agent-team-template"
                      @click="applyTeamTemplate(template.id); showTeamCreateDialog = true"
                    >
                      <strong>{{ template.name }}</strong>
                      <span>{{ template.description }}</span>
                    </button>
                  </div>
                  <div class="agent-team-runbar">
                    <el-select v-model="activeTeamId" placeholder="选择 Agent 团队" filterable>
                      <el-option v-for="team in agentTeams" :key="team.id" :label="team.name" :value="team.id" />
                    </el-select>
                    <el-input v-model="teamInput" type="textarea" :rows="1" resize="none" placeholder="团队输入" />
                    <el-button
                      type="primary"
                      :loading="teamRunning"
                      :disabled="!activeTeamId || !teamInput.trim()"
                      @click="runSelectedTeam()"
                    >
                      运行
                    </el-button>
                  </div>
                  <div class="agent-team-list">
                    <div v-for="team in agentTeams" :key="team.id" class="agent-team-chip">
                      <span>{{ team.name }}</span>
                      <el-tag size="small" type="info">{{ teamStrategyLabel(team.strategy) }}</el-tag>
                      <small>{{ team.members.length }} 个 Agent</small>
                    </div>
                  </div>
                  <div v-if="activeTeamRun" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>团队输出</span>
                      <el-tag size="small" :type="agentRunTagType(activeTeamRun.status)">{{ agentRunStatusLabel(activeTeamRun.status) }}</el-tag>
                    </div>
                    <div class="agent-resource-content">{{ activeTeamRun.output || activeTeamRun.error }}</div>
                    <div v-if="activeTeamRun.memberOutputs?.length" class="agent-team-run-timeline">
                      <div v-for="(member, index) in activeTeamRun.memberOutputs" :key="member.runId || index" class="agent-team-run-step">
                        <div class="agent-team-run-step-head">
                          <strong>{{ index + 1 }}. {{ member.role || agents.find((agent:any) => agent.id === member.agentId)?.name || member.agentId }}</strong>
                          <el-tag size="small" :type="agentRunTagType(member.status)">{{ agentRunStatusLabel(member.status) }}</el-tag>
                        </div>
                        <small>{{ agents.find((agent:any) => agent.id === member.agentId)?.name || member.agentId }} · Run {{ member.runId }}</small>
                        <div class="agent-resource-content compact">{{ member.output || member.error || '暂无输出' }}</div>
                      </div>
                    </div>
                  </div>
                  <el-empty v-if="agentTeams.length === 0" description="暂无 Agent 团队" :image-size="72" />
                </div>

                <el-dialog v-model="showTeamCreateDialog" title="创建团队" width="640px" :close-on-click-modal="false">
                  <el-form label-position="top">
                    <el-form-item label="团队名称">
                      <el-input v-model="teamForm.name" placeholder="例如：客服质检团队" maxlength="80" />
                    </el-form-item>
                    <el-form-item label="团队职责">
                      <el-input v-model="teamForm.description" type="textarea" :rows="3" resize="vertical" placeholder="描述这个团队负责的协作目标" maxlength="300" />
                    </el-form-item>
                    <el-form-item label="协作策略">
                      <el-segmented
                        v-model="teamForm.strategy"
                        :options="[
                          { label: '顺序', value: 'sequential' },
                          { label: '评审', value: 'review' },
                          { label: '辩论', value: 'debate' },
                          { label: '并行', value: 'parallel' },
                          { label: '共识', value: 'consensus' },
                          { label: '路由', value: 'router' },
                        ]"
                      />
                    </el-form-item>
                    <el-form-item label="协作 Agent">
                      <div class="agent-team-member-editor">
                        <div v-for="(member, index) in teamForm.members" :key="index" class="agent-team-member-row">
                          <el-select v-model="member.agentId" filterable placeholder="选择 Agent" style="width: 220px">
                            <el-option
                              v-for="agent in agents"
                              :key="agent.id"
                              :label="agent.name"
                              :value="agent.id"
                              :disabled="teamForm.members.some((item:any, itemIndex:number) => itemIndex !== index && item.agentId === agent.id)"
                            />
                          </el-select>
                          <el-input v-model="member.role" placeholder="角色，例如：质量评审 Agent" maxlength="80" />
                          <el-button text type="danger" @click="removeTeamFormMember(index)">移除</el-button>
                          <el-input
                            v-model="member.inputTemplate"
                            class="agent-team-template-input"
                            type="textarea"
                            :rows="3"
                            resize="vertical"
                            :placeholder="'输入模板，可用 {{originalInput}}、{{previousOutput}}、{{allOutputs}}、{{role}}'"
                          />
                        </div>
                        <el-button size="small" plain @click="addTeamFormMember()">添加成员</el-button>
                      </div>
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showTeamCreateDialog = false">取消</el-button>
                    <el-button
                      type="primary"
                      :loading="teamCreating"
                      :disabled="teamForm.members.filter((member:any) => member.agentId).length === 0 && !agentForm.id"
                      @click="createTeamFromForm()"
                    >
                      创建
                    </el-button>
                  </template>
                </el-dialog>
              </div>
            </el-card>

            <!-- ========== Workflow Tab ========== -->
            <el-card v-show="agentPageTab === 'workflow'" class="agent-panel agent-workflow-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>工作流</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="info">DAG {{ workflowCanvasNodes.length }}</el-tag>
                    <el-tag size="small" type="info">工作流 {{ workflows.length }}</el-tag>
                  </div>
                </div>
              </template>

                <div class="agent-adv-section dag-section">
                  <div class="dag-workbench-head">
                    <div>
                      <strong>DAG 编排</strong>
                      <span>{{ workflowCanvasNodes.length }} 个节点</span>
                    </div>
                    <div class="dag-actions">
                      <el-dropdown @command="(cmd: string) => applyWorkflowDagTemplate(dagTemplates.find(t => t.id === cmd))">
                        <el-button size="small" type="primary" plain>
                          模板 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item v-for="t in dagTemplates" :key="t.id" :command="t.id">
                              {{ t.icon }} {{ t.name }}
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                      <el-button size="small" @click="createDefaultWorkflow()">一键生成</el-button>
                      <el-button size="small" type="primary" :loading="workflowCanvasSaving" :disabled="workflowCanvasNodes.length === 0" @click="saveWorkflowCanvas()">
                        保存 DAG
                      </el-button>
                      <el-button size="small" @click="workflowCanvasNodes = []">清空</el-button>
                    </div>
                  </div>
                  <div v-if="workflowConnectingNode" class="dag-connection-status">
                    <span>正在从 {{ workflowConnectingNode.label }} 连线</span>
                    <el-button size="small" text type="primary" @click="workflowCanvasConnecting = ''">取消</el-button>
                  </div>
                  
                  <div class="dag-workbench">
                    <aside class="dag-node-palette">
                      <div class="dag-palette-title">节点库</div>
                      <el-scrollbar height="100%">
                        <div v-for="category in dagNodeCategories" :key="category.id" class="dag-category">
                          <div class="dag-category-title">
                            <span>{{ category.icon }}</span>
                            <span>{{ category.label }}</span>
                          </div>
                          <div class="dag-category-nodes">
                            <div
                              v-for="node in category.nodes"
                              :key="node.type"
                              class="dag-node-item"
                              draggable="true"
                              @dragstart="startDagNodeDrag(node)"
                            >
                              <span class="dag-node-icon">{{ node.icon }}</span>
                              <span class="dag-node-copy">
                                <strong>{{ node.label }}</strong>
                                <small>{{ node.description }}</small>
                              </span>
                            </div>
                          </div>
                        </div>
                      </el-scrollbar>
                    </aside>

                    <main class="dag-canvas-stage">
                      <div
                        class="dag-canvas"
                        @dragover.prevent
                        @drop.prevent="dropDagNode($event)"
                        @pointermove="dragWorkflowNode"
                        @pointerup="stopWorkflowNodeDrag"
                        @pointerleave="stopWorkflowNodeDrag"
                      >
                        <svg class="dag-canvas-lines" width="2400" height="1400" viewBox="0 0 2400 1400">
                          <defs>
                            <marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                              <path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />
                            </marker>
                          </defs>
                          <path
                            v-for="edge in workflowCanvasEdges"
                            :key="edge.id"
                            :d="edge.path"
                            marker-end="url(#dag-arrow)"
                          />
                        </svg>
                        <template v-if="workflowCanvasNodes.length">
                          <div
                            v-for="node in workflowCanvasNodes"
                            :key="node.id"
                            class="dag-canvas-node"
                            :class="{ 
                              connecting: workflowCanvasConnecting === node.id,
                              [`node-${getDagNodeInfo(node.type)?.category}`]: true
                            }"
                            :style="{ left: `${node.x}px`, top: `${node.y}px` }"
                            @pointerdown="startWorkflowNodeDrag(node, $event)"
                            @dblclick.stop="openDagNodeConfig(node)"
                          >
                            <div class="dag-node-head">
                              <span class="dag-node-icon">{{ getDagNodeInfo(node.type)?.icon || '📦' }}</span>
                              <strong>{{ node.name || getDagNodeInfo(node.type)?.label || node.type }}</strong>
                            </div>
                            <div class="dag-node-body">
                              <small>{{ getDagNodeInfo(node.type)?.description || '' }}</small>
                            </div>
                            <div class="dag-node-actions" @pointerdown.stop>
                              <el-button size="small" text @click="connectWorkflowNode(node.id)">
                                {{ workflowCanvasConnecting === node.id ? '取消' : workflowCanvasConnecting ? '设为目标' : '连线' }}
                              </el-button>
                              <el-button size="small" text @click="openDagNodeConfig(node)">配置/检查</el-button>
                              <el-button size="small" text type="danger" @click="removeWorkflowCanvasNode(node.id)">删除</el-button>
                            </div>
                          </div>
                        </template>
                        <div v-else class="dag-canvas-empty">
                          <el-icon size="48" color="#c0c4cc"><Plus /></el-icon>
                          <span>从左侧拖拽节点到这里</span>
                          <span class="dag-canvas-hint">或选择模板快速开始</span>
                        </div>
                      </div>
                    </main>
                  </div>

                  <div class="dag-runner">
                    <el-input v-model="workflowInput" type="textarea" :rows="2" resize="vertical" placeholder="DAG 测试输入" />
                    <el-button
                      type="primary"
                      :loading="workflowRunning"
                      :disabled="workflowCanvasNodes.length === 0 || !workflowInput.trim()"
                      @click="runSelectedWorkflow()"
                    >
                      运行 DAG
                    </el-button>
                  </div>

                  <div v-if="activeWorkflowRun" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <el-tag size="small" :type="agentRunTagType(activeWorkflowRun.status)">{{ agentRunStatusLabel(activeWorkflowRun.status) }}</el-tag>
                      <span>{{ activeWorkflowRun.steps.length }} 步</span>
                    </div>
                    <pre class="agent-step-meta">{{ activeWorkflowRun.output || activeWorkflowRun.error }}</pre>
                  </div>
                </div>

                <el-dialog v-model="dagNodeConfigVisible" title="节点配置与检查" width="860px" :close-on-click-modal="false">
                  <template v-if="activeDagNode">
                    <div class="dag-node-config-header">
                      <span class="config-node-icon">{{ getDagNodeInfo(activeDagNode.type)?.icon }}</span>
                      <div>
                        <strong>{{ getDagNodeInfo(activeDagNode.type)?.label }}</strong>
                        <p>{{ getDagNodeInfo(activeDagNode.type)?.description }}</p>
                      </div>
                    </div>
                    <el-divider />
                    <div class="dag-config-layout">
                      <el-form label-position="top" class="dag-config-form">
                        <el-form-item label="节点名称">
                          <el-input v-model="activeDagNode.name" placeholder="例如：判断问题类型" />
                          <div class="dag-field-help">给自己看的名字，会显示在画布节点上。</div>
                        </el-form-item>
                      
                      <template v-if="activeDagNode.type === 'intent_detection'">
                        <el-form-item label="使用模型">
                          <el-select v-model="dagNodeConfig.model" placeholder="选择模型" style="width:100%">
                            <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                          </el-select>
                          <div class="dag-field-help">用于判断用户输入属于哪个意图。建议选当前 Agent 使用的同类模型。</div>
                        </el-form-item>
                        <el-form-item label="意图分类列表">
                          <el-input v-model="dagNodeConfig.intentsStr" type="textarea" :rows="3" placeholder="售前咨询&#10;订单查询&#10;退款申请" />
                          <div class="dag-field-help">一行一个分类名，后续可以连接到分类/分支节点。</div>
                        </el-form-item>
                        <el-form-item label="置信度阈值">
                          <el-input-number v-model="dagNodeConfig.threshold" :min="0" :max="1" :step="0.1" :precision="1" style="width:100%" />
                          <div class="dag-field-help">越高越谨慎；不确定时可以先用 0.6。</div>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'parameter_extract'">
                        <el-form-item label="使用模型">
                          <el-select v-model="dagNodeConfig.model" placeholder="选择模型" style="width:100%">
                            <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                          </el-select>
                          <div class="dag-field-help">用于从文本里提取字段。</div>
                        </el-form-item>
                        <el-form-item label="要提取的字段">
                          <el-input v-model="dagNodeConfig.paramsText" type="textarea" :rows="3" placeholder="orderId&#10;phone&#10;dateRange" />
                          <div class="dag-field-help">一行一个字段名。建议用英文或拼音，便于后续节点引用。</div>
                        </el-form-item>
                        <el-form-item label="提取提示词">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="4" placeholder="请从以下文本提取字段，输出 JSON。如果没有找到，字段值为空字符串。&#10;文本：{{input}}" />
                          <div class="dag-field-help">写清楚输出格式，通常要求模型输出 JSON。</div>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'knowledge_search'">
                        <el-form-item label="选择知识库">
                          <el-select v-model="dagNodeConfig.kbIds" multiple placeholder="选择知识库" style="width:100%">
                            <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                          </el-select>
                          <div class="dag-field-help">至少选一个。没有知识库时，这个节点无法正常检索。</div>
                        </el-form-item>
                        <el-form-item label="Top K">
                          <el-input-number v-model="dagNodeConfig.topK" :min="1" :max="20" />
                        </el-form-item>
                        <el-form-item label="相似度阈值">
                          <el-input-number v-model="dagNodeConfig.threshold" :min="0" :max="1" :step="0.1" :precision="1" style="width:100%" />
                        </el-form-item>
                        <el-form-item label="启用 Rerank">
                          <el-switch v-model="dagNodeConfig.rerank" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'tool_call'">
                        <el-form-item label="选择工具">
                          <el-select v-model="dagNodeConfig.toolId" placeholder="选择工具" style="width:100%">
                            <el-option v-for="tool in [...availableTools, ...customTools]" :key="tool.id" :label="tool.displayName || tool.name" :value="tool.id" />
                          </el-select>
                          <div class="dag-field-help">比如文本统计、计算器、当前时间，或你自己创建的工具。</div>
                        </el-form-item>
                        <el-form-item label="入参映射 JSON">
                          <el-input v-model="dagNodeConfig.argsText" type="textarea" :rows="5" placeholder="{ &quot;text&quot;: &quot;{{input}}&quot; }" />
                          <div class="dag-field-help">必须是 JSON 对象。常用 {{input}} 代表上一节点结果。</div>
                        </el-form-item>
                        <el-form-item label="超时时间(秒)">
                          <el-input-number v-model="dagNodeConfig.timeout" :min="1" :max="300" />
                        </el-form-item>
                        <el-form-item label="重试次数">
                          <el-input-number v-model="dagNodeConfig.retries" :min="0" :max="5" />
                        </el-form-item>
                        <el-form-item label="需要用户确认">
                          <el-switch v-model="dagNodeConfig.confirm" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'skill_call'">
                        <el-form-item label="选择技能">
                          <el-select v-model="dagNodeConfig.skillId" placeholder="选择技能" style="width:100%">
                            <el-option v-for="skill in availableSkills" :key="skill.id" :label="skill.name" :value="skill.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="输入模板">
                          <el-input v-model="dagNodeConfig.input" type="textarea" :rows="4" placeholder="{{input}}" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'agent_call'">
                        <el-form-item label="选择 Agent">
                          <el-select v-model="dagNodeConfig.agentId" placeholder="选择 Agent" style="width:100%">
                            <el-option v-for="a in agents" :key="a.id" :label="a.name" :value="a.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="输入模板">
                          <el-input v-model="dagNodeConfig.input" type="textarea" :rows="4" placeholder="{{input}}" />
                        </el-form-item>
                        <el-form-item label="等待返回结果">
                          <el-switch v-model="dagNodeConfig.waitForResult" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'llm_generate'">
                        <el-form-item label="使用模型">
                          <el-select v-model="dagNodeConfig.model" placeholder="选择模型" style="width:100%">
                            <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="温度">
                          <el-input-number v-model="dagNodeConfig.temperature" :min="0" :max="2" :step="0.1" :precision="1" style="width:100%" />
                        </el-form-item>
                        <el-form-item label="最大 Token">
                          <el-input-number v-model="dagNodeConfig.maxTokens" :min="100" :max="8000" :step="100" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'prompt_builder'">
                        <el-form-item label="提示词模板">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="6" placeholder="使用 {{variable}} 作为变量占位符" />
                          <div class="dag-field-help">写给模型看的完整指令。用 {{input}} 引用上游内容。</div>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'template_transform'">
                        <el-form-item label="转换模板">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="6" placeholder="例如：处理后的内容：{{input}}" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'variable_assigner'">
                        <el-form-item label="变量定义 JSON">
                          <el-input v-model="dagNodeConfig.variablesText" type="textarea" :rows="7" placeholder="{ &quot;query&quot;: &quot;{{input}}&quot;, &quot;source&quot;: &quot;workflow&quot; }" />
                          <div class="dag-field-help">必须是 JSON 对象，值可以写固定文本或 {{input}}。</div>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'http_request'">
                        <el-form-item label="请求方法">
                          <el-select v-model="dagNodeConfig.method" style="width:100%">
                            <el-option label="GET" value="GET" />
                            <el-option label="POST" value="POST" />
                            <el-option label="PUT" value="PUT" />
                            <el-option label="PATCH" value="PATCH" />
                            <el-option label="DELETE" value="DELETE" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="请求地址">
                          <el-input v-model="dagNodeConfig.url" placeholder="https://api.example.com/search?q={{input}}" />
                          <div class="dag-field-help">必须以 http:// 或 https:// 开头。可以用 {{input}} 拼接上游输入。</div>
                        </el-form-item>
                        <el-form-item label="请求头 JSON">
                          <el-input v-model="dagNodeConfig.headersText" type="textarea" :rows="4" placeholder="{ &quot;Authorization&quot;: &quot;Bearer xxx&quot; }" />
                          <div class="dag-field-help">必须是 JSON 对象。没有请求头就填 {}。</div>
                        </el-form-item>
                        <el-form-item label="请求体模板">
                          <el-input v-model="dagNodeConfig.body" type="textarea" :rows="5" placeholder="{ &quot;query&quot;: &quot;{{input}}&quot; }" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'code'">
                        <el-form-item label="JavaScript 代码">
                          <el-input v-model="dagNodeConfig.code" type="textarea" :rows="8" placeholder="return input.input;" />
                          <div class="dag-field-help">需要 return 一个结果。可读取 input.input 或上游传入字段。</div>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'memory_read'">
                        <el-form-item label="记忆类型">
                          <el-select v-model="dagNodeConfig.memoryType" style="width:100%">
                            <el-option label="用户记忆" value="user" />
                            <el-option label="Agent 记忆" value="agent" />
                            <el-option label="项目记忆" value="project" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="返回数量">
                          <el-input-number v-model="dagNodeConfig.topK" :min="1" :max="20" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'condition' || activeDagNode.type === 'if_else'">
                        <el-form-item label="条件表达式">
                          <el-input v-model="dagNodeConfig.expression" placeholder="例如：订单、退款、{{input}} 中会匹配的关键词" />
                          <div class="dag-field-help">写一个关键词或判断说明；命中走 true，未命中走 false。</div>
                        </el-form-item>
                        <el-form-item label="命中分支输出模板">
                          <el-input v-model="dagNodeConfig.trueTemplate" type="textarea" :rows="4" placeholder="{{input}}" />
                        </el-form-item>
                        <el-form-item label="未命中分支输出模板">
                          <el-input v-model="dagNodeConfig.falseTemplate" type="textarea" :rows="4" placeholder="{{input}}" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'question_classifier' || activeDagNode.type === 'multi_branch'">
                        <el-form-item label="分类分支">
                          <el-input v-model="dagNodeConfig.branchesText" type="textarea" :rows="6" placeholder="售前咨询=价格&#10;订单查询=订单&#10;售后退款=退款" />
                          <div class="dag-field-help">一行一个分支，格式：分支名=关键词。关键词为空可当默认分支。</div>
                        </el-form-item>
                        <el-form-item label="分类提示词">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="4" placeholder="按分支关键词判断用户问题：{{input}}" />
                        </el-form-item>
                      </template>

                      <template v-if="['output', 'end', 'result_summary'].includes(activeDagNode.type)">
                        <el-form-item label="输出模板">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="5" placeholder="{{input}}" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'human_confirm'">
                        <el-form-item label="确认提示">
                          <el-input v-model="dagNodeConfig.message" type="textarea" :rows="2" placeholder="显示给用户的确认信息" />
                        </el-form-item>
                        <el-form-item label="超时时间(秒)">
                          <el-input-number v-model="dagNodeConfig.timeout" :min="30" :max="3600" />
                        </el-form-item>
                      </template>
                      </el-form>
                      <aside class="dag-config-guide">
                        <div class="dag-guide-card">
                          <span>什么时候用</span>
                          <p>{{ getDagNodeConfigGuide(activeDagNode.type).use }}</p>
                        </div>
                        <div class="dag-guide-card">
                          <span>怎么填</span>
                          <ul>
                            <li v-for="tip in getDagNodeConfigGuide(activeDagNode.type).tips" :key="tip">{{ tip }}</li>
                          </ul>
                        </div>
                        <div class="dag-guide-card">
                          <span>示例</span>
                          <pre>{{ getDagNodeConfigGuide(activeDagNode.type).example }}</pre>
                        </div>
                        <div class="dag-guide-card" :class="{ ok: dagNodeConfigErrors.length === 0, error: dagNodeConfigErrors.length > 0 }">
                          <span>配置检查</span>
                          <template v-if="dagNodeConfigErrors.length === 0">
                            <p>当前配置看起来可以保存。</p>
                          </template>
                          <ul v-else>
                            <li v-for="error in dagNodeConfigErrors" :key="error">{{ error }}</li>
                          </ul>
                        </div>
                      </aside>
                    </div>
                  </template>
                  <template #footer>
                    <el-button @click="dagNodeConfigVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveDagNodeConfig()">检查并保存</el-button>
                  </template>
                </el-dialog>
            </el-card>

            <!-- ========== 集成 Tab ========== -->
	            <el-card v-show="agentPageTab === 'integration'" class="agent-panel agent-integration-panel" shadow="never">
	              <template #header>
	                <div class="agent-panel-head">
	                  <span>集成</span>
	                  <div class="agent-head-tags">
	                    <el-tag size="small" type="info">MCP {{ mcpServers.length }}</el-tag>
	                  </div>
	                </div>
	              </template>

              <div class="agent-integration-grid">
                <div class="agent-adv-section">
                  <div class="agent-section-title">
                    <span>MCP 服务</span>
                    <el-button size="small" type="primary" plain @click="showMcpCreateDialog = true">添加 MCP</el-button>
                  </div>
                  <div v-for="server in mcpServers" :key="server.id" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>{{ server.name }}</span>
                      <el-tag size="small" :type="server.lastStatus === 'ok' ? 'success' : 'info'">{{ server.lastStatus }}</el-tag>
	                    </div>
	                    <div class="agent-resource-meta">{{ server.serverType }} · {{ server.enabled ? '已启用' : '已禁用' }}</div>
	                    <el-button size="small" text :loading="mcpTesting && activeMcpTestServerId === server.id" @click="openMcpTestDialog(server.id)">测试</el-button>
	                  </div>
	                  <el-empty v-if="mcpServers.length === 0" description="暂无 MCP 服务" :image-size="72" />
	                </div>
	              </div>
              <el-dialog v-model="showMcpCreateDialog" title="添加 MCP 服务" width="560px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="服务类型">
                    <el-select v-model="mcpForm.serverType" placeholder="选择 MCP 服务" style="width:100%">
                      <el-option v-for="option in mcpServerOptions" :key="option.value" :label="option.label" :value="option.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="显示名称">
                    <el-input v-model="mcpForm.name" placeholder="例如：Notion" maxlength="80" />
                  </el-form-item>
                  <el-form-item label="访问 Token">
                    <el-input
                      v-model="mcpForm.token"
                      type="password"
                      show-password
                      :placeholder="mcpServerOptions.find((option) => option.value === mcpForm.serverType)?.tokenPlaceholder || '访问 Token'"
                    />
                  </el-form-item>
                </el-form>
                <template #footer>
                  <el-button @click="showMcpCreateDialog = false">取消</el-button>
                  <el-button
                    type="primary"
                    :loading="mcpSaving"
                    :disabled="!mcpForm.serverType || !mcpForm.token.trim()"
                    @click="createMcpServerFromForm()"
                  >
                    保存
                  </el-button>
                </template>
              </el-dialog>
              <el-dialog v-model="showMcpTestDialog" title="测试 MCP 服务" width="520px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="测试查询">
                    <el-input v-model="mcpForm.query" type="textarea" :rows="3" resize="vertical" placeholder="留空则使用 test" maxlength="200" show-word-limit />
                  </el-form-item>
                </el-form>
                <template #footer>
                  <el-button @click="showMcpTestDialog = false; activeMcpTestServerId = ''">取消</el-button>
                  <el-button
                    type="primary"
                    :loading="mcpTesting"
                    :disabled="!activeMcpTestServerId"
                    @click="testMcpServer(activeMcpTestServerId)"
                  >
                    测试
                  </el-button>
                </template>
              </el-dialog>
	            </el-card>

            <!-- ========== 发布 Tab ========== -->
            <el-card v-show="agentPageTab === 'publish'" class="agent-panel agent-publish-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>发布</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" :type="agentForm.apiEnabled ? 'success' : 'info'">{{ agentForm.apiEnabled ? 'API 已开启' : 'API 未开启' }}</el-tag>
                    <el-tag size="small" :type="agentForm.published ? 'success' : 'info'">{{ agentForm.published ? '公开发布' : '私有' }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-publish-page">
                  <div class="agent-adv-section">
                    <div class="agent-section-title">发布与接入</div>
                    <div class="agent-publish-box">
                      <div class="agent-publish-row">
                        <div>
                          <strong>公开发布与 API 调用</strong>
                          <p>开启后可通过公开地址或 API Key 调用当前 Agent。</p>
                        </div>
                        <div class="agent-inline-actions">
                          <el-button
                            type="primary"
                            :loading="agentPublishing"
                            :disabled="!agentForm.id"
                            @click="saveAgentPublication()"
                          >
                            保存发布配置
                          </el-button>
                          <el-button
                            type="danger"
                            plain
                            :disabled="!agentForm.id"
                            @click="removeAgent(agentForm)"
                          >
                            删除 Agent
                          </el-button>
                        </div>
                      </div>
                      <div class="agent-form-grid">
                        <el-form label-position="top">
                          <el-form-item label="公开发布">
                            <el-switch v-model="agentForm.published" active-text="公开" inactive-text="私有" />
                          </el-form-item>
                        </el-form>
                        <el-form label-position="top">
                          <el-form-item label="API 接入">
                            <el-switch v-model="agentForm.apiEnabled" active-text="开启" inactive-text="关闭" />
                          </el-form-item>
                        </el-form>
                      </div>
                      <el-form label-position="top">
                        <el-form-item label="公开标识">
                          <el-input v-model="agentForm.publicSlug" maxlength="80" placeholder="例如 product-support-agent" />
                        </el-form-item>
                      </el-form>
                      <div class="agent-endpoint-list">
                        <el-input :model-value="agentPublicEndpoint" readonly placeholder="公开调用地址" />
                        <el-input :model-value="agentApiEndpoint" readonly placeholder="API Key 调用地址" />
                      </div>
                    </div>
                    <div class="agent-publish-box">
                      <div class="agent-publish-row">
                        <div>
                          <strong>版本发布流水线</strong>
                          <p>发布会固定当前版本快照；稳定发布接管全部流量，灰度发布只接管指定比例的公开/API 调用。</p>
                        </div>
                        <div class="agent-inline-actions">
                          <el-button :disabled="!agentForm.id" :loading="versionSaving" @click="openVersionPublishDialog(null, 'canary')">创建灰度发布</el-button>
                          <el-button type="success" :disabled="!agentForm.id" :loading="versionSaving" @click="openVersionPublishDialog(null, 'stable')">创建稳定发布</el-button>
                        </div>
                      </div>
                      <div class="agent-resource-stack">
                        <div v-for="version in agentVersions.filter((item) => ['released', 'canary'].includes(item.status))" :key="version.id" class="agent-resource-item">
                          <div class="agent-resource-title">
                            <span>v{{ version.versionNumber }} · {{ version.label }}</span>
                            <el-tag size="small" :type="agentVersionStatusType(version.status)">{{ agentVersionStatusLabel(version.status) }}</el-tag>
                          </div>
                          <div class="agent-resource-meta">
                            {{ version.status === 'canary' ? `灰度 ${version.trafficPercent}%` : '全部流量' }}
                            <template v-if="version.publishedAt"> · {{ formatAgentDate(version.publishedAt) }}</template>
                          </div>
                        </div>
                        <el-empty v-if="agentVersions.filter((item) => ['released', 'canary'].includes(item.status)).length === 0" description="暂无已发布版本" :image-size="64" />
                      </div>
                    </div>
                  </div>
              </div>
            </el-card>

            <!-- ========== 提示词 Tab ========== -->
            <el-card v-show="agentPageTab === 'prompt'" class="agent-panel agent-prompt-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>系统提示词</span>
                  <el-tag size="small" type="info">{{ agentForm.systemPrompt.length }} / 12000</el-tag>
                </div>
              </template>

              <div class="agent-prompt-editor">
                <div class="agent-helper-strip">定义角色、目标、输出格式、约束和安全边界。好的提示词能让 Agent 更稳定地完成任务。</div>
                <el-input
                  v-model="agentForm.systemPrompt"
                  type="textarea"
                  :rows="20"
                  resize="vertical"
                  maxlength="12000"
                  show-word-limit
                  placeholder="你是一个专业的客服助手...&#10;&#10;## 角色&#10;...&#10;&#10;## 目标&#10;...&#10;&#10;## 输出格式&#10;...&#10;&#10;## 约束&#10;..."
                />
                <div class="agent-actions">
                  <el-button type="primary" :loading="agentSaving" @click="saveAgent()">保存提示词</el-button>
                </div>
              </div>
            </el-card>

            <!-- ========== 工具 Tab ========== -->
            <el-card v-show="agentPageTab === 'tools'" class="agent-panel agent-tools-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>工具管理</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="success">内置 {{ availableTools.length }}</el-tag>
                    <el-tag size="small" type="primary">自定义 {{ customTools.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="tools-container">
                <div class="tools-header">
                  <el-input placeholder="搜索工具..." prefix-icon="Search" style="width: 300px" />
                  <el-button type="primary" @click="openToolCreateDialog()">
                    <el-icon><Plus /></el-icon> 创建工具
                  </el-button>
                </div>

                <el-tabs>
                  <el-tab-pane label="平台内置">
                    <div class="tool-grid">
                      <div v-for="tool in availableTools" :key="tool.id" class="tool-card">
                        <div class="tool-card-header">
                          <strong>{{ tool.displayName }}</strong>
                          <el-tag size="small" type="success">内置</el-tag>
                        </div>
                        <p class="tool-card-desc">{{ tool.description || '暂无描述' }}</p>
                        <div class="tool-card-meta">
                          <el-tag size="small">{{ tool.name }}</el-tag>
                        </div>
                        <div class="tool-card-actions">
                          <el-button size="small" text @click="previewTool(tool as any)">预览</el-button>
                          <el-button size="small" text type="primary">绑定</el-button>
                        </div>
                      </div>
                    </div>
                  </el-tab-pane>
                  <el-tab-pane label="自定义工具">
                    <div class="tool-grid">
                      <div v-for="tool in customTools" :key="tool.id" class="tool-card">
                        <div class="tool-card-header">
                          <strong>{{ tool.displayName }}</strong>
                          <div>
                            <el-tag size="small" :type="tool.riskLevel === 'high' ? 'danger' : tool.riskLevel === 'medium' ? 'warning' : 'success'">
                              {{ riskLevelLabel(tool.riskLevel) }}
                            </el-tag>
                            <el-tag size="small" :type="tool.status === 'enabled' ? 'success' : 'info'">
                              {{ tool.status === 'enabled' ? '启用' : '禁用' }}
                            </el-tag>
                          </div>
                        </div>
                        <p class="tool-card-desc">{{ tool.description || '暂无描述' }}</p>
                        <div class="tool-card-meta">
                          <el-tag size="small">{{ tool.runtime }}</el-tag>
                          <el-tag size="small" type="info">v{{ tool.version }}</el-tag>
                          <span class="tool-meta-text">调用 {{ tool.callCount }} 次</span>
                        </div>
                        <div class="tool-card-actions">
                          <el-button size="small" text @click="previewTool(tool)">预览</el-button>
                          <el-button size="small" text @click="openToolTest(tool)">测试</el-button>
                          <el-button size="small" text type="primary" @click="editTool(tool)">编辑</el-button>
                          <el-button size="small" text :type="tool.status === 'enabled' ? 'warning' : 'success'" @click="toggleToolStatus(tool)">
                            {{ tool.status === 'enabled' ? '禁用' : '启用' }}
                          </el-button>
                          <el-button size="small" text type="danger" @click="deleteTool(tool.id)">删除</el-button>
                        </div>
                      </div>
                      <el-empty v-if="customTools.length === 0" description="暂无自定义工具，点击上方按钮创建" :image-size="72" />
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </div>

              <!-- 工具创建/编辑对话框 -->
              <el-dialog v-model="toolCreateDialogVisible" :title="toolEditingId ? '编辑工具' : '创建工具'" width="700px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-row :gutter="16">
                    <el-col :span="12">
                      <el-form-item label="工具名称" required>
                        <el-input v-model="toolForm.name" placeholder="英文标识，如 weather_query" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="显示名称" required>
                        <el-input v-model="toolForm.displayName" placeholder="中文名称，如 天气查询" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-form-item label="描述">
                    <el-input v-model="toolForm.description" type="textarea" :rows="2" placeholder="工具功能描述" />
                  </el-form-item>
                  <el-row :gutter="16">
                    <el-col :span="8">
                      <el-form-item label="运行环境">
                        <el-select v-model="toolForm.runtime" style="width:100%">
                          <el-option label="Python" value="python" />
                          <el-option label="JavaScript" value="javascript" />
                          <el-option label="TypeScript" value="typescript" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="风险等级">
                        <el-select v-model="toolForm.riskLevel" style="width:100%">
                          <el-option label="低风险" value="low" />
                          <el-option label="中风险" value="medium" />
                          <el-option label="高风险" value="high" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="超时时间(秒)">
                        <el-input-number v-model="toolForm.timeout" :min="1" :max="300" style="width:100%" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-form-item label="工具代码">
                    <el-input v-model="toolForm.code" type="textarea" :rows="12" class="tool-code-editor" placeholder="def run(input, context): ..." />
                  </el-form-item>

                  <el-form-item label="权限声明">
                    <el-checkbox v-model="toolForm.permissions.network">网络访问</el-checkbox>
                    <el-checkbox v-model="toolForm.permissions.database">数据库访问</el-checkbox>
                    <el-checkbox v-model="toolForm.permissions.fileRead">文件读取</el-checkbox>
                    <el-checkbox v-model="toolForm.permissions.fileWrite">文件写入</el-checkbox>
                    <el-checkbox v-model="toolForm.permissions.externalRequest">外部请求</el-checkbox>
                  </el-form-item>

                  <el-row :gutter="16">
                    <el-col :span="12">
                      <el-form-item label="示例输入">
                        <el-input v-model="toolForm.exampleInput" type="textarea" :rows="3" placeholder='{"city": "北京"}' />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="示例输出">
                        <el-input v-model="toolForm.exampleOutput" type="textarea" :rows="3" placeholder='{"temperature": "25°C"}' />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </el-form>
                <template #footer>
                  <el-button @click="toolCreateDialogVisible = false">取消</el-button>
                  <el-button type="primary" :loading="toolCreating" @click="saveTool()">保存</el-button>
                </template>
              </el-dialog>

              <!-- 工具预览抽屉 -->
              <el-drawer v-model="toolPreviewVisible" title="工具预览" size="500px">
                <template v-if="activeTool">
                  <div class="tool-preview">
                    <div class="tool-preview-header">
                      <span class="tool-icon">{{ activeTool.icon }}</span>
                      <div>
                        <strong>{{ activeTool.displayName }}</strong>
                        <p>{{ activeTool.description }}</p>
                      </div>
                    </div>
                    <el-descriptions :column="2" border size="small">
                      <el-descriptions-item label="类型">{{ activeTool.type === 'builtin' ? '平台内置' : '自定义' }}</el-descriptions-item>
                      <el-descriptions-item label="运行环境">{{ activeTool.runtime }}</el-descriptions-item>
                      <el-descriptions-item label="风险等级">{{ riskLevelLabel(activeTool.riskLevel) }}</el-descriptions-item>
                      <el-descriptions-item label="版本">v{{ activeTool.version || '1' }}</el-descriptions-item>
                      <el-descriptions-item label="超时时间">{{ activeTool.timeout || 30 }}秒</el-descriptions-item>
                      <el-descriptions-item label="调用次数">{{ activeTool.callCount ?? 0 }}</el-descriptions-item>
                    </el-descriptions>
                    <div class="tool-config-section">
                      <div class="section-title">输入结构</div>
                      <pre class="agent-step-meta">{{ JSON.stringify(activeTool.inputSchema, null, 2) }}</pre>
                    </div>
                    <div class="tool-config-section">
                      <div class="section-title">输出结构</div>
                      <pre class="agent-step-meta">{{ JSON.stringify(activeTool.outputSchema, null, 2) }}</pre>
                    </div>
                    <div v-if="activeTool.code" class="tool-config-section">
                      <div class="section-title">执行代码</div>
                      <pre class="agent-step-meta tool-code-preview">{{ activeTool.code }}</pre>
                    </div>
                    <div class="tool-config-section">
                      <div class="section-title">权限声明</div>
                      <div>
                        <el-tag v-if="activeTool.permissions?.network" size="small" type="warning">网络访问</el-tag>
                        <el-tag v-if="activeTool.permissions?.database" size="small" type="warning">数据库</el-tag>
                        <el-tag v-if="activeTool.permissions?.fileRead" size="small" type="info">文件读取</el-tag>
                        <el-tag v-if="activeTool.permissions?.fileWrite" size="small" type="danger">文件写入</el-tag>
                        <el-tag v-if="activeTool.permissions?.externalRequest" size="small" type="warning">外部请求</el-tag>
                        <span v-if="!Object.values(activeTool.permissions || {}).some(Boolean)" style="color: #9ca3af; font-size: 12px;">无特殊权限声明</span>
                      </div>
                    </div>
                    <div v-if="activeTool.exampleInput" class="tool-config-section">
                      <div class="section-title">示例</div>
                      <div><strong>输入：</strong>{{ activeTool.exampleInput }}</div>
                      <div><strong>输出：</strong>{{ activeTool.exampleOutput }}</div>
                    </div>
                  </div>
                </template>
              </el-drawer>

              <!-- 工具测试对话框 -->
              <el-dialog v-model="toolTestVisible" title="工具测试" width="600px">
                <template v-if="activeTool">
                  <div style="margin-bottom: 16px;">
                    <strong>{{ activeTool.displayName }}</strong>
                    <el-tag size="small" style="margin-left: 8px;">{{ activeTool.runtime }}</el-tag>
                  </div>
                  <el-form-item label="测试输入 (JSON)">
                    <el-input v-model="toolTestInput" type="textarea" :rows="4" placeholder='{"key": "value"}' />
                  </el-form-item>
                  <el-button type="primary" :loading="toolTesting" @click="runToolTest()">运行测试</el-button>
                  
                  <div v-if="toolTestResult" style="margin-top: 16px;">
                    <el-divider />
                    <div style="margin-bottom: 8px;">
                      <el-tag :type="toolTestResult.success ? 'success' : 'danger'">
                        {{ toolTestResult.success ? '成功' : '失败' }}
                      </el-tag>
                      <el-tag type="info" style="margin-left: 8px;">{{ toolTestResult.duration }}ms</el-tag>
                    </div>
                    <div class="tool-config-section">
                      <div class="section-title">输出结果</div>
                      <pre class="agent-step-meta">{{ JSON.stringify(toolTestResult.output, null, 2) }}</pre>
                    </div>
                    <div v-if="toolTestResult.logs?.length" class="tool-config-section">
                      <div class="section-title">执行日志</div>
                      <div v-for="log in toolTestResult.logs" :key="log" class="log-line">{{ log }}</div>
                    </div>
                    <div v-if="toolTestResult.error" class="tool-config-section">
                      <div class="section-title">错误信息</div>
                      <pre class="agent-step-error">{{ toolTestResult.error }}</pre>
                    </div>
                  </div>
                </template>
              </el-dialog>
            </el-card>

            <!-- ========== 市场 Tab ========== -->
            <el-card v-show="agentPageTab === 'marketplace'" class="agent-panel agent-marketplace-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>市场</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="success">内置 {{ builtinAgents.length }}</el-tag>
                    <el-tag size="small" type="success">模板 {{ marketplaceTemplates.length }}</el-tag>
                    <el-tag size="small" type="primary">技能 {{ availableSkills.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="marketplace-container">
                <div class="marketplace-section">
                  <div class="marketplace-header">
                    <div class="marketplace-title">
                      <strong>Agent 模板市场</strong>
                      <span>从模板开始最快；已经调好的 Agent 可以发布成模板，之后一键复制出新的 Agent。</span>
                    </div>
                    <el-button
                      type="primary"
                      size="small"
                      :disabled="!agentForm.id"
                      @click="showMarketplacePublishDialog = true"
                    >
                      发布当前 Agent
                    </el-button>
                  </div>

                  <div class="marketplace-grid" style="margin-bottom:16px">
                    <div v-for="agent in builtinAgents" :key="agent.key" class="marketplace-card">
                      <div class="marketplace-card-header">
                        <strong>{{ agent.name }}</strong>
                        <el-tag size="small" type="success">内置</el-tag>
                      </div>
                      <p class="marketplace-card-desc">{{ agent.description }}</p>
                      <div class="marketplace-card-meta">
                        <el-tag size="small" type="info">{{ agent.category }}</el-tag>
                        <el-tag size="small" :type="agent.riskLevel === 'high' ? 'danger' : agent.riskLevel === 'medium' ? 'warning' : 'success'">
                          {{ riskLevelLabel(agent.riskLevel) }}
                        </el-tag>
                        <el-tag v-for="tag in agent.tags.slice(0, 3)" :key="tag" size="small" type="primary">{{ tag }}</el-tag>
                      </div>
                      <el-button type="primary" plain size="small" :loading="marketplaceInstalling" @click="installBuiltinAgentFromSpec(agent)">
                        复制为我的 Agent
                      </el-button>
                    </div>
                    <el-empty v-if="builtinAgents.length === 0" description="暂无内置 Agent" :image-size="72" />
                  </div>

                  <div class="marketplace-grid">
                    <div v-for="template in marketplaceTemplates" :key="template.id" class="marketplace-card">
                      <div class="marketplace-card-header">
                        <strong>{{ template.name }}</strong>
                        <el-tag size="small" type="info">{{ template.category }}</el-tag>
                      </div>
                      <p class="marketplace-card-desc">{{ template.description }}</p>
                      <div class="marketplace-card-meta">
                        <el-tag v-if="template.source === 'custom'" size="small" type="primary">我的模板</el-tag>
                        <el-tag v-for="tool in (template.toolNames || []).slice(0, 3)" :key="tool" size="small" type="warning">{{ tool }}</el-tag>
                        <el-tag v-for="skill in (template.skillNames || []).slice(0, 3)" :key="skill" size="small" type="success">{{ skill }}</el-tag>
                      </div>
                      <div class="agent-inline-actions">
                        <el-button type="primary" plain size="small" :loading="marketplaceInstalling" @click="installMarketplaceTemplate(template)">
                          安装模板
                        </el-button>
                        <el-button v-if="template.source === 'custom'" type="danger" plain size="small" @click="deleteMarketplaceTemplate(template)">
                          删除
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-if="marketplaceTemplates.length === 0" description="暂无模板" :image-size="72" />
                  </div>
                  <el-dialog v-model="showMarketplacePublishDialog" title="发布 Agent 模板" width="560px" :close-on-click-modal="false">
                    <el-form label-position="top">
                      <el-form-item label="模板名称">
                        <el-input v-model="marketplaceForm.name" placeholder="留空则使用当前 Agent 名称" maxlength="80" />
                      </el-form-item>
                      <el-form-item label="分类">
                        <el-select v-model="marketplaceForm.category" placeholder="选择分类，留空归入自定义" clearable filterable style="width:100%">
                          <el-option label="研究" value="research" />
                          <el-option label="代码" value="code" />
                          <el-option label="客服" value="support" />
                          <el-option label="运营" value="ops" />
                          <el-option label="数据" value="data" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="描述">
                        <el-input
                          v-model="marketplaceForm.description"
                          type="textarea"
                          :rows="4"
                          resize="vertical"
                          placeholder="一句话说明这个模板适合什么任务，留空则使用当前 Agent 描述"
                          maxlength="500"
                          show-word-limit
                        />
                      </el-form-item>
                    </el-form>
                    <template #footer>
                      <el-button @click="showMarketplacePublishDialog = false">取消</el-button>
                      <el-button type="primary" :loading="marketplacePublishing" @click="publishCurrentAgentToMarketplace()">发布</el-button>
                    </template>
                  </el-dialog>
                </div>

                <el-divider />

                <div class="marketplace-section">
                  <div class="marketplace-header">
                    <div class="marketplace-title">
                      <strong>技能能力包市场</strong>
                      <span>按完整度、绑定状态和风险快速挑选能力包，支持预览、测试、导出和绑定。</span>
                    </div>
                    <el-button size="small" @click="agentPageTab = 'capabilities'">
                      管理技能
                    </el-button>
                  </div>

                  <div class="skill-market-overview">
                    <div><span>总数</span><strong>{{ skillMarketStats.total }}</strong></div>
                    <div><span>内置</span><strong>{{ skillMarketStats.builtin }}</strong></div>
                    <div><span>自定义</span><strong>{{ skillMarketStats.custom }}</strong></div>
                    <div><span>已绑定</span><strong>{{ skillMarketStats.bound }}</strong></div>
                  </div>

                  <div class="skill-market-grid">
                    <div v-for="skill in skillMarketRows" :key="skill.id" class="skill-market-card enhanced" @click="previewSkill(skill)">
                      <div class="skill-market-card-header">
                        <strong>{{ skill.name }}</strong>
                        <div>
                          <el-tag v-if="skill.bound" size="small" type="success">已绑定</el-tag>
                          <el-tag size="small" :type="skill.source === 'builtin' ? 'success' : 'primary'">
                            {{ skill.source === 'builtin' ? '平台内置' : '自定义' }}
                          </el-tag>
                        </div>
                      </div>
                      <p class="skill-market-card-desc">{{ skill.description || skill.content?.slice(0, 100) || '暂无描述' }}</p>
                      <div class="skill-market-card-meta">
                        <el-tag size="small" :type="skillRiskTagType(skill.riskLevel)">{{ riskLevelLabel(skill.riskLevel) }}</el-tag>
                        <span class="skill-meta-text">{{ skill.category }} · v{{ skill.version }}</span>
                      </div>
                      <div class="skill-quality-bar">
                        <span :style="{ width: `${skill.qualityScore}%` }"></span>
                      </div>
                      <div class="skill-market-capabilities">
                        <el-tag size="small" :type="skill.exampleInput ? 'success' : 'info'">示例</el-tag>
                        <el-tag size="small" :type="skill.inputSchema ? 'success' : 'info'">输入结构</el-tag>
                        <el-tag size="small" :type="skill.outputSchema ? 'success' : 'info'">输出结构</el-tag>
                      </div>
                      <div class="skill-market-card-actions">
                        <el-button size="small" text type="primary" @click.stop="previewSkill(skill)">预览</el-button>
                        <el-button size="small" text @click.stop="previewSkill(skill); skillTestInput = skill.exampleInput || '请用真实任务测试这个技能。'">测试</el-button>
                        <el-button size="small" text @click.stop="exportSkillAsMarkdown(skill)">导出</el-button>
                        <el-button size="small" text type="success" @click.stop="bindSkillToCurrentAgent(skill)">绑定</el-button>
                      </div>
                    </div>
                    <el-empty v-if="skillMarketRows.length === 0" description="暂无技能" :image-size="72" />
                  </div>
                </div>
              </div>
            </el-card>
            </div>

            <div v-if="agentWorkspaceMode === 'invoke'" class="agent-page agent-mode-invoke">
              <el-card class="agent-panel agent-invoke-panel" shadow="never">
                <template #header>
                  <div class="agent-panel-head">
                    <span>Agent 调用</span>
                    <div class="agent-head-tags">
                      <el-tag size="small" :type="agentForm.apiEnabled ? 'success' : 'info'">{{ agentForm.apiEnabled ? 'API 已开启' : 'API 未开启' }}</el-tag>
                      <el-tag size="small" :type="agentForm.published ? 'success' : 'info'">{{ agentForm.published ? '公开发布' : '私有' }}</el-tag>
                    </div>
                  </div>
                </template>

                <div class="agent-invoke-console">
                  <section class="agent-invoke-statusbar">
                    <div class="agent-profile-top compact">
                      <el-avatar :size="32" class="agent-avatar" :style="{ backgroundColor: '#2563eb', lineHeight: '32px'}">
                  {{ agentForm.name ? agentForm.name.charAt(0).toUpperCase() : 'A' }}
                      </el-avatar>
                      <div>
                        <strong>{{ agentForm.name || '未命名 Agent' }}</strong>
                        <span>{{ agentForm.model || '未选择模型' }}</span>
                      </div>
                    </div>
                    <div class="agent-capability-strip compact">
                      <el-tag size="small" type="info">{{ agentForm.toolIds.length }} 工具</el-tag>
                      <el-tag size="small" type="info">{{ agentForm.knowledgeBaseIds.length }} KB</el-tag>
                      <el-tag size="small" type="info">{{ agentForm.skillIds.length }} 技能</el-tag>
                      <el-tag size="small" :type="agentForm.memoryEnabled ? 'success' : 'info'">记忆</el-tag>
                      <el-tag size="small" :type="agentConversationId ? 'success' : 'info'">连续会话</el-tag>
                    </div>
                  </section>

                  <main class="agent-invoke-main">
                    <section class="agent-compose-panel">
                      <div class="agent-compose-toolbar">
                        <div>
                          <div class="agent-section-title">即时调用</div>
                          <span>{{ agentForm.id ? `Agent ID: ${agentForm.id}` : '首次运行前会先保存 Agent' }}</span>
                        </div>
                        <div class="agent-compose-actions">
                          <el-button size="small" plain @click="fillAgentPromptExample()">示例</el-button>
                          <el-button size="small" plain :disabled="!agentPrompt && !agentImageUrlInput" @click="clearAgentPrompt()">清空</el-button>
                          <el-button size="small" plain :disabled="!agentLastPrompt && !activeAgentRun" @click="rerunLastAgentPrompt()">重跑</el-button>
                          <el-button v-if="agentRunning" size="small" type="danger" plain @click="stopCurrentAgentRun()">停止</el-button>
                        </div>
                      </div>
                      <el-input
                        v-model="agentPrompt"
                        class="agent-prompt-input"
                        type="textarea"
                        :rows="6"
                        resize="vertical"
                        placeholder="给这个 Agent 一个明确任务，例如：根据我们的产品手册，生成一份客服答复。"
                        :disabled="agentRunning"
                        @keydown.enter.exact.prevent="runCurrentAgent()"
                        @compositionstart="isComposing = true"
                        @compositionend="isComposing = false"
                      />
                      <div class="agent-multimodal-toggle">
                        <el-button size="small" plain @click="agentImageInputOpen = !agentImageInputOpen">
                          {{ agentImageInputOpen ? '收起多模态输入' : '添加图片 URL' }}
                        </el-button>
                        <span v-if="agentImageUrlInput.trim()">已填写图片输入</span>
                      </div>
                      <el-input
                        v-if="agentImageInputOpen"
                        v-model="agentImageUrlInput"
                        type="textarea"
                        :rows="2"
                        resize="vertical"
                        placeholder="可选：图片 URL，一行一个；使用视觉模型时会作为多模态输入"
                      />
                      <div class="agent-run-actions">
                        <div class="agent-run-config-summary">
                          <el-tag size="small" type="info">模型自主选择工具</el-tag>
                          <el-tag size="small" type="info">{{ agentInvokeMaxSteps }} 步</el-tag>
                        </div>
                        <div class="agent-run-primary-actions">
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
                    </section>

                    <section class="agent-output-panel">
                      <div class="agent-output-head">
                        <div>
                          <div class="agent-section-title">输出</div>
                          <div v-if="activeAgentRun" class="agent-run-meta">
                            <el-tag :type="agentRunTagType(activeAgentRun.status)">{{ agentRunStatusLabel(activeAgentRun.status) }}</el-tag>
                            <el-tag type="info">{{ activeAgentRun.model }}</el-tag>
                            <el-tag type="info">{{ activeAgentRun.totalTokens }} Token</el-tag>
                            <el-tag type="info">{{ activeAgentRun.latencyMs }} ms</el-tag>
                            <span>{{ formatAgentDate(activeAgentRun.createdAt) }}</span>
                          </div>
                        </div>
	                        <div class="agent-output-actions">
	                          <el-button size="small" plain :disabled="!activeAgentRun?.output" @click="copyActiveAgentOutput()">复制输出</el-button>
	                          <el-button size="small" type="primary" plain :disabled="!activeAgentRun" @click="showEvaluationDialog = true">评测</el-button>
	                        </div>
                      </div>
                      <el-alert
                        v-if="activeAgentRun?.error"
                        type="error"
                        :closable="false"
                        show-icon
                        :title="activeAgentRun.error"
                      />
                      <div v-if="activeAgentRun?.output" class="agent-output-render markdown-content" v-html="renderMarkdown(activeAgentRun.output)"></div>
                      <div v-if="activeAgentToolResultCards.length" class="agent-tool-results-panel">
                        <div class="agent-section-title">工具运行结果</div>
                        <div v-for="toolResult in activeAgentToolResultCards" :key="toolResult.id" class="agent-tool-result-card">
                          <div class="agent-resource-title">
                            <span>{{ toolResult.name }}</span>
                            <div class="agent-inline-actions">
                              <el-tag v-if="toolResult.deterministic" size="small" type="success">代码计算</el-tag>
                              <el-tag size="small" :type="agentRunTagType(toolResult.status)">{{ agentRunStatusLabel(toolResult.status) }}</el-tag>
                              <el-tag size="small" type="info">{{ toolResult.latencyMs }} ms</el-tag>
                            </div>
                          </div>
                          <div class="agent-tool-io-grid">
                            <div>
                              <span>输入</span>
                              <pre>{{ formatTraceDisplayValue(toolResult.input) }}</pre>
                            </div>
                            <div>
                              <span>输出</span>
                              <pre>{{ formatTraceDisplayValue(toolResult.output) }}</pre>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-if="!activeAgentRun?.output && !activeAgentToolResultCards.length" class="agent-output-empty">
                        <el-empty description="运行 Agent 后，这里会显示流式输出。" :image-size="96" />
                      </div>
                    </section>

                  </main>

                  <aside class="agent-invoke-inspector">
                    <div
                      class="agent-run-state-banner"
                      :class="activeAgentRun?.status || (agentRunning ? 'running' : 'idle')"
                    >
                      <div>
                        <span>运行状态</span>
                        <strong>{{ agentRunStatusLabel(activeAgentRun?.status || (agentRunning ? 'running' : 'idle')) }}</strong>
                      </div>
                      <div class="agent-run-state-meta">
                        <el-tag size="small" :type="agentRunTagType(activeAgentRun?.status || (agentRunning ? 'running' : ''))">
                          {{ activeAgentRun?.steps.length || 0 }} 步
                        </el-tag>
                        <el-tag size="small" type="info">{{ activeAgentRun?.latencyMs || 0 }} ms</el-tag>
                      </div>
                    </div>
                    <el-tabs v-model="agentInvokePanelTab" stretch>
                      <el-tab-pane label="追踪" name="trace">
                        <el-alert
                          v-if="activeAgentRun?.error"
                          type="error"
                          :closable="false"
                          show-icon
                          :title="activeAgentRun.error"
                        />
                        <div v-if="activeAgentRun" class="agent-diagnosis-section">
                          <strong>运行摘要</strong>
                          <div class="agent-diagnosis-tags">
                            <el-tag size="small" :type="agentFailedTraceSteps.length ? 'danger' : 'success'">失败 {{ agentFailedTraceSteps.length }}</el-tag>
                            <el-tag size="small" :type="agentSlowTraceSteps.length ? 'warning' : 'success'">慢步骤 {{ agentSlowTraceSteps.length }}</el-tag>
                            <el-tag size="small" type="info">知识 {{ agentContextSourceSummary.knowledge || 0 }}</el-tag>
                            <el-tag size="small" type="info">记忆 {{ agentContextSourceSummary.memory || 0 }}</el-tag>
                            <el-tag size="small" type="info">技能 {{ agentContextSourceSummary.skill || 0 }}</el-tag>
                          </div>
                        </div>
                        <div v-if="agentFailedTraceSteps.length" class="agent-diagnosis-section">
                          <strong>失败步骤</strong>
                          <button
                            v-for="step in agentFailedTraceSteps"
                            :key="`failed-${step.id}`"
                            type="button"
                            class="agent-diagnosis-step"
                            @click="selectAgentTraceStep(step.id)"
                          >
                            <span>{{ step.name }}</span>
                            <small>{{ agentStepTypeLabel(step.stepType) }} · {{ step.error || '失败' }}</small>
                          </button>
                        </div>
                        <div v-if="agentSlowTraceSteps.length" class="agent-diagnosis-section">
                          <strong>耗时异常</strong>
                          <button
                            v-for="step in agentSlowTraceSteps"
                            :key="`slow-${step.id}`"
                            type="button"
                            class="agent-diagnosis-step"
                            @click="selectAgentTraceStep(step.id)"
                          >
                            <span>{{ step.name }}</span>
                            <small>{{ agentStepTypeLabel(step.stepType) }} · {{ step.latencyMs }} ms</small>
                          </button>
                        </div>
                        <div v-if="agentImprovementSuggestions" class="agent-diagnosis-section">
                          <strong>优化建议</strong>
                          <p>{{ agentImprovementSuggestions.summary }}</p>
                          <div class="agent-suggestion-group">
                            <span>提示词</span>
                            <ul><li v-for="item in agentImprovementSuggestions.promptSuggestions" :key="item">{{ item }}</li></ul>
                          </div>
                          <div class="agent-suggestion-group">
                            <span>能力</span>
                            <ul><li v-for="item in agentImprovementSuggestions.capabilitySuggestions" :key="item">{{ item }}</li></ul>
                          </div>
                          <div class="agent-suggestion-group">
                            <span>测试</span>
                            <ul><li v-for="item in agentImprovementSuggestions.testSuggestions" :key="item">{{ item }}</li></ul>
                          </div>
                        </div>
                        <el-divider />
                        <div class="agent-trace-metrics">
                          <div>
                            <span>成本</span>
                            <strong>¥{{ agentHarnessMetrics.cost.toFixed(4) }}</strong>
                          </div>
                          <div>
                            <span>延迟</span>
                            <strong>{{ agentHarnessMetrics.latency }} ms</strong>
                          </div>
                          <div>
                            <span>成功率</span>
                            <strong>{{ agentHarnessMetrics.successRate }}%</strong>
                          </div>
                          <div>
                            <span>平均 Token</span>
                            <strong>{{ agentHarnessMetrics.averageTokens }}</strong>
                          </div>
                        </div>

                        <div class="execution-trace-flow">
                          <button
                            v-for="stage in agentExecutionTraceFlow"
                            :key="stage.id"
                            type="button"
                            class="execution-trace-node"
                            :class="[stage.status, { active: activeAgentTraceStep?.id === stage.step?.id, current: stage.current }]"
                            @click="stage.step && selectAgentTraceStep(stage.step.id)"
                          >
                            <span>{{ stage.label }}</span>
                            <strong>{{ stage.title }}</strong>
                            <small>{{ stage.latencyMs }} ms · {{ agentRunStatusLabel(stage.status) }}</small>
                            <em v-if="stage.current">当前阶段</em>
                            <p>{{ stage.detail }}</p>
                          </button>
                        </div>

                        <div class="agent-trace-controlbar compact debugger">
                          <el-button size="small" :disabled="!activeAgentRun?.steps.length" @click="pauseAgentTraceReplay()">暂停</el-button>
                          <el-button size="small" type="primary" plain :disabled="!activeAgentRun?.steps.length" @click="resumeAgentTraceReplay()">继续</el-button>
                          <el-button size="small" :disabled="!agentTraceDebuggerState.canStepInto" @click="stepIntoAgentTrace()">进入步骤</el-button>
                          <el-button size="small" :disabled="!agentTraceDebuggerState.canStepOver" @click="stepOverAgentTrace()">跳过步骤</el-button>
                          <el-button size="small" type="warning" plain :disabled="!agentTraceDebuggerState.canRestartFromNode" @click="restartAgentFromTraceNode()">从当前步骤重启</el-button>
                          <span>{{ agentTraceReplayIndex + 1 }} / {{ activeAgentRun?.steps.length || 1 }}</span>
                        </div>

                        <div class="agent-debug-grid">
                          <div v-if="agentTraceStageGroups.length" class="agent-stage-grid invoke">
                            <div v-for="stage in agentTraceStageGroups" :key="stage.id" class="agent-stage-column">
                              <div class="agent-stage-title">{{ stage.label }}</div>
                              <button
                                v-for="node in stage.nodes"
                                :key="node.id"
                                type="button"
                                class="trace-node"
                                :class="[node.status, { active: node.active }]"
                                @click="selectAgentTraceStep(Number(node.id))"
                              >
                                <span>{{ node.label }}</span>
                                <small>{{ agentStepTypeLabel(node.type) }} · {{ node.latencyMs }} ms</small>
                              </button>
                            </div>
                          </div>
                          <div class="agent-snapshot-panel">
                            <div class="agent-section-title">快照</div>
                            <el-descriptions :column="1" border size="small">
                              <el-descriptions-item label="模型">{{ agentTraceSnapshot.model || '-' }}</el-descriptions-item>
                              <el-descriptions-item label="参数">{{ JSON.stringify(agentTraceSnapshot.parameters) }}</el-descriptions-item>
                            </el-descriptions>
                            <div class="snapshot-block">
                              <strong>提示词</strong>
                              <pre>{{ agentTraceSnapshot.prompt || '无' }}</pre>
                            </div>
                            <div class="snapshot-block">
                              <strong>消息</strong>
                              <pre>{{ JSON.stringify(agentTraceSnapshot.messages, null, 2) }}</pre>
                            </div>
                            <div class="snapshot-block">
                              <strong>工具输入 / 输出</strong>
                              <div class="agent-tool-io-grid">
                                <div>
                                  <span>输入</span>
                                  <pre>{{ formatTraceDisplayValue(agentTraceSnapshot.toolInput) }}</pre>
                                </div>
                                <div>
                                  <span>输出</span>
                                  <pre>{{ formatTraceDisplayValue(agentTraceSnapshot.toolOutput) }}</pre>
                                </div>
                              </div>
                            </div>
                            <div class="snapshot-block">
                              <strong>记忆状态</strong>
                              <pre>{{ formatTraceDisplayValue(agentTraceSnapshot.memoryState) }}</pre>
                            </div>
                          </div>
                        </div>

                        <div class="comparative-replay-panel">
                          <div class="agent-section-title">对比回放</div>
                          <div class="replay-diff-grid">
                            <div>
                              <span>提示词差异</span>
                              <pre>{{ JSON.stringify(agentComparativeReplay.promptDiff, null, 2) }}</pre>
                            </div>
                            <div>
                              <span>模型差异</span>
                              <pre>{{ JSON.stringify(agentComparativeReplay.modelDiff, null, 2) }}</pre>
                            </div>
                            <div>
                              <span>技能差异</span>
                              <pre>{{ JSON.stringify(agentComparativeReplay.skillDiff, null, 2) }}</pre>
                            </div>
                            <div>
                              <span>工作流差异</span>
                              <pre>{{ JSON.stringify(agentComparativeReplay.workflowDiff, null, 2) }}</pre>
                            </div>
                          </div>
                        </div>

                        <div class="agent-step-inspector compact">
                          <div class="agent-section-title">步骤检查器</div>
                          <template v-if="activeAgentTraceStep">
                            <div class="agent-step-head">
                              <strong>{{ activeAgentTraceStep.name }}</strong>
                              <div>
                                <el-tag size="small" :type="agentRunTagType(activeAgentTraceStep.status)">{{ agentRunStatusLabel(activeAgentTraceStep.status) }}</el-tag>
                                <el-tag size="small" type="info">{{ agentStepTypeLabel(activeAgentTraceStep.stepType) }}</el-tag>
                              </div>
                            </div>
                            <div class="agent-step-meta-line">
                              <span>{{ formatAgentDate(activeAgentTraceStep.startedAt) }}</span>
                              <span>{{ activeAgentTraceStep.latencyMs }} ms</span>
                            </div>
                            <el-alert v-if="activeAgentTraceStep.error" type="error" :closable="false" show-icon :title="activeAgentTraceStep.error" />
                            <div class="agent-inspector-section">
                              <strong>输入</strong>
                              <pre class="agent-step-meta">{{ activeAgentTraceStep.input || '无' }}</pre>
                            </div>
                            <div class="agent-inspector-section">
                              <strong>输出</strong>
                              <pre class="agent-step-meta">{{ activeAgentTraceStep.output || '无' }}</pre>
                            </div>
                            <div v-if="formatStepMetadata(activeAgentTraceStep.metadata)" class="agent-inspector-section">
                              <strong>元数据</strong>
                              <pre class="agent-step-meta">{{ formatStepMetadata(activeAgentTraceStep.metadata) }}</pre>
                            </div>
                            <el-button size="small" plain @click="agentPrompt = activeAgentTraceStep.input">用此输入重跑</el-button>
                          </template>
                          <el-empty v-else description="暂无步骤" :image-size="72" />
                        </div>

                        <el-empty v-if="!agentTraceStageGroups.length" description="暂无追踪节点" :image-size="72" />
                      </el-tab-pane>

                      <el-tab-pane label="历史" name="history">
                        <div class="agent-history-toolbar">
                          <el-segmented
                            v-model="agentRunHistoryFilter"
                            :options="[
                              { label: '全部', value: 'all' },
                              { label: '成功', value: 'succeeded' },
                              { label: '失败', value: 'failed' },
                            ]"
                          />
                          <el-select v-model="agentRunHistorySort" size="small">
                            <el-option label="按时间" value="created" />
                            <el-option label="按耗时" value="latency" />
                            <el-option label="按 Token" value="tokens" />
                          </el-select>
                        </div>
                        <el-scrollbar class="agent-history-list compact">
                          <button
                            v-for="run in filteredAgentRuns"
                            :key="run.id"
                            type="button"
                            class="agent-history-item"
                            :class="[run.status, { active: activeAgentRun?.id === run.id }]"
                            @click="selectAgentRun(run)"
                          >
                            <span>{{ run.input || '空输入' }}</span>
                            <small>{{ run.totalTokens }} Token · {{ formatAgentDate(run.createdAt) }}</small>
                          </button>
                          <el-empty v-if="filteredAgentRuns.length === 0" description="暂无运行历史" :image-size="72" />
                        </el-scrollbar>
                      </el-tab-pane>

                    </el-tabs>
                  </aside>
                </div>
              </el-card>
            </div>

            <el-drawer v-model="skillPreviewOpen" size="520px" title="技能预览" :destroy-on-close="true">
              <template v-if="activeSkill">
                <div class="skill-preview">
                  <div class="skill-preview-header">
                    <strong>{{ activeSkill.name }}</strong>
                    <div>
                      <el-tag size="small" :type="activeSkill.source === 'builtin' ? 'success' : 'primary'">{{ activeSkill.source === 'builtin' ? '平台内置' : '自定义' }}</el-tag>
                      <el-tag size="small" :type="skillRiskTagType(activeSkill.riskLevel)">{{ riskLevelLabel(activeSkill.riskLevel) }}</el-tag>
                    </div>
                  </div>
                  <p>{{ activeSkill.description }}</p>
                  <el-descriptions :column="1" border size="small">
                    <el-descriptions-item label="分类">{{ activeSkill.category }}</el-descriptions-item>
                    <el-descriptions-item label="版本">v{{ activeSkill.version }}</el-descriptions-item>
                    <el-descriptions-item label="已绑定 Agent">{{ activeSkill.boundAgents?.map((agent) => agent.name).join('、') || '暂无' }}</el-descriptions-item>
                  </el-descriptions>
                  <div class="agent-resource-title">内部能力说明</div>
                  <pre class="agent-step-meta">{{ activeSkill.content }}</pre>
                  <div class="agent-resource-title">输入 / 输出结构</div>
                  <pre class="agent-step-meta">{{ JSON.stringify({ input: activeSkill.inputSchema, output: activeSkill.outputSchema }, null, 2) }}</pre>
                  <div class="agent-resource-title">示例</div>
                  <div class="agent-resource-item">
                    <strong>输入</strong>
                    <div class="agent-resource-content">{{ activeSkill.exampleInput || '暂无示例输入' }}</div>
                    <strong>输出</strong>
                    <div class="agent-resource-content">{{ activeSkill.exampleOutput || '暂无示例输出' }}</div>
                  </div>
                  <el-divider />
                  <div class="agent-resource-title">测试技能</div>
                  <el-input v-model="skillTestInput" type="textarea" :rows="4" resize="vertical" placeholder="填写测试输入" />
                  <el-button type="primary" :loading="skillTesting" @click="runActiveSkillTest()">运行技能</el-button>
                  <div v-if="activeSkillTestResult" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>运行结果</span>
                      <el-tag size="small" type="success">{{ activeSkillTestResult.latencyMs }} ms</el-tag>
                    </div>
                    <pre class="agent-step-meta">{{ activeSkillTestResult.output || activeSkillTestResult.error }}</pre>
                    <div class="agent-market-meta">
                      <el-tag size="small" type="info">Token {{ activeSkillTestResult.tokenUsage.totalTokens }}</el-tag>
                      <el-tag size="small" :type="activeSkillTestResult.knowledgeAccessed ? 'warning' : 'info'">RAG {{ activeSkillTestResult.knowledgeAccessed ? '声明访问' : '未访问' }}</el-tag>
                      <el-tag size="small" :type="activeSkillTestResult.toolCalls.length ? 'warning' : 'info'">工具 {{ activeSkillTestResult.toolCalls.length }}</el-tag>
                    </div>
                  </div>
                  <el-divider />
                  <div class="skill-preview-actions">
                    <el-button @click="exportSkillAsMarkdown(activeSkill)">导出 Markdown</el-button>
                    <el-button type="primary" @click="bindSkillToCurrentAgent(activeSkill)">绑定到当前 Agent</el-button>
                    <el-button @click="skillPreviewOpen = false">关闭</el-button>
                  </div>
                </div>
              </template>
              <el-empty v-else description="正在加载技能详情" :image-size="72" />
            </el-drawer>

            <el-dialog v-model="showAgentExportDialog" title="导出 Agent JSON 包" width="620px" :close-on-click-modal="false">
              <div class="agent-export-dialog">
                <div class="agent-export-summary">
                  <div>
                    <span>文件名</span>
                    <strong>{{ agentExportPreview.fileName }}</strong>
                  </div>
                  <div>
                    <span>模型</span>
                    <strong>{{ agentExportPreview.model }}</strong>
                  </div>
                  <div>
                    <span>随包导出</span>
                    <strong>{{ agentExportPreview.toolCount }} 工具 · {{ agentExportPreview.skillCount }} 技能</strong>
                  </div>
                  <div>
                    <span>工具代码</span>
                    <strong>{{ agentExportPreview.portableToolCount }} / {{ agentExportPreview.toolCount }} 个工具包含可移植实现</strong>
                  </div>
                  <div>
                    <span>长期记忆</span>
                    <strong>{{ agentExportPreview.memoryEnabled ? '配置开启，内容不导出' : '未开启' }}</strong>
                  </div>
                </div>
                <el-alert
                  type="warning"
                  :closable="false"
                  show-icon
                  title="这个 JSON 包用于跨平台迁移。Agent、工具、技能会内嵌导出且不包含 UUID；知识库原文、运行历史、评测记录和长期记忆不会导出。"
                />
              </div>
              <template #footer>
                <el-button @click="showAgentExportDialog = false">取消</el-button>
                <el-button @click="exportAgentAsMarkdown()">导出说明文档</el-button>
                <el-button type="primary" @click="confirmExportAgentBundle()">下载 JSON 包</el-button>
              </template>
            </el-dialog>

          </template>
        </div>
</template>
