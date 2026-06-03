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
const Document = bind(app, 'Document');
const Plus = bind(app, 'Plus');
const Refresh = bind(app, 'Refresh');
const SwitchButton = bind(app, 'SwitchButton');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const agents = bind(app, 'agents');
const activeAgentId = bind(app, 'activeAgentId');
const agentSaving = bind(app, 'agentSaving');
const knowledgeBases = bind(app, 'knowledgeBases');
const agentResourceLoading = bind(app, 'agentResourceLoading');
const knowledgeCreating = bind(app, 'knowledgeCreating');
const knowledgeDocSaving = bind(app, 'knowledgeDocSaving');
const knowledgeFileParsing = bind(app, 'knowledgeFileParsing');
const knowledgeDocuments = bind(app, 'knowledgeDocuments');
const knowledgeDocPreviewVisible = bind(app, 'knowledgeDocPreviewVisible');
const knowledgeDocPreview = bind(app, 'knowledgeDocPreview');
const showKnowledgeCreateDialog = bind(app, 'showKnowledgeCreateDialog');
const agentForm = bind(app, 'agentForm');
const knowledgeForm = bind(app, 'knowledgeForm');
const knowledgeDocForm = bind(app, 'knowledgeDocForm');
const ragLabForm = bind(app, 'ragLabForm');
const ragLabSearching = bind(app, 'ragLabSearching');
const ragLabResults = bind(app, 'ragLabResults');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isAuthenticated = bind(app, 'isAuthenticated');
const loadAgentResources = bind(app, 'loadAgentResources');
const selectAgentById = bind(app, 'selectAgentById');
const saveAgent = bind(app, 'saveAgent');
const createKnowledgeBaseFromForm = bind(app, 'createKnowledgeBaseFromForm');
const addDocumentToKnowledgeBase = bind(app, 'addDocumentToKnowledgeBase');
const handleKnowledgeFileUpload = bind(app, 'handleKnowledgeFileUpload');
const loadKnowledgeDocuments = bind(app, 'loadKnowledgeDocuments');
const previewKnowledgeDocument = bind(app, 'previewKnowledgeDocument');
const deleteKnowledgeDocument = bind(app, 'deleteKnowledgeDocument');
const formatDate = bind(app, 'formatDate');
const runRagLabSearch = bind(app, 'runRagLabSearch');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px">
            <strong>知识库 / RAG 管理</strong>
            <el-button :icon="Refresh" :loading="agentResourceLoading" @click="loadAgentResources()">刷新</el-button>
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

        <div class="rag-page">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以管理知识库" />
          <template v-else>
            <el-card shadow="never" class="rag-panel rag-manage-panel">
              <template #header>
                <div class="agent-panel-head">
                  <span>知识库与文档</span>
                  <div>
                    <el-tag size="small" type="primary" style="margin-right: 8px;">{{ knowledgeBases.length }} 个知识库</el-tag>
                    <el-button size="small" type="primary" @click="showKnowledgeCreateDialog = true">
                      <el-icon><Plus /></el-icon> 创建知识库
                    </el-button>
                  </div>
                </div>
              </template>
              <div class="agent-helper-strip">RAG 页面负责知识管理；Agent 页面只负责选择和绑定知识库。</div>
              
              <div class="rag-upload-section">
                <div class="rag-upload-row">
                  <el-select v-model="knowledgeDocForm.kbId" placeholder="选择知识库" filterable style="width: 200px">
                    <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                  </el-select>
                  <el-input v-model="knowledgeDocForm.title" placeholder="文档标题" maxlength="120" style="flex: 1" />
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="false"
                    accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json"
                    @change="handleKnowledgeFileUpload"
                  >
                    <el-button :loading="knowledgeFileParsing">
                      <el-icon><Upload /></el-icon> 上传文件
                    </el-button>
                  </el-upload>
                  <el-button
                    type="primary"
                    :loading="knowledgeDocSaving"
                    :disabled="!knowledgeDocForm.kbId || !knowledgeDocForm.title.trim() || !knowledgeDocForm.content.trim()"
                    @click="addDocumentToKnowledgeBase()"
                  >
                    写入向量化
                  </el-button>
                </div>
                <div class="rag-format-tags">
                  <span class="format-label">支持格式：</span>
                  <el-tag size="small" type="info">TXT</el-tag>
                  <el-tag size="small" type="info">Markdown</el-tag>
                  <el-tag size="small" type="success">Word</el-tag>
                  <el-tag size="small" type="success">PDF</el-tag>
                  <el-tag size="small" type="success">Excel</el-tag>
                  <el-tag size="small" type="info">CSV</el-tag>
                  <el-tag size="small" type="info">JSON</el-tag>
                </div>
                <el-input
                  v-model="knowledgeDocForm.content"
                  type="textarea"
                  :rows="6"
                  resize="vertical"
                  placeholder="粘贴文档内容，或上传文件自动解析..."
                />
              </div>

              <el-divider />
              
              <div class="rag-documents-section" v-if="knowledgeDocForm.kbId">
                <div class="agent-section-title">
                  <span>已上传文档</span>
                  <el-button size="small" text @click="loadKnowledgeDocuments(knowledgeDocForm.kbId)">刷新</el-button>
                </div>
                <div class="rag-doc-list">
                  <div v-for="doc in knowledgeDocuments" :key="doc.id" class="rag-doc-item">
                    <div class="rag-doc-info">
                      <el-icon class="rag-doc-icon"><Document /></el-icon>
                      <div class="rag-doc-detail">
                        <span class="rag-doc-title">{{ doc.title }}</span>
                        <span class="rag-doc-meta">{{ doc.chunkCount }} chunks · {{ formatDate(doc.createdAt) }}</span>
                      </div>
                    </div>
                    <div class="rag-doc-actions">
                      <el-button size="small" text @click="previewKnowledgeDocument(doc)">预览</el-button>
                      <el-button size="small" text type="danger" @click="deleteKnowledgeDocument(doc.id)">删除</el-button>
                    </div>
                  </div>
                  <el-empty v-if="knowledgeDocuments.length === 0" description="暂无文档" :image-size="48" />
                </div>
              </div>

              <el-divider />
              <div class="rag-kb-grid">
                <div v-for="kb in knowledgeBases" :key="kb.id" class="agent-resource-item" :class="{ active: knowledgeDocForm.kbId === kb.id }" @click="knowledgeDocForm.kbId = kb.id">
                  <div class="agent-resource-title">
                    <span>{{ kb.name }}</span>
                    <el-tag size="small" type="success">ready</el-tag>
                  </div>
                  <div class="agent-resource-meta">{{ kb.documentCount }} docs · {{ kb.chunkCount }} chunks · 向量化完成</div>
                  <div class="agent-resource-content">{{ kb.description || '暂无描述' }}</div>
                </div>
                <el-empty v-if="knowledgeBases.length === 0" description="暂无知识库" :image-size="72" />
              </div>
            </el-card>

            <!-- 文档预览对话框 -->
            <el-dialog v-model="knowledgeDocPreviewVisible" :title="knowledgeDocPreview.title || '文档预览'" width="600px">
              <div class="rag-doc-preview">
                <div class="rag-doc-preview-meta">
                  <el-tag size="small">{{ knowledgeDocPreview.chunkCount }} chunks</el-tag>
                  <el-tag size="small" type="info">{{ formatDate(knowledgeDocPreview.createdAt) }}</el-tag>
                </div>
                <el-divider />
                <div class="rag-doc-preview-content">
                  <pre>{{ knowledgeDocPreview.content }}</pre>
                </div>
              </div>
            </el-dialog>

            <!-- 创建知识库对话框 -->
            <el-dialog v-model="showKnowledgeCreateDialog" title="创建知识库" width="480px" :close-on-click-modal="false">
              <el-form label-position="top">
                <el-form-item label="知识库名称" required>
                  <el-input v-model="knowledgeForm.name" placeholder="输入知识库名称" maxlength="80" show-word-limit />
                </el-form-item>
                <el-form-item label="描述">
                  <el-input v-model="knowledgeForm.description" type="textarea" :rows="3" placeholder="描述这个知识库的用途" maxlength="300" show-word-limit />
                </el-form-item>
              </el-form>
              <template #footer>
                <el-button @click="showKnowledgeCreateDialog = false">取消</el-button>
                <el-button type="primary" :loading="knowledgeCreating" :disabled="!knowledgeForm.name.trim()" @click="createKnowledgeBaseFromForm(); showKnowledgeCreateDialog = false">
                  创建
                </el-button>
              </template>
            </el-dialog>

            <el-card shadow="never" class="rag-panel rag-test-panel">
              <template #header>
                <div class="agent-panel-head">
                  <span>RAG 检索实验台</span>
                  <el-tag size="small" type="success">{{ ragLabForm.mode }}</el-tag>
                </div>
              </template>
              <div class="rag-lab-controls">
                <el-select v-model="ragLabForm.kbId" placeholder="选择要测试的知识库" filterable>
                  <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                </el-select>
                <el-segmented
                  v-model="ragLabForm.mode"
                  :options="[
                    { label: '混合', value: 'hybrid' },
                    { label: '关键词', value: 'keyword' },
                    { label: '向量', value: 'vector' },
                  ]"
                />
                <el-input-number v-model="ragLabForm.limit" :min="1" :max="12" :step="1" />
              </div>
              <el-input v-model="ragLabForm.query" type="textarea" :rows="4" resize="vertical" placeholder="输入真实用户问题，检查召回片段是否正确" />
              <el-button
                type="primary"
                :loading="ragLabSearching"
                :disabled="!ragLabForm.kbId || !ragLabForm.query.trim()"
                @click="runRagLabSearch()"
              >
                测试检索
              </el-button>
              <div class="rag-result-list">
                <div v-for="result in ragLabResults" :key="result.id" class="agent-resource-item rag-result-item">
                  <div class="agent-resource-title">
                    <span>{{ result.title }}</span>
                    <el-tag size="small" type="primary">score {{ Number(result.score || 0).toFixed(3) }}</el-tag>
                  </div>
                  <div class="agent-resource-content">{{ result.content }}</div>
                </div>
                <el-empty v-if="ragLabForm.query && !ragLabSearching && ragLabResults.length === 0" description="暂无检索结果" :image-size="64" />
              </div>
              <el-divider />
              <div class="agent-resource-title">绑定到 Agent</div>
              <el-select v-model="activeAgentId" placeholder="选择 Agent" filterable style="width:100%" @change="selectAgentById">
                <el-option v-for="agent in agents" :key="agent.id" :label="agent.name" :value="agent.id" />
              </el-select>
              <el-select
                v-model="agentForm.knowledgeBaseIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择要绑定的知识库"
                style="width:100%"
              >
                <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
              </el-select>
              <el-button type="primary" plain :loading="agentSaving" :disabled="!agentForm.id" @click="saveAgent()">保存绑定</el-button>
            </el-card>
          </template>
        </div>
</template>
