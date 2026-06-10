<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';

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
const Upload = bind(app, 'Upload');
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
const knowledgeContentSearch = bind(app, 'knowledgeContentSearch');
const knowledgeDocumentLoading = bind(app, 'knowledgeDocumentLoading');
const knowledgeActiveDoc = bind(app, 'knowledgeActiveDoc');
const knowledgeActiveDocLoading = bind(app, 'knowledgeActiveDocLoading');
const knowledgeReparsing = bind(app, 'knowledgeReparsing');
const ragActiveTab = bind(app, 'ragActiveTab');
const userLibraryFiles = bind(app, 'userLibraryFiles');
const userLibraryLoading = bind(app, 'userLibraryLoading');
const userLibraryUploading = bind(app, 'userLibraryUploading');
const userLibrarySavingToKb = bind(app, 'userLibrarySavingToKb');
const userLibraryPreviewVisible = bind(app, 'userLibraryPreviewVisible');
const userLibraryPreview = bind(app, 'userLibraryPreview');
const userLibraryAddDialogVisible = bind(app, 'userLibraryAddDialogVisible');
const userLibrarySelectedFile = bind(app, 'userLibrarySelectedFile');
const userLibraryTargetKbId = bind(app, 'userLibraryTargetKbId');
const userLibraryFilters = bind(app, 'userLibraryFilters');
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
const reparseKnowledgeDocument = bind(app, 'reparseKnowledgeDocument');
const loadUserLibraryFiles = bind(app, 'loadUserLibraryFiles');
const handleUserLibraryUpload = bind(app, 'handleUserLibraryUpload');
const previewUserLibraryFile = bind(app, 'previewUserLibraryFile');
const renameUserLibraryFile = bind(app, 'renameUserLibraryFile');
const deleteUserLibraryFile = bind(app, 'deleteUserLibraryFile');
const openAddUserLibraryFileToKnowledge = bind(app, 'openAddUserLibraryFileToKnowledge');
const addUserLibraryFileToKnowledge = bind(app, 'addUserLibraryFileToKnowledge');
const downloadUserLibraryFile = bind(app, 'downloadUserLibraryFile');
const formatDate = bind(app, 'formatDate');
const runRagLabSearch = bind(app, 'runRagLabSearch');
const handleUserMenu = bind(app, 'handleUserMenu');

function fileTypeLabel(type: string) {
  return ({ word: 'Word', pdf: 'PDF', excel: 'Excel', markdown: 'Markdown', image: '图片', text: '文本', unknown: '未知' } as Record<string, string>)[type] || type || '未知';
}

function sourceLabel(source: string) {
  return ({ user_upload: '用户上传', agent_generated: 'Agent 生成', conversation_attachment: '对话附件', intermediate: '中间产物' } as Record<string, string>)[source] || source || '未知';
}

function kbStatusLabel(status: string) {
  return status === 'added' ? '已加入知识库' : '未入库';
}

