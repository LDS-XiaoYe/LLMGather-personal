<script setup lang="ts">
import { computed, isRef, ref, unref } from "vue";
import type { KnowledgeBase, AgentDefinition } from "../../../api";
import { useKnowledgeWorkspace } from "../../../composables/useKnowledgeWorkspace";
import type { KnowledgeTab } from "../../../utils/knowledge-navigation";
import WorkspaceHeader from "../../ui/WorkspaceHeader.vue";
import KnowledgeBaseList from "../../knowledge/KnowledgeBaseList.vue";
import KnowledgeDocuments from "../../knowledge/KnowledgeDocuments.vue";
import KnowledgeRetrievalTest from "../../knowledge/KnowledgeRetrievalTest.vue";
import KnowledgeAgentBinding from "../../knowledge/KnowledgeAgentBinding.vue";
import KnowledgeBaseSettings from "../../knowledge/KnowledgeBaseSettings.vue";
import KnowledgeLibrary from "../../knowledge/KnowledgeLibrary.vue";
import KnowledgeEmbeddingSelector from "../../KnowledgeEmbeddingSelector.vue";
import "../../../knowledge.css";
const props = defineProps<{ app: Record<string, any> }>();
const baseUrl = computed<string>(
  () => unref(props.app.backendBaseUrl) || "/v1",
);
const authenticated = computed<boolean>(
  () => !!unref(props.app.isAuthenticated),
);
const authLoaded = computed<boolean>(() => !!unref(props.app.isAuthLoaded));
const username = computed<string>(
  () => unref(props.app.authUser)?.username || "",
);
function setShared(key: string, value: unknown) {
  if (isRef(props.app[key])) props.app[key].value = value;
  else props.app[key] = value;
}
const workspace = useKnowledgeWorkspace(
  baseUrl,
  authenticated,
  (bases: KnowledgeBase[]) => setShared("knowledgeBases", bases),
);
const {
  route,
  selected,
  filtered,
  bases,
  loading,
  error,
  query,
  createVisible,
  creating,
  createError,
  form,
  documents,
  documentsLoading,
  documentError,
  documentQuery,
  indexing,
  indexError,
} = workspace;
const bindingBusy = ref(false);
const tab = computed({
  get: () => route.value.tab,
  set: (value: KnowledgeTab) => workspace.navigate(route.value.id, value),
});
const canCreate = computed(
  () =>
    !!form.name.trim() &&
    (form.provider === "native" ||
      (form.ragflowBaseUrl.trim() && form.ragflowApiKey.trim())),
);
function login() {
  setShared("isAuthDialogOpen", true);
}
function userMenu(command: string) {
  unref(props.app.handleUserMenu)?.(command);
}
function library() {
  window.location.hash = "#/knowledge/library";
}
function updatedAgents(agents: AgentDefinition[]) {
  setShared("agents", agents);
}
</script>
<template>
  <WorkspaceHeader :app="props.app" />
  <section class="knowledge-workspace" :class="{ 'knowledge-root': !route.id && !route.library }" aria-label="知识库工作空间">
    <el-skeleton v-if="!authLoaded" :rows="6" animated />
    <el-empty
      v-else-if="!authenticated"
      description="登录后创建和管理你的专属知识库"
      :image-size="96"
      ><el-button type="primary" @click="login"
        >登录 / 注册</el-button
      ></el-empty
    >
    <template v-else>
      <template v-if="route.library"
        ><el-button text icon="ArrowLeft" @click="workspace.navigate()"
          >返回知识库</el-button
        >
        <header class="knowledge-heading">
          <div>
            <h1>用户文件库</h1>
            <p>保留上传文件、对话附件与 Agent 生成内容，按需加入知识库。</p>
          </div>
        </header>
        <KnowledgeLibrary
          :base-url="baseUrl"
          :bases="bases"
          @changed="workspace.changed"
      /></template>
      <KnowledgeBaseList
        v-else-if="!route.id"
        v-model:query="query"
        :bases="filtered"
        :total="bases.length"
        :loading="loading"
        :error="error"
        @create="
          createVisible = true;
          createError = '';
        "
        @open="workspace.navigate"
        @library="library"
        @retry="workspace.loadBases"
      />
      <template v-else-if="selected"
        ><el-button
          class="knowledge-back"
          text
          icon="ArrowLeft"
          @click="workspace.navigate()"
          >全部知识库</el-button
        >
        <header class="knowledge-heading knowledge-detail-heading">
          <div>
            <h1>{{ selected.name }}</h1>
            <p>
              {{
                selected.description ||
                "管理资料，验证召回效果，并将知识用于 Agent。"
              }}
            </p>
          </div>
          <div class="knowledge-detail-count">
            {{ selected.documentCount }} 文档 · {{ selected.chunkCount }} 片段
          </div>
        </header>
        <el-tabs v-model="tab" class="knowledge-detail-tabs">
          <el-tab-pane label="文档" name="documents" lazy
            ><KnowledgeDocuments
              :key="selected.id"
              v-model:query="documentQuery"
              :kb-id="selected.id"
              :base-url="baseUrl"
              :documents="documents"
              :loading="documentsLoading"
              :indexing="indexing || bindingBusy"
              :error="documentError"
              @search="workspace.loadDocuments()"
              @changed="workspace.changed"
              @retrieval="workspace.navigate(selected.id, 'retrieval')"
          /></el-tab-pane>
          <el-tab-pane label="检索测试" name="retrieval" lazy
            ><KnowledgeRetrievalTest
              :key="selected.id"
              :kb="selected"
              :base-url="baseUrl"
              :indexing="indexing || bindingBusy"
              :index-error="indexError"
              @settings="workspace.navigate(selected.id, 'settings')"
              @applications="workspace.navigate(selected.id, 'applications')"
          /></el-tab-pane>
          <el-tab-pane label="关联应用" name="applications" lazy
            ><KnowledgeAgentBinding
              :key="selected.id"
              :kb-id="selected.id"
              :base-url="baseUrl"
              @changed="updatedAgents"
          /></el-tab-pane>
          <el-tab-pane label="设置" name="settings" lazy
            ><KnowledgeBaseSettings
              :key="selected.id"
              :kb="selected"
              :base-url="baseUrl"
              @changed="workspace.changed"
              @indexing="bindingBusy = $event"
          /></el-tab-pane>
        </el-tabs>
      </template>
      <el-skeleton v-else-if="loading" :rows="6" animated />
      <el-empty
        v-else
        description="知识库不存在或当前账户无访问权限"
        :image-size="80"
        ><el-alert
          v-if="error"
          :title="error"
          type="error"
          :closable="false"
        /><el-button @click="workspace.loadBases">重试</el-button
        ><el-button type="primary" @click="workspace.navigate()"
          >返回知识库</el-button
        ></el-empty
      >
      <el-dialog
        v-model="createVisible"
        title="新建知识库"
        width="min(560px, calc(100vw - 32px))"
        :close-on-click-modal="false"
        :show-close="!creating"
        :close-on-press-escape="!creating"
        ><el-form label-position="top" :disabled="creating"
          ><el-form-item label="知识库名称" required
            ><el-input
              v-model="form.name"
              maxlength="128"
              placeholder="例如：产品资料、团队手册" /></el-form-item
          ><el-form-item label="描述"
            ><el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="1000"
              placeholder="这些资料将帮助 AI 回答哪些问题？" /></el-form-item
          ><el-form-item label="知识库引擎"
            ><el-segmented
              v-model="form.provider"
              :options="[
                { label: '本地知识库', value: 'native' },
                { label: 'RAGFlow', value: 'ragflow' },
              ]" /></el-form-item
          ><el-form-item
            v-if="form.provider === 'native'"
            label="Embedding 模型"
            ><KnowledgeEmbeddingSelector
              v-model="form.embeddingInstanceId"
              :base-url="baseUrl"
              :disabled="creating" /></el-form-item
          ><template v-else
            ><el-form-item label="RAGFlow 地址" required
              ><el-input
                v-model="form.ragflowBaseUrl"
                placeholder="RAGFlow 服务的完整地址" /></el-form-item
            ><el-form-item label="API Key" required
              ><el-input
                v-model="form.ragflowApiKey"
                type="password"
                show-password /></el-form-item
            ><el-form-item label="Dataset ID（可选）"
              ><el-input
                v-model="form.ragflowDatasetId"
                placeholder="留空则自动创建数据集" /></el-form-item></template></el-form
        ><el-alert
          v-if="createError"
          :title="createError"
          type="error"
          :closable="false"
        /><template #footer
          ><el-button :disabled="creating" @click="createVisible = false"
            >取消</el-button
          ><el-button
            type="primary"
            :loading="creating"
            :disabled="!canCreate"
            @click="workspace.create"
            >创建知识库</el-button
          ></template
        ></el-dialog
      >
    </template>
  </section>
</template>
