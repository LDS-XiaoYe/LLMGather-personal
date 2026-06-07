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
const agentWorkspaceMode = bind(app, 'agentWorkspaceMode');
const agentPageTab = bind(app, 'agentPageTab');
const dagNodeCategories = bind(app, 'dagNodeCategories');
const dagTemplates = bind(app, 'dagTemplates');
const getDagNodeInfo = bind(app, 'getDagNodeInfo');
const applyWorkflowDagTemplate = bind(app, 'applyWorkflowDagTemplate');
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
const agentTestRuns = bind(app, 'agentTestRuns');
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
const showTestSuiteCreateDialog = bind(app, 'showTestSuiteCreateDialog');
const showTestCaseCreateDialog = bind(app, 'showTestCaseCreateDialog');
const showMarketplacePublishDialog = bind(app, 'showMarketplacePublishDialog');
const showVersionCreateDialog = bind(app, 'showVersionCreateDialog');
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
const testSaving = bind(app, 'testSaving');
const testRunning = bind(app, 'testRunning');
const marketplaceInstalling = bind(app, 'marketplaceInstalling');
const marketplacePublishing = bind(app, 'marketplacePublishing');
const workflowInput = bind(app, 'workflowInput');
const activeWorkflowRun = bind(app, 'activeWorkflowRun');
const activeTeamId = bind(app, 'activeTeamId');
const teamInput = bind(app, 'teamInput');
const activeTeamRun = bind(app, 'activeTeamRun');
const activeTestSuiteId = bind(app, 'activeTestSuiteId');
const activeTestRun = bind(app, 'activeTestRun');
const activeMcpTestServerId = bind(app, 'activeMcpTestServerId');
const agentEvaluations = bind(app, 'agentEvaluations');
const agentStats = bind(app, 'agentStats');
const agentEvaluationLoading = bind(app, 'agentEvaluationLoading');
const agentEvaluationSaving = bind(app, 'agentEvaluationSaving');
const evaluationForm = bind(app, 'evaluationForm');
const generatorForm = bind(app, 'generatorForm');
const agentCreateWizardStep = bind(app, 'agentCreateWizardStep');
const agentCreateWizardAdvancedOpen = bind(app, 'agentCreateWizardAdvancedOpen');
const selectedAgentTemplateId = bind(app, 'selectedAgentTemplateId');
const agentCreationGoal = bind(app, 'agentCreationGoal');
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
const agentForm = bind(app, 'agentForm');
const memoryForm = bind(app, 'memoryForm');
const editingMemoryId = bind(app, 'editingMemoryId');
const skillForm = bind(app, 'skillForm');
const teamForm = bind(app, 'teamForm');
const mcpForm = bind(app, 'mcpForm');
const mcpServerOptions = bind(app, 'mcpServerOptions');
const versionForm = bind(app, 'versionForm');
const testSuiteForm = bind(app, 'testSuiteForm');
const testCaseForm = bind(app, 'testCaseForm');
const marketplaceForm = bind(app, 'marketplaceForm');
const agentBuilderBlocks = bind(app, 'agentBuilderBlocks');
const agentBuilderCanvas = bind(app, 'agentBuilderCanvas');
const agentBuilderDragging = bind(app, 'agentBuilderDragging');
const activeBuilderBlock = bind(app, 'activeBuilderBlock');
const builderBlockConfigs = bind(app, 'builderBlockConfigs');
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
const nextAgentWizardStep = bind(app, 'nextAgentWizardStep');
const previousAgentWizardStep = bind(app, 'previousAgentWizardStep');
const saveAgentFromWizard = bind(app, 'saveAgentFromWizard');
const startAgentBuilderDrag = bind(app, 'startAgentBuilderDrag');
const startSkillBuilderDrag = bind(app, 'startSkillBuilderDrag');
const dropAgentBuilderBlock = bind(app, 'dropAgentBuilderBlock');
const removeAgentBuilderBlock = bind(app, 'removeAgentBuilderBlock');
const clearAgentBuilderCanvas = bind(app, 'clearAgentBuilderCanvas');
const saveAgentPublication = bind(app, 'saveAgentPublication');
const generateAgentFromRequirement = bind(app, 'generateAgentFromRequirement');
const installMarketplaceTemplate = bind(app, 'installMarketplaceTemplate');
const installBuiltinAgentFromSpec = bind(app, 'installBuiltinAgentFromSpec');
const publishCurrentAgentToMarketplace = bind(app, 'publishCurrentAgentToMarketplace');
const saveAgent = bind(app, 'saveAgent');
const runCurrentAgent = bind(app, 'runCurrentAgent');
const selectAgentRun = bind(app, 'selectAgentRun');
const openAgentRunTrace = bind(app, 'openAgentRunTrace');
const selectAgentTraceStep = bind(app, 'selectAgentTraceStep');
const setAgentTraceReplayIndex = bind(app, 'setAgentTraceReplayIndex');
const toggleAgentTraceReplay = bind(app, 'toggleAgentTraceReplay');
const agentRunTagType = bind(app, 'agentRunTagType');
const agentEvalTagType = bind(app, 'agentEvalTagType');
const evaluateActiveAgentRun = bind(app, 'evaluateActiveAgentRun');
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
const createDefaultWorkflow = bind(app, 'createDefaultWorkflow');
const createTeamFromForm = bind(app, 'createTeamFromForm');
const runSelectedTeam = bind(app, 'runSelectedTeam');
const createVersionFromForm = bind(app, 'createVersionFromForm');
const restoreVersion = bind(app, 'restoreVersion');
const createTestSuiteFromForm = bind(app, 'createTestSuiteFromForm');
const createTestCaseFromForm = bind(app, 'createTestCaseFromForm');
const runSelectedTestSuite = bind(app, 'runSelectedTestSuite');
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
                <el-button size="small" type="primary" plain :disabled="!agentForm.id" @click="exportAgentAsJson()">导出 JSON Bundle</el-button>
                <el-dropdown @command="(cmd: string) => cmd === 'md' ? exportAgentAsMarkdown() : exportAgentAsJson()">
                  <el-button size="small" :disabled="!agentForm.id">更多导出</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="json">导出 JSON Bundle</el-dropdown-item>
                      <el-dropdown-item command="md">导出说明文档</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
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
                    { label: '总览', value: 'overview' },
                    { label: '基础', value: 'basic' },
                    { label: '能力', value: 'capabilities' },
                    { label: '工具', value: 'tools' },
                    { label: 'Workflow', value: 'workflow' },
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
            <!-- ========== 总览 Tab ========== -->
            <el-card v-show="agentPageTab === 'overview'" class="agent-panel agent-overview-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 总览</span>
                  <div class="agent-head-tags">
                    <el-button size="small" type="primary" plain :disabled="!agentForm.id" @click="exportAgentAsJson()">导出 JSON Bundle</el-button>
                    <el-dropdown @command="(cmd: string) => cmd === 'md' ? exportAgentAsMarkdown() : exportAgentAsJson()">
                      <el-button size="small" :disabled="!agentForm.id">更多</el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="json">导出 JSON Bundle</el-dropdown-item>
                          <el-dropdown-item command="md">导出说明文档</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
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
                  <span>tokens</span>
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
                      <el-button size="small" text :loading="versionSaving" @click="restoreVersion(version.id)">恢复</el-button>
                    </div>
                    <div class="agent-resource-meta">{{ formatAgentDate(version.createdAt) }}</div>
                  </div>
                  <el-empty v-if="agentVersions.length === 0" description="暂无版本" :image-size="72" />
                </div>
                <el-dialog v-model="showVersionCreateDialog" title="创建版本快照" width="520px" :close-on-click-modal="false">
                  <el-form label-position="top">
                    <el-form-item label="版本标签">
                      <el-input v-model="versionForm.label" placeholder="例如 release-1，留空则自动生成" maxlength="120" />
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showVersionCreateDialog = false">取消</el-button>
                    <el-button type="primary" :loading="versionSaving" :disabled="!agentForm.id" @click="createVersionFromForm()">创建</el-button>
                  </template>
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
                          { label: 'Hybrid', value: 'hybrid' },
                          { label: 'Rules', value: 'rules' },
                          { label: 'LLM', value: 'llm' },
                        ]"
                      />
                    </el-form-item>
                    <el-form-item label="Judge 模型">
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
                  <span>基础配置</span>
                  <el-tag size="small" :type="agentForm.status === 'active' ? 'success' : 'info'">
                    {{ agentForm.status === 'active' ? 'Active' : 'Archived' }}
                  </el-tag>
                </div>
              </template>

              <div class="agent-create-console">
                <div class="agent-create-hero">
                  <div>
                    <div class="agent-section-title">新建 Agent 向导</div>
                    <p>从用途模板开始，补充目标和能力，保存后可以立即试运行。</p>
                  </div>
                  <el-steps :active="agentCreateWizardStep" simple finish-status="success">
                    <el-step title="模板" />
                    <el-step title="目标" />
                    <el-step title="能力" />
                    <el-step title="预览" />
                  </el-steps>
                </div>

                <div v-show="agentCreateWizardStep === 0" class="agent-template-grid">
                  <button
                    v-for="template in agentCreationTemplates"
                    :key="template.id"
                    type="button"
                    class="agent-template-card"
                    :class="{ active: selectedAgentTemplateId === template.id }"
                    @click="selectedAgentTemplateId = template.id; applyAgentTemplate(template.id)"
                  >
                    <span class="agent-template-icon">{{ template.name.slice(0, 1) }}</span>
                    <strong>{{ template.name }}</strong>
                    <small>{{ template.description }}</small>
                  </button>
                </div>

                <div v-show="agentCreateWizardStep === 1" class="agent-create-grid">
                  <div class="agent-create-main">
                    <div class="agent-section-title">描述目标</div>
                    <el-input
                      v-model="agentCreationGoal"
                      type="textarea"
                      :rows="5"
                      resize="vertical"
                      maxlength="1000"
                      show-word-limit
                      placeholder="这个 Agent 要帮你完成什么？例如：基于产品知识库回答客户问题，并在答案后给出处理建议。"
                    />
                    <div class="agent-generator-inline">
                      <el-input
                        v-model="generatorForm.requirement"
                        type="textarea"
                        :rows="3"
                        resize="vertical"
                        maxlength="4000"
                        placeholder="也可以一句话生成完整草稿。"
                      />
                      <el-button
                        type="primary"
                        plain
                        :loading="agentGenerating"
                        :disabled="!generatorForm.requirement.trim()"
                        @click="generateAgentFromRequirement()"
                      >
                        AI 生成草稿
                      </el-button>
                    </div>
                  </div>
                  <el-form label-position="top" class="agent-create-side">
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
                    <el-form-item label="描述">
                      <el-input v-model="agentForm.description" maxlength="500" show-word-limit placeholder="适合处理什么任务" />
                    </el-form-item>
                  </el-form>
                </div>

                <div v-show="agentCreateWizardStep === 2" class="agent-create-grid">
                  <div class="agent-create-main">
                    <div class="agent-section-title">选择能力</div>
                    <div class="agent-capability-picks">
                      <div>
                        <span>工具</span>
                        <el-select v-model="agentForm.toolIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择工具" style="width:100%">
                          <el-option v-for="tool in availableTools" :key="tool.id" :label="tool.displayName" :value="tool.id" />
                        </el-select>
                      </div>
                      <div>
                        <span>Skills</span>
                        <el-select v-model="agentForm.skillIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择 Skills" style="width:100%">
                          <el-option v-for="skill in availableSkills" :key="skill.id" :label="skill.name" :value="skill.id" />
                        </el-select>
                      </div>
                      <div>
                        <span>知识库</span>
                        <el-select v-model="agentForm.knowledgeBaseIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择知识库" style="width:100%">
                          <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                        </el-select>
                      </div>
                    </div>
                  </div>
                  <div class="agent-create-side">
                    <div class="agent-setting-row">
                      <span>长期记忆</span>
                      <el-switch v-model="agentForm.memoryEnabled" active-text="启用" inactive-text="关闭" />
                    </div>
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
                  </div>
                </div>

                <div v-show="agentCreateWizardStep === 3" class="agent-create-grid">
                  <div class="agent-create-main">
                    <div class="agent-section-title">配置预览</div>
                    <div class="agent-preview-card">
                      <div class="agent-preview-title">
                        <strong>{{ agentForm.name || '未命名 Agent' }}</strong>
                        <el-tag size="small" :type="agentForm.model ? 'success' : 'warning'">{{ agentForm.model || '未选模型' }}</el-tag>
                      </div>
                      <p>{{ agentForm.description || '暂无描述' }}</p>
                      <div class="agent-preview-tags">
                        <el-tag size="small">Tools {{ agentForm.toolIds.length }}</el-tag>
                        <el-tag size="small" type="success">Skills {{ agentForm.skillIds.length }}</el-tag>
                        <el-tag size="small" type="warning">RAG {{ agentForm.knowledgeBaseIds.length }}</el-tag>
                        <el-tag size="small" :type="agentForm.memoryEnabled ? 'primary' : 'info'">Memory {{ agentForm.memoryEnabled ? 'On' : 'Off' }}</el-tag>
                      </div>
                      <pre class="agent-step-meta">{{ agentForm.systemPrompt }}</pre>
                    </div>
                  </div>
                  <div class="agent-create-side">
                    <el-alert
                      type="info"
                      :closable="false"
                      title="默认导出和迁移会使用 JSON Bundle；运行历史、评测和记忆不会自动包含。"
                    />
                    <el-input
                      v-model="agentPrompt"
                      type="textarea"
                      :rows="4"
                      resize="vertical"
                      placeholder="保存后立即试运行的输入"
                    />
                  </div>
                </div>

                <div class="agent-create-actions">
                  <el-button @click="createAgentDraft" :icon="Plus">新草稿</el-button>
                  <el-button :disabled="agentCreateWizardStep === 0" @click="previousAgentWizardStep()">上一步</el-button>
                  <el-button v-if="agentCreateWizardStep < 3" type="primary" @click="nextAgentWizardStep()">下一步</el-button>
                  <template v-else>
                    <el-button type="primary" :loading="agentSaving" @click="saveAgentFromWizard(false)">保存 Agent</el-button>
                    <el-button type="success" :loading="agentSaving" @click="saveAgentFromWizard(true)">保存并试运行</el-button>
                  </template>
                </div>
              </div>

              <el-collapse v-model="agentCreateWizardAdvancedOpen" class="agent-advanced-builder">
                <el-collapse-item title="高级：组件 Builder 和完整提示词" name="builder">
                  <div class="agent-builder">
                    <div class="agent-builder-head">
                      <div class="builder-title">
                        <span>拖拽制作 Agent</span>
                      </div>
                      <div class="agent-builder-actions">
                        <el-button size="small" text @click="clearAgentBuilderCanvas()">清空</el-button>
                        <el-button size="small" type="primary" plain @click="applyBuilderConfigs()">应用组件配置</el-button>
                      </div>
                    </div>

                    <div class="agent-builder-body">
                      <div class="agent-builder-palette">
                        <div class="palette-section">
                          <div class="palette-section-title">组件</div>
                          <div class="palette-items">
                            <div
                              v-for="block in agentBuilderBlocks"
                              :key="block.type"
                              class="builder-block"
                              draggable="true"
                              @dragstart="startAgentBuilderDrag(block)"
                            >
                              <span class="block-icon">{{ block.icon }}</span>
                              <span class="block-name">{{ block.title }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        class="agent-builder-canvas"
                        :class="{ dragging: Boolean(agentBuilderDragging) }"
                        @dragover.prevent
                        @drop.prevent="dropAgentBuilderBlock()"
                      >
                        <template v-if="agentBuilderCanvas.length > 0">
                          <div class="canvas-header">
                            <span class="canvas-title">已选组件</span>
                            <span class="canvas-count">{{ agentBuilderCanvas.length }} 个</span>
                          </div>
                          <div class="canvas-items">
                            <div
                              v-for="block in agentBuilderCanvas"
                              :key="block.type"
                              class="canvas-item"
                              :class="{ expanded: activeBuilderBlock === block.type }"
                              @click="activeBuilderBlock = activeBuilderBlock === block.type ? null : block.type"
                            >
                              <div class="canvas-item-header">
                                <span class="item-icon">{{ block.icon }}</span>
                                <span class="item-name">{{ block.title }}</span>
                                <el-button size="small" text :icon="Delete" @click.stop="removeAgentBuilderBlock(block.type)" />
                              </div>
                            </div>
                          </div>
                        </template>
                        <div v-else class="canvas-empty">
                          <el-icon size="42" color="#c0c4cc"><Plus /></el-icon>
                          <span>拖拽组件到这里</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <el-form label-position="top" class="agent-form">
                    <el-form-item label="系统提示词">
                      <el-input v-model="agentForm.systemPrompt" type="textarea" :rows="8" resize="vertical" />
                    </el-form-item>
                  </el-form>
                </el-collapse-item>
              </el-collapse>
            </el-card>

            <!-- ========== 能力 Tab ========== -->
            <el-card v-show="agentPageTab === 'capabilities'" class="agent-panel agent-capabilities-panel" shadow="never">
              <template #header>
                <div class="agent-panel-head">
                  <span>Agent 能力</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="warning">Tools {{ agentForm.toolIds.length }}</el-tag>
                    <el-tag size="small" type="success">Skills {{ agentForm.skillIds.length }}</el-tag>
                    <el-tag size="small" type="primary">RAG {{ agentForm.knowledgeBaseIds.length }}</el-tag>
                  </div>
                </div>
              </template>

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
                  <div v-if="agentForm.toolIds.length" class="tool-permission-list">
                    <div v-for="toolId in agentForm.toolIds" :key="toolId" class="tool-permission-item">
                      <span>{{ availableTools.find((tool) => tool.id === toolId)?.displayName || toolId }}</span>
                      <el-segmented
                        v-model="agentForm.toolPermissions[toolId]"
                        :options="[
                          { label: '自动', value: 'auto' },
                          { label: '确认', value: 'confirm' },
                          { label: '禁用', value: 'disabled' },
                        ]"
                      />
                    </div>
                  </div>
                </div>

                <div class="agent-cap-section">
                  <div class="agent-section-title">
                    <span>Skills</span>
                    <el-button size="small" text type="primary" @click="showSkillCreateDialog = true">创建 Skill</el-button>
                  </div>
                  <div v-if="agentForm.skillIds.length" class="agent-bound-skill-list">
                    <div v-for="skillId in agentForm.skillIds" :key="skillId" class="agent-bound-skill-item">
                      <span>{{ availableSkills.find((skill) => skill.id === skillId)?.name || skillId }}</span>
                      <div>
                        <el-tag v-if="availableSkills.find((skill) => skill.id === skillId)" size="small" :type="skillRiskTagType(availableSkills.find((skill) => skill.id === skillId)!.riskLevel)">
                          {{ availableSkills.find((skill) => skill.id === skillId)!.riskLevel }}
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
                  <div v-for="memory in agentMemories" :key="memory.id" class="agent-resource-item">
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
                  <el-empty v-if="agentMemories.length === 0" description="暂无记忆" :image-size="72" />
                  <el-dialog
                    v-model="showMemoryCreateDialog"
                    :title="editingMemoryId ? '编辑长期记忆' : '写入长期记忆'"
                    width="560px"
                    :close-on-click-modal="false"
                    @closed="resetMemoryEditor()"
                  >
                    <el-form label-position="top">
                      <el-form-item label="记忆内容" required>
                        <el-input v-model="memoryForm.content" type="textarea" :rows="4" resize="vertical" placeholder="写入一条长期记忆" />
                      </el-form-item>
                      <el-form-item label="重要性">
                        <el-slider v-model="memoryForm.importance" :min="1" :max="5" :step="1" show-stops />
                      </el-form-item>
                    </el-form>
                    <template #footer>
                      <el-button @click="showMemoryCreateDialog = false">取消</el-button>
                      <el-button
                        type="primary"
                        :loading="memorySaving"
                        :disabled="!memoryForm.content.trim() || !agentForm.id"
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

              <el-dialog v-model="showSkillCreateDialog" title="创建 Skill" width="600px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="名称" required>
                    <el-input v-model="skillForm.name" placeholder="Skill 名称" maxlength="80" />
                  </el-form-item>
                  <el-form-item label="分类">
                    <el-input v-model="skillForm.category" placeholder="例如 research / code / data" maxlength="64" />
                  </el-form-item>
                  <el-form-item label="描述">
                    <el-input v-model="skillForm.description" placeholder="简要描述这个 Skill 的功能" maxlength="500" />
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
                    <el-input v-model="skillForm.content" type="textarea" :rows="6" placeholder="详细说明 Skill 的能力、步骤约束、调用策略" />
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
                    <el-tag size="small" type="info">Team {{ agentTeams.length }}</el-tag>
                    <el-tag size="small" type="info">Workflow {{ workflows.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-collab-grid">
                <div class="agent-adv-section agent-team-section">
                  <div class="agent-section-title">
                    <span>Team 协作</span>
                    <el-button size="small" type="primary" plain @click="showTeamCreateDialog = true">创建 Team</el-button>
                  </div>
                  <div class="agent-team-runbar">
                    <el-select v-model="activeTeamId" placeholder="选择 Agent Team" filterable>
                      <el-option v-for="team in agentTeams" :key="team.id" :label="team.name" :value="team.id" />
                    </el-select>
                    <el-input v-model="teamInput" type="textarea" :rows="1" resize="none" placeholder="Team 输入" />
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
                      <el-tag size="small" type="info">{{ team.strategy }}</el-tag>
                      <small>{{ team.members.length }} agents</small>
                    </div>
                  </div>
                  <div v-if="activeTeamRun" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>Team 输出</span>
                      <el-tag size="small" :type="agentRunTagType(activeTeamRun.status)">{{ activeTeamRun.status }}</el-tag>
                    </div>
                    <div class="agent-resource-content">{{ activeTeamRun.output || activeTeamRun.error }}</div>
                  </div>
                  <el-empty v-if="agentTeams.length === 0" description="暂无 Agent Team" :image-size="72" />
                </div>

                <el-dialog v-model="showTeamCreateDialog" title="创建 Team" width="640px" :close-on-click-modal="false">
                  <el-form label-position="top">
                    <el-form-item label="Team 名称">
                      <el-input v-model="teamForm.name" placeholder="例如：客服质检 Team" maxlength="80" />
                    </el-form-item>
                    <el-form-item label="团队职责">
                      <el-input v-model="teamForm.description" type="textarea" :rows="3" resize="vertical" placeholder="描述这个团队负责的协作目标" maxlength="300" />
                    </el-form-item>
                    <el-form-item label="协作策略">
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
                    </el-form-item>
                    <el-form-item label="协作 Agent">
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
                    </el-form-item>
                  </el-form>
                  <template #footer>
                    <el-button @click="showTeamCreateDialog = false">取消</el-button>
                    <el-button
                      type="primary"
                      :loading="teamCreating"
                      :disabled="!agentForm.id && teamForm.memberIds.length === 0"
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
                  <span>Workflow</span>
                  <div class="agent-head-tags">
                    <el-tag size="small" type="info">DAG {{ workflowCanvasNodes.length }}</el-tag>
                    <el-tag size="small" type="info">Workflow {{ workflows.length }}</el-tag>
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
                              <span class="dag-node-label">{{ node.label }}</span>
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
                          <line
                            v-for="edge in workflowCanvasEdges"
                            :key="edge.id"
                            :x1="edge.x1"
                            :y1="edge.y1"
                            :x2="edge.x2"
                            :y2="edge.y2"
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
                              <el-button size="small" text @click="openDagNodeConfig(node)">配置</el-button>
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
                      <el-tag size="small" :type="agentRunTagType(activeWorkflowRun.status)">{{ activeWorkflowRun.status }}</el-tag>
                      <span>{{ activeWorkflowRun.steps.length }} steps</span>
                    </div>
                    <pre class="agent-step-meta">{{ activeWorkflowRun.output || activeWorkflowRun.error }}</pre>
                  </div>
                </div>

                <el-dialog v-model="dagNodeConfigVisible" title="节点配置" width="600px" :close-on-click-modal="false">
                  <template v-if="activeDagNode">
                    <div class="dag-node-config-header">
                      <span class="config-node-icon">{{ getDagNodeInfo(activeDagNode.type)?.icon }}</span>
                      <div>
                        <strong>{{ getDagNodeInfo(activeDagNode.type)?.label }}</strong>
                        <p>{{ getDagNodeInfo(activeDagNode.type)?.description }}</p>
                      </div>
                    </div>
                    <el-divider />
                    <el-form label-position="top">
                      <el-form-item label="节点名称">
                        <el-input v-model="activeDagNode.name" placeholder="节点名称" />
                      </el-form-item>
                      
                      <template v-if="activeDagNode.type === 'intent_detection'">
                        <el-form-item label="使用模型">
                          <el-select v-model="dagNodeConfig.model" placeholder="选择模型" style="width:100%">
                            <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="意图分类列表">
                          <el-input v-model="dagNodeConfig.intentsStr" type="textarea" :rows="3" placeholder="每行一个意图" />
                        </el-form-item>
                        <el-form-item label="置信度阈值">
                          <el-slider v-model="dagNodeConfig.threshold" :min="0" :max="1" :step="0.1" show-input />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'knowledge_search'">
                        <el-form-item label="选择知识库">
                          <el-select v-model="dagNodeConfig.kbIds" multiple placeholder="选择知识库" style="width:100%">
                            <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="Top K">
                          <el-input-number v-model="dagNodeConfig.topK" :min="1" :max="20" />
                        </el-form-item>
                        <el-form-item label="相似度阈值">
                          <el-slider v-model="dagNodeConfig.threshold" :min="0" :max="1" :step="0.1" show-input />
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
                        <el-form-item label="选择 Skill">
                          <el-select v-model="dagNodeConfig.skillId" placeholder="选择 Skill" style="width:100%">
                            <el-option v-for="skill in availableSkills" :key="skill.id" :label="skill.name" :value="skill.id" />
                          </el-select>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'agent_call'">
                        <el-form-item label="选择 Agent">
                          <el-select v-model="dagNodeConfig.agentId" placeholder="选择 Agent" style="width:100%">
                            <el-option v-for="a in agents" :key="a.id" :label="a.name" :value="a.id" />
                          </el-select>
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'llm_generate'">
                        <el-form-item label="使用模型">
                          <el-select v-model="dagNodeConfig.model" placeholder="选择模型" style="width:100%">
                            <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                          </el-select>
                        </el-form-item>
                        <el-form-item label="Temperature">
                          <el-slider v-model="dagNodeConfig.temperature" :min="0" :max="2" :step="0.1" show-input />
                        </el-form-item>
                        <el-form-item label="Max Tokens">
                          <el-input-number v-model="dagNodeConfig.maxTokens" :min="100" :max="8000" :step="100" />
                        </el-form-item>
                      </template>

                      <template v-if="activeDagNode.type === 'prompt_builder'">
                        <el-form-item label="Prompt 模板">
                          <el-input v-model="dagNodeConfig.template" type="textarea" :rows="6" placeholder="使用 {{variable}} 作为变量占位符" />
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

                      <template v-if="activeDagNode.type === 'condition'">
                        <el-form-item label="条件表达式">
                          <el-input v-model="dagNodeConfig.expression" placeholder="例如: intent === 'order_query'" />
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
                  </template>
                  <template #footer>
                    <el-button @click="dagNodeConfigVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveDagNodeConfig()">保存配置</el-button>
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
                    <el-tag size="small" type="info">测试集 {{ agentTestSuites.length }}</el-tag>
                  </div>
                </div>
              </template>

              <div class="agent-integration-grid">
                <div class="agent-adv-section">
                  <div class="agent-section-title">
                    <span>MCP Server</span>
                    <el-button size="small" type="primary" plain @click="showMcpCreateDialog = true">添加 MCP</el-button>
                  </div>
                  <div v-for="server in mcpServers" :key="server.id" class="agent-resource-item">
                    <div class="agent-resource-title">
                      <span>{{ server.name }}</span>
                      <el-tag size="small" :type="server.lastStatus === 'ok' ? 'success' : 'info'">{{ server.lastStatus }}</el-tag>
                    </div>
                    <div class="agent-resource-meta">{{ server.serverType }} · {{ server.enabled ? 'enabled' : 'disabled' }}</div>
                    <el-button size="small" text :loading="mcpTesting && activeMcpTestServerId === server.id" @click="openMcpTestDialog(server.id)">测试</el-button>
                  </div>
                  <el-empty v-if="mcpServers.length === 0" description="暂无 MCP Server" :image-size="72" />
                </div>

                <div class="agent-adv-section">
                  <div class="agent-section-title">
                    <span>测试集</span>
                    <el-button size="small" type="primary" plain :disabled="!agentForm.id" @click="showTestSuiteCreateDialog = true">创建测试集</el-button>
                  </div>
                  <el-select v-model="activeTestSuiteId" placeholder="选择测试集" filterable style="width:100%">
                    <el-option v-for="suite in agentTestSuites" :key="suite.id" :label="`${suite.name} (${suite.caseCount})`" :value="suite.id" />
                  </el-select>
                  <div class="agent-test-eval-controls">
                    <el-segmented
                      v-model="evaluationForm.mode"
                      :options="[
                        { label: 'Hybrid', value: 'hybrid' },
                        { label: 'Rules', value: 'rules' },
                        { label: 'LLM', value: 'llm' },
                      ]"
                    />
                    <el-select v-model="evaluationForm.judgeModel" placeholder="Judge 模型" clearable filterable>
                      <el-option v-for="model in chatModels" :key="model.id" :label="model.id" :value="model.id" />
                    </el-select>
                  </div>
                  <div class="agent-run-actions">
                    <el-button
                      type="primary"
                      plain
                      :loading="testSaving"
                      :disabled="!activeTestSuiteId"
                      @click="showTestCaseCreateDialog = true"
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
                    <div class="agent-resource-title">回归结果</div>
                    <div class="agent-run-meta">
                      <el-tag size="small" :type="agentRunTagType(activeTestRun.status)">{{ activeTestRun.status }}</el-tag>
                      <el-tag size="small" type="info">平均 {{ activeTestRun.summary?.averageScore ?? 0 }}</el-tag>
                      <el-tag size="small" type="success">通过 {{ activeTestRun.summary?.passed ?? 0 }}</el-tag>
                      <el-tag size="small" type="danger">失败 {{ activeTestRun.summary?.failed ?? 0 }}</el-tag>
                    </div>
                    <div v-for="result in activeTestRun.caseResults || []" :key="`${activeTestRun.id}-${result.caseId}`" class="agent-test-result-row">
                      <span>{{ result.caseId }}</span>
                      <el-tag size="small" :type="agentEvalTagType(result.grade)">{{ result.score }}/100</el-tag>
                      <el-button size="small" text type="primary" @click="openAgentRunTrace(String(result.runId || ''))">Trace</el-button>
                    </div>
                  </div>
                  <div v-if="agentTestRuns.length > 0" class="agent-resource-item">
                    <div class="agent-resource-title">最近回归</div>
                    <div v-for="testRun in agentTestRuns" :key="testRun.id" class="agent-test-result-row">
                      <span>{{ formatAgentDate(testRun.createdAt) }}</span>
                      <el-tag size="small" :type="agentRunTagType(testRun.status)">{{ testRun.status }}</el-tag>
                      <span>{{ testRun.summary?.averageScore ?? 0 }}/100</span>
                    </div>
                  </div>
                  <div v-for="testCase in agentTestCases" :key="testCase.id" class="agent-resource-item">
                    <div class="agent-resource-title">{{ testCase.name }}</div>
                    <div class="agent-resource-content">{{ testCase.input }}</div>
                  </div>
                </div>

              </div>
              <el-dialog v-model="showMcpCreateDialog" title="添加 MCP Server" width="560px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="Server 类型">
                    <el-select v-model="mcpForm.serverType" placeholder="选择 MCP Server" style="width:100%">
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
              <el-dialog v-model="showMcpTestDialog" title="测试 MCP Server" width="520px" :close-on-click-modal="false">
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
              <el-dialog v-model="showTestSuiteCreateDialog" title="创建测试集" width="560px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="测试集名称">
                    <el-input v-model="testSuiteForm.name" placeholder="例如：客服回复回归集" maxlength="120" />
                  </el-form-item>
                  <el-form-item label="描述">
                    <el-input v-model="testSuiteForm.description" type="textarea" :rows="3" resize="vertical" placeholder="测试集覆盖范围" />
                  </el-form-item>
                </el-form>
                <template #footer>
                  <el-button @click="showTestSuiteCreateDialog = false">取消</el-button>
                  <el-button
                    type="primary"
                    :loading="testSaving"
                    :disabled="!agentForm.id || !testSuiteForm.name.trim()"
                    @click="createTestSuiteFromForm()"
                  >
                    创建
                  </el-button>
                </template>
              </el-dialog>
              <el-dialog v-model="showTestCaseCreateDialog" title="添加测试用例" width="640px" :close-on-click-modal="false">
                <el-form label-position="top">
                  <el-form-item label="用例名称">
                    <el-input v-model="testCaseForm.name" placeholder="例如：订单状态查询" maxlength="120" />
                  </el-form-item>
                  <el-form-item label="测试输入">
                    <el-input v-model="testCaseForm.input" type="textarea" :rows="3" resize="vertical" placeholder="输入给 Agent 的问题或任务" />
                  </el-form-item>
                  <el-form-item label="期望输出">
                    <el-input v-model="testCaseForm.expectedOutput" type="textarea" :rows="3" resize="vertical" placeholder="期望包含的回答或结果" />
                  </el-form-item>
                  <el-form-item label="评分 Rubric">
                    <el-input v-model="testCaseForm.rubric" type="textarea" :rows="3" resize="vertical" placeholder="可选：说明通过标准" />
                  </el-form-item>
                </el-form>
                <template #footer>
                  <el-button @click="showTestCaseCreateDialog = false">取消</el-button>
                  <el-button
                    type="primary"
                    :loading="testSaving"
                    :disabled="!activeTestSuiteId || !testCaseForm.name.trim() || !testCaseForm.input.trim()"
                    @click="createTestCaseFromForm()"
                  >
                    添加
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
                        <el-button
                          type="primary"
                          :loading="agentPublishing"
                          :disabled="!agentForm.id"
                          @click="saveAgentPublication()"
                        >
                          保存发布配置
                        </el-button>
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
                              {{ tool.riskLevel }}
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
                      <el-descriptions-item label="风险等级">{{ activeTool.riskLevel }}</el-descriptions-item>
                      <el-descriptions-item label="版本">v{{ activeTool.version }}</el-descriptions-item>
                      <el-descriptions-item label="超时时间">{{ activeTool.timeout }}秒</el-descriptions-item>
                      <el-descriptions-item label="调用次数">{{ activeTool.callCount }}</el-descriptions-item>
                    </el-descriptions>
                    <div class="tool-config-section">
                      <div class="section-title">输入 Schema</div>
                      <pre class="agent-step-meta">{{ JSON.stringify(activeTool.inputSchema, null, 2) }}</pre>
                    </div>
                    <div class="tool-config-section">
                      <div class="section-title">输出 Schema</div>
                      <pre class="agent-step-meta">{{ JSON.stringify(activeTool.outputSchema, null, 2) }}</pre>
                    </div>
                    <div class="tool-config-section">
                      <div class="section-title">权限声明</div>
                      <div>
                        <el-tag v-if="activeTool.permissions?.network" size="small" type="warning">网络访问</el-tag>
                        <el-tag v-if="activeTool.permissions?.database" size="small" type="warning">数据库</el-tag>
                        <el-tag v-if="activeTool.permissions?.fileRead" size="small" type="info">文件读取</el-tag>
                        <el-tag v-if="activeTool.permissions?.fileWrite" size="small" type="danger">文件写入</el-tag>
                        <el-tag v-if="activeTool.permissions?.externalRequest" size="small" type="warning">外部请求</el-tag>
                        <span v-if="!activeTool.permissions" style="color: #9ca3af; font-size: 12px;">无特殊权限声明</span>
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
                    <el-tag size="small" type="primary">Skills {{ availableSkills.length }}</el-tag>
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
                          {{ agent.riskLevel }}
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
                      <el-button type="primary" plain size="small" :loading="marketplaceInstalling" @click="installMarketplaceTemplate(template)">
                        安装模板
                      </el-button>
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
                      <strong>Skill 能力包市场</strong>
                      <span>浏览和使用预设的能力包，快速增强 Agent 能力。</span>
                    </div>
                    <el-button size="small" @click="agentPageTab = 'capabilities'">
                      管理 Skills
                    </el-button>
                  </div>

                  <div class="skill-market-grid">
                    <div v-for="skill in availableSkills" :key="skill.id" class="skill-market-card" @click="previewSkill(skill)">
                      <div class="skill-market-card-header">
                        <strong>{{ skill.name }}</strong>
                        <el-tag size="small" :type="skill.source === 'builtin' ? 'success' : 'primary'">
                          {{ skill.source === 'builtin' ? '平台内置' : '自定义' }}
                        </el-tag>
                      </div>
                      <p class="skill-market-card-desc">{{ skill.description || skill.content?.slice(0, 100) || '暂无描述' }}</p>
                      <div class="skill-market-card-meta">
                        <el-tag size="small" :type="skillRiskTagType(skill.riskLevel)">{{ skill.riskLevel }}</el-tag>
                        <span class="skill-meta-text">{{ skill.category }} · v{{ skill.version }}</span>
                      </div>
                      <div class="skill-market-card-actions">
                        <el-button size="small" text type="primary" @click.stop="previewSkill(skill)">预览</el-button>
                        <el-button size="small" text @click.stop="exportSkillAsMarkdown(skill)">导出</el-button>
                        <el-button size="small" text type="success" @click.stop="bindSkillToCurrentAgent(skill)">绑定</el-button>
                      </div>
                    </div>
                    <el-empty v-if="availableSkills.length === 0" description="暂无 Skills" :image-size="72" />
                  </div>
                </div>
              </div>



              <el-drawer v-model="skillPreviewOpen" size="520px" title="Skill 预览" :destroy-on-close="true">
                <template v-if="activeSkill">
                  <div class="skill-preview">
                    <div class="skill-preview-header">
                      <strong>{{ activeSkill.name }}</strong>
                      <div>
                        <el-tag size="small" :type="activeSkill.source === 'builtin' ? 'success' : 'primary'">{{ activeSkill.source === 'builtin' ? '平台内置' : '自定义' }}</el-tag>
                        <el-tag size="small" :type="skillRiskTagType(activeSkill.riskLevel)">{{ activeSkill.riskLevel }}</el-tag>
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
                    <div class="agent-resource-title">输入 / 输出 Schema</div>
                    <pre class="agent-step-meta">{{ JSON.stringify({ input: activeSkill.inputSchema, output: activeSkill.outputSchema }, null, 2) }}</pre>
                    <div class="agent-resource-title">示例</div>
                    <div class="agent-resource-item">
                      <strong>输入</strong>
                      <div class="agent-resource-content">{{ activeSkill.exampleInput || '暂无示例输入' }}</div>
                      <strong>输出</strong>
                      <div class="agent-resource-content">{{ activeSkill.exampleOutput || '暂无示例输出' }}</div>
                    </div>
                    <el-divider />
                    <div class="agent-resource-title">测试 Skill</div>
                    <el-input v-model="skillTestInput" type="textarea" :rows="4" resize="vertical" placeholder="填写测试输入" />
                    <el-button type="primary" :loading="skillTesting" @click="runActiveSkillTest()">运行 Skill</el-button>
                    <div v-if="activeSkillTestResult" class="agent-resource-item">
                      <div class="agent-resource-title">
                        <span>运行结果</span>
                        <el-tag size="small" type="success">{{ activeSkillTestResult.latencyMs }} ms</el-tag>
                      </div>
                      <pre class="agent-step-meta">{{ activeSkillTestResult.output || activeSkillTestResult.error }}</pre>
                      <div class="agent-market-meta">
                        <el-tag size="small" type="info">tokens {{ activeSkillTestResult.tokenUsage.totalTokens }}</el-tag>
                        <el-tag size="small" :type="activeSkillTestResult.knowledgeAccessed ? 'warning' : 'info'">RAG {{ activeSkillTestResult.knowledgeAccessed ? '声明访问' : '未访问' }}</el-tag>
                        <el-tag size="small" :type="activeSkillTestResult.toolCalls.length ? 'warning' : 'info'">Tools {{ activeSkillTestResult.toolCalls.length }}</el-tag>
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
              </el-drawer>
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

                <div class="agent-integration-grid">
                  <div class="agent-adv-section">
                    <div class="agent-section-title">即时调用</div>
                    <div class="agent-overview-section">
                      <div class="agent-section-title">运行测试</div>
                      <div class="agent-run-box">
                        <el-input
                          v-model="agentPrompt"
                          type="textarea"
                          :rows="4"
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
                        <div class="agent-observe-panel agent-observe-console">
                          <div class="agent-observe-topbar">
                            <div>
                              <div class="agent-section-title">Trace Observability</div>
                              <span>{{ activeAgentRun.steps.length }} steps · {{ formatAgentDate(activeAgentRun.createdAt) }}</span>
                            </div>
                            <div class="agent-observe-kpis">
                              <div><strong>{{ activeAgentRun.latencyMs || 0 }}</strong><span>ms</span></div>
                              <div><strong>{{ activeAgentRun.totalTokens || 0 }}</strong><span>tokens</span></div>
                              <div><strong>{{ activeAgentRun.model }}</strong><span>model</span></div>
                            </div>
                          </div>

                          <div class="agent-trace-controlbar">
                            <el-button size="small" type="primary" plain :disabled="!activeAgentRun.steps.length" @click="toggleAgentTraceReplay()">
                              {{ agentTraceReplayPlaying ? '暂停' : '播放' }}
                            </el-button>
                            <el-slider
                              class="agent-trace-slider"
                              :model-value="agentTraceReplayIndex"
                              :min="0"
                              :max="agentTraceReplayMax"
                              :step="1"
                              :show-tooltip="false"
                              @update:model-value="setAgentTraceReplayIndex"
                            />
                            <span>{{ agentTraceReplayIndex + 1 }} / {{ activeAgentRun.steps.length || 1 }}</span>
                          </div>

                          <div class="agent-observe-grid">
                            <aside class="agent-observe-history">
                              <div class="agent-section-title">运行历史</div>
                              <el-scrollbar class="agent-history-list">
                                <button
                                  v-for="run in agentRuns"
                                  :key="run.id"
                                  type="button"
                                  class="agent-history-item"
                                  :class="[run.status, { active: activeAgentRun?.id === run.id }]"
                                  @click="selectAgentRun(run)"
                                >
                                  <span>{{ run.input || '空输入' }}</span>
                                  <small>{{ run.totalTokens }} tokens · {{ formatAgentDate(run.createdAt) }}</small>
                                </button>
                                <el-empty v-if="agentRuns.length === 0" description="暂无运行历史" :image-size="72" />
                              </el-scrollbar>
                            </aside>

                            <main class="agent-observe-graph">
                              <section class="agent-observe-output">
                                <div class="agent-section-title">输出预览</div>
                                <div v-if="activeAgentRun.output" class="markdown-content" v-html="renderMarkdown(activeAgentRun.output)"></div>
                                <div v-else class="agent-placeholder">流式输出会显示在这里</div>
                              </section>

                              <section class="agent-trace-map">
                                <div class="agent-section-title">Trace DAG</div>
                                <div v-if="agentTraceStageGroups.length" class="agent-stage-grid">
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
                                      <small>{{ node.type }} · {{ node.latencyMs }} ms</small>
                                    </button>
                                  </div>
                                </div>
                                <el-empty v-else description="暂无 Trace 节点" :image-size="72" />
                              </section>

                              <section class="agent-waterfall">
                                <div class="agent-section-title">耗时瀑布</div>
                                <div v-for="node in agentTraceNodes" :key="`bar-${node.id}`" class="waterfall-row">
                                  <span>{{ node.label }}</span>
                                  <div class="waterfall-track">
                                    <div class="waterfall-bar" :class="node.status" :style="{ width: `${Math.min(100, Math.max(6, (node.latencyMs / agentTraceLatencyMax) * 100))}%` }"></div>
                                  </div>
                                  <small>{{ node.latencyMs }} ms</small>
                                </div>
                              </section>
                            </main>

                            <aside class="agent-step-inspector">
                              <div class="agent-section-title">Step Inspector</div>
                              <template v-if="activeAgentTraceStep">
                                <div class="agent-step-head">
                                  <strong>{{ activeAgentTraceStep.name }}</strong>
                                  <div>
                                    <el-tag size="small" :type="agentRunTagType(activeAgentTraceStep.status)">{{ activeAgentTraceStep.status }}</el-tag>
                                    <el-tag size="small" type="info">{{ activeAgentTraceStep.stepType }}</el-tag>
                                  </div>
                                </div>
                                <el-alert v-if="activeAgentTraceStep.error" type="error" :closable="false" show-icon :title="activeAgentTraceStep.error" />
                                <div class="agent-step-meta-line">
                                  <span>{{ formatAgentDate(activeAgentTraceStep.startedAt) }}</span>
                                  <span>{{ activeAgentTraceStep.latencyMs }} ms</span>
                                </div>
                                <div class="agent-inspector-section">
                                  <strong>Input</strong>
                                  <pre class="agent-step-meta">{{ activeAgentTraceStep.input || '无' }}</pre>
                                </div>
                                <div class="agent-inspector-section">
                                  <strong>Output</strong>
                                  <pre class="agent-step-meta">{{ activeAgentTraceStep.output || '无' }}</pre>
                                </div>
                                <div v-if="formatStepMetadata(activeAgentTraceStep.metadata)" class="agent-inspector-section">
                                  <strong>Metadata</strong>
                                  <pre class="agent-step-meta">{{ formatStepMetadata(activeAgentTraceStep.metadata) }}</pre>
                                </div>
                                <el-button size="small" text @click="agentPrompt = activeAgentTraceStep.input">用此输入重跑</el-button>
                              </template>
                              <el-empty v-else description="暂无 Step" :image-size="72" />
                            </aside>
                          </div>
                        </div>
                      </div>
                      <el-empty v-else description="保存并运行 Agent 后，这里会显示输出和执行链路。" :image-size="96" />
                    </div>
                  </div>




                  <div class="agent-adv-section">
                    <div class="agent-section-title">接口示例</div>
                    <div class="agent-resource-item">
                      <div class="agent-resource-title">API Key 调用</div>
                      <div class="api-endpoint">POST /v1/agents/:id/invoke</div>
                      <pre class="api-code-block">curl {{ agentApiEndpoint }} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{"input":"请根据知识库回答客户问题","messages":[]}'</pre>
                    </div>
                    <div class="agent-resource-item">
                      <div class="agent-resource-title">公开调用</div>
                      <div class="api-endpoint">POST /v1/public/agents/:slug/runs</div>
                      <pre class="api-code-block">curl {{ agentPublicEndpoint }} \
  -H "Content-Type: application/json" \
  -d '{"input":"公开调用这个 Agent"}'</pre>
                    </div>
                    <el-button size="small" type="primary" plain @click="switchPage('api')">查看完整 API 用法</el-button>
                  </div>
                </div>
              </el-card>
            </div>

            <el-dialog v-model="showAgentExportDialog" title="导出 Agent JSON Bundle" width="620px" :close-on-click-modal="false">
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
                    <strong>{{ agentExportPreview.toolCount }} Tools · {{ agentExportPreview.skillCount }} Skills</strong>
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
                  title="这个 JSON Bundle 用于跨平台迁移。Agent、Tools、Skills 会内嵌导出且不包含 UUID；知识库原文、运行历史、评测记录和长期记忆不会导出。"
                />
              </div>
              <template #footer>
                <el-button @click="showAgentExportDialog = false">取消</el-button>
                <el-button @click="exportAgentAsMarkdown()">导出说明文档</el-button>
                <el-button type="primary" @click="confirmExportAgentBundle()">下载 JSON Bundle</el-button>
              </template>
            </el-dialog>

          </template>
        </div>
</template>