function formatSize(size: number) {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
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
            <span>知识库</span>
            <div>
              <el-tag size="small" type="primary" style="margin-right: 8px;">{{ knowledgeBases.length }} 个知识库</el-tag>
              <el-button size="small" type="primary" @click="showKnowledgeCreateDialog = true">
                <el-icon><Plus /></el-icon> 创建知识库
              </el-button>
            </div>
          </div>
        </template>

        <el-tabs v-model="ragActiveTab">
          <el-tab-pane label="知识库内容" name="content">
            <div class="rag-upload-section">
              <div class="rag-upload-row">
                <el-select v-model="knowledgeDocForm.kbId" placeholder="选择知识库" filterable style="width: 220px">
                  <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
                </el-select>
                <el-input v-model="knowledgeDocForm.title" placeholder="文档标题" maxlength="120" style="flex: 1" />
                <el-upload :auto-upload="false" :show-file-list="false" accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json" @change="handleKnowledgeFileUpload">
                  <el-button :loading="knowledgeFileParsing">
                    <el-icon><Upload /></el-icon> 上传并解析
                  </el-button>
                </el-upload>
                <el-button type="primary" :loading="knowledgeDocSaving" :disabled="!knowledgeDocForm.kbId || !knowledgeDocForm.title.trim() || !knowledgeDocForm.content.trim()" @click="addDocumentToKnowledgeBase()">
                  写入
                </el-button>
              </div>
              <el-input v-model="knowledgeDocForm.content" type="textarea" :rows="5" resize="vertical" placeholder="粘贴文档内容，或上传文件自动解析..." />
            </div>

            <el-divider />

            <div class="rag-upload-row">
              <el-input v-model="knowledgeContentSearch" clearable placeholder="搜索知识库文档" style="max-width: 320px" @keyup.enter="loadKnowledgeDocuments(knowledgeDocForm.kbId)" />
              <el-button :loading="knowledgeDocumentLoading" :disabled="!knowledgeDocForm.kbId" @click="loadKnowledgeDocuments(knowledgeDocForm.kbId)">搜索</el-button>
            </div>

            <el-table :data="knowledgeDocuments" v-loading="knowledgeDocumentLoading" style="width:100%" empty-text="暂无知识库文档">
              <el-table-column label="文档名称" min-width="180">
                <template #default="{ row }">
                  <div class="rag-doc-info">
                    <el-icon class="rag-doc-icon"><Document /></el-icon>
                    <div class="rag-doc-detail">
                      <span class="rag-doc-title">{{ row.title }}</span>
                      <span class="rag-doc-meta">{{ fileTypeLabel(row.fileType) }} · {{ formatDate(row.createdAt) }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="解析状态" width="110">
                <template #default="{ row }"><el-tag size="small" :type="row.parseStatus === 'succeeded' ? 'success' : 'warning'">{{ row.parseStatus === 'succeeded' ? '成功' : row.parseStatus}}</el-tag></template>
              </el-table-column>
              <el-table-column label="Chunks" prop="chunkCount" width="90" />
              <el-table-column label="向量化" width="110">
                <template #default="{ row }"><el-tag size="small" :type="row.vectorStatus === 'succeeded' ? 'success' : 'info'">{{ row.vectorStatus === 'succeeded' ? '成功' : row.vectorStatus}}</el-tag></template>
              </el-table-column>
              <el-table-column label="失败原因" min-width="120">
                <template #default="{ row }">{{ row.failureReason || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text @click="previewKnowledgeDocument(row)">详情</el-button>
                  <el-button size="small" text :loading="knowledgeReparsing" @click="reparseKnowledgeDocument(row.id)">重新解析</el-button>
                  <el-button size="small" text type="danger" @click="deleteKnowledgeDocument(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <div v-if="knowledgeActiveDoc" class="rag-doc-detail-panel" v-loading="knowledgeActiveDocLoading">
              <div class="agent-section-title">
                <span>{{ knowledgeActiveDoc.title }}</span>
                <el-tag size="small">{{ knowledgeActiveDoc.chunkCount }} chunks</el-tag>
              </div>
              <el-tabs>
                <el-tab-pane label="文档原文">
                  <pre class="rag-pre">{{ knowledgeActiveDoc.content }}</pre>
                </el-tab-pane>
                <el-tab-pane label="Chunk 内容">
                  <div class="rag-result-list">
                    <div v-for="chunk in knowledgeActiveDoc.chunks || []" :key="chunk.id" class="agent-resource-item rag-result-item">
                      <div class="agent-resource-title">
                        <span>#{{ chunk.chunkIndex + 1 }}</span>
                        <el-tag size="small" type="info">{{ chunk.tokenEstimate }} tokens</el-tag>
                      </div>
                      <div class="agent-resource-content">{{ chunk.content }}</div>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>

            <el-divider />
            <div class="rag-kb-grid">
              <div v-for="kb in knowledgeBases" :key="kb.id" class="agent-resource-item" :class="{ active: knowledgeDocForm.kbId === kb.id }" @click="knowledgeDocForm.kbId = kb.id">
                <div class="agent-resource-title">
                  <span>{{ kb.name }}</span>
                  <el-tag size="small" type="success">就绪</el-tag>
                </div>
                <div class="agent-resource-meta">{{ kb.documentCount }} docs · {{ kb.chunkCount }} chunks</div>
                <div class="agent-resource-content">{{ kb.description || '暂无描述' }}</div>
              </div>
              <el-empty v-if="knowledgeBases.length === 0" description="暂无知识库" :image-size="72" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="用户库" name="library">
            <div class="rag-upload-row">
              <el-input v-model="userLibraryFilters.query" clearable placeholder="搜索文件" style="max-width: 260px" @keyup.enter="loadUserLibraryFiles()" />
              <el-select v-model="userLibraryFilters.fileType" clearable placeholder="文件类型" style="width: 140px">
                <el-option label="Word" value="word" />
                <el-option label="PDF" value="pdf" />
                <el-option label="Excel" value="excel" />
                <el-option label="Markdown" value="markdown" />
                <el-option label="图片" value="image" />
                <el-option label="文本" value="text" />
              </el-select>
              <el-select v-model="userLibraryFilters.source" clearable placeholder="来源" style="width: 150px">
                <el-option label="用户上传" value="user_upload" />
                <el-option label="Agent 生成" value="agent_generated" />
                <el-option label="对话附件" value="conversation_attachment" />
                <el-option label="中间产物" value="intermediate" />
              </el-select>
              <el-select v-model="userLibraryFilters.kbStatus" clearable placeholder="入库状态" style="width: 150px">
                <el-option label="未入库" value="not_added" />
                <el-option label="已加入知识库" value="added" />
              </el-select>
              <el-button :loading="userLibraryLoading" @click="loadUserLibraryFiles()">筛选</el-button>
              <el-upload :auto-upload="false" :show-file-list="false" @change="handleUserLibraryUpload">
                <el-button type="primary" :loading="userLibraryUploading">
                  <el-icon><Upload /></el-icon> 上传到用户库
                </el-button>
              </el-upload>
            </div>

            <el-table :data="userLibraryFiles" v-loading="userLibraryLoading" style="width:100%" empty-text="暂无用户库文件">
              <el-table-column label="文件" min-width="220">
                <template #default="{ row }">
                  <div class="rag-doc-info">
                    <el-icon class="rag-doc-icon"><Document /></el-icon>
                    <div class="rag-doc-detail">
                      <span class="rag-doc-title">{{ row.filename }}</span>
                      <span class="rag-doc-meta">{{ fileTypeLabel(row.fileType) }} · {{ formatSize(row.fileSize) }} · {{ formatDate(row.createdAt) }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="来源" width="120">
                <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }"><el-tag size="small" :type="row.kbStatus === 'added' ? 'success' : 'info'">{{ kbStatusLabel(row.kbStatus) }}</el-tag></template>
              </el-table-column>
              <el-table-column label="预览" min-width="220">
                <template #default="{ row }">{{ row.preview || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="310" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text @click="previewUserLibraryFile(row)">预览</el-button>
                  <el-button size="small" text @click="downloadUserLibraryFile(row)">下载</el-button>
                  <el-button size="small" text @click="renameUserLibraryFile(row)">重命名</el-button>
                  <el-button size="small" text type="primary" @click="openAddUserLibraryFileToKnowledge(row)">添加到知识库</el-button>
                  <el-button size="small" text type="danger" @click="deleteUserLibraryFile(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <el-dialog v-model="knowledgeDocPreviewVisible" :title="knowledgeDocPreview.title || '文档预览'" width="760px">
        <div class="rag-doc-preview" v-loading="knowledgeActiveDocLoading">
          <div class="rag-doc-preview-meta">
            <el-tag size="small">{{ knowledgeDocPreview.chunkCount }} chunks</el-tag>
            <el-tag size="small" type="info">{{ fileTypeLabel(knowledgeDocPreview.fileType) }}</el-tag>
            <el-tag size="small" type="info">{{ formatDate(knowledgeDocPreview.createdAt) }}</el-tag>
          </div>
          <el-divider />
          <pre class="rag-pre">{{ knowledgeDocPreview.content || knowledgeDocPreview.preview }}</pre>
        </div>
      </el-dialog>

      <el-dialog v-model="userLibraryPreviewVisible" :title="userLibraryPreview?.filename || '文件预览'" width="760px">
        <div v-if="userLibraryPreview" class="rag-doc-preview">
          <div class="rag-doc-preview-meta">
            <el-tag size="small">{{ fileTypeLabel(userLibraryPreview.fileType) }}</el-tag>
            <el-tag size="small" type="info">{{ sourceLabel(userLibraryPreview.source) }}</el-tag>
            <el-tag size="small" :type="userLibraryPreview.kbStatus === 'added' ? 'success' : 'info'">{{ kbStatusLabel(userLibraryPreview.kbStatus) }}</el-tag>
          </div>
          <el-divider />
          <img v-if="userLibraryPreview.fileType === 'image' && userLibraryPreview.fileBase64" :src="userLibraryPreview.fileBase64" style="max-width:100%; border-radius:8px;" />
          <pre v-else class="rag-pre">{{ userLibraryPreview.parsedContent || userLibraryPreview.preview || '该文件暂无文本预览' }}</pre>
        </div>
      </el-dialog>

      <el-dialog v-model="userLibraryAddDialogVisible" title="添加到知识库" width="420px">
        <el-form label-position="top">
          <el-form-item label="文件">
            <el-input :model-value="userLibrarySelectedFile?.filename || ''" disabled />
          </el-form-item>
          <el-form-item label="目标知识库" required>
            <el-select v-model="userLibraryTargetKbId" filterable placeholder="选择知识库" style="width:100%">
              <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="userLibraryAddDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="userLibrarySavingToKb" :disabled="!userLibraryTargetKbId" @click="addUserLibraryFileToKnowledge()">添加到知识库</el-button>
        </template>
      </el-dialog>

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
          <el-button type="primary" :loading="knowledgeCreating" :disabled="!knowledgeForm.name.trim()" @click="createKnowledgeBaseFromForm(); showKnowledgeCreateDialog = false">创建</el-button>
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
          <el-segmented v-model="ragLabForm.mode" :options="[
            { label: '混合', value: 'hybrid' },
            { label: '关键词', value: 'keyword' },
            { label: '向量', value: 'vector' },
          ]" />
          <el-input-number v-model="ragLabForm.limit" :min="1" :max="12" :step="1" />
        </div>
        <el-input v-model="ragLabForm.query" type="textarea" :rows="4" resize="vertical" placeholder="输入真实用户问题，检查召回片段是否正确" />
        <el-button type="primary" :loading="ragLabSearching" :disabled="!ragLabForm.kbId || !ragLabForm.query.trim()" @click="runRagLabSearch()">测试检索</el-button>
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
        <el-select v-model="agentForm.knowledgeBaseIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择要绑定的知识库" style="width:100%">
          <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
        </el-select>
        <el-button type="primary" plain :loading="agentSaving" :disabled="!agentForm.id" @click="saveAgent()">保存绑定</el-button>
      </el-card>
    </template>
  </div>
</template>
