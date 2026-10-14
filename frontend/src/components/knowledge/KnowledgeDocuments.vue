<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  deleteKnowledgeDocument,
  reparseKnowledgeDocument,
  fetchKnowledgeDocumentDetail,
  type KnowledgeDocument,
  type KnowledgeChunk,
} from "../../api";
import { documentStage } from "../../utils/knowledge-navigation";
import { message } from "../../composables/useKnowledgeWorkspace";
import KnowledgeDocumentUpload from "./KnowledgeDocumentUpload.vue";
const props = defineProps<{
  kbId: string;
  baseUrl: string;
  documents: KnowledgeDocument[];
  query: string;
  loading: boolean;
  indexing: boolean;
  error: string;
}>();
const emit = defineEmits<{
  "update:query": [value: string];
  search: [];
  changed: [];
  retrieval: [];
}>();
const upload = ref(false),
  detailVisible = ref(false),
  detail = ref<(KnowledgeDocument & { chunks: KnowledgeChunk[] }) | null>(null),
  detailLoading = ref(false),
  detailError = ref(""),
  actionId = ref(""),
  actionError = ref("");
let detailRequest = 0;
async function preview(doc: KnowledgeDocument) {
  const request = ++detailRequest;
  detailVisible.value = true;
  detail.value = null;
  detailError.value = "";
  detailLoading.value = true;
  try {
    const data = await fetchKnowledgeDocumentDetail(doc.id, props.baseUrl);
    if (request === detailRequest) detail.value = data;
  } catch (e) {
    if (request === detailRequest) detailError.value = message(e);
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}
async function act(doc: KnowledgeDocument, remove: boolean) {
  if (actionId.value) return;
  try {
    if (remove)
      await ElMessageBox.confirm(
        `删除“${doc.title}”及其检索片段？`,
        "删除文档",
        {
          type: "warning",
          confirmButtonText: "删除",
          cancelButtonText: "取消",
        },
      );
    actionId.value = doc.id;
    actionError.value = "";
    if (remove) await deleteKnowledgeDocument(doc.id, props.baseUrl);
    else await reparseKnowledgeDocument(doc.id, props.baseUrl);
    emit("changed");
    ElMessage.success(remove ? "文档已删除" : "重新解析已完成");
  } catch (e) {
    if (e !== "cancel" && e !== "close") actionError.value = message(e);
  } finally {
    actionId.value = "";
  }
}
const date = (value: string) => new Date(value).toLocaleString("zh-CN");
function stage(doc: KnowledgeDocument) {
  return props.indexing &&
    doc.parseStatus === "succeeded" &&
    doc.vectorStatus === "pending"
    ? "索引中"
    : documentStage(doc);
}
function stageTitle(doc: KnowledgeDocument) {
  return `解析：${doc.parseStatus}；向量索引：${doc.vectorStatus}`;
}
</script>
<template>
  <div class="knowledge-section-head">
    <div>
      <h2>文档</h2>
      <p>上传资料后，文档状态会自动更新。</p>
    </div>
    <el-button type="primary" icon="Upload" @click="upload = true"
      >上传文档</el-button
    >
  </div>
  <div class="knowledge-toolbar">
    <el-input
      :model-value="query"
      clearable
      prefix-icon="Search"
      placeholder="搜索文档"
      aria-label="搜索文档"
      @update:model-value="emit('update:query', $event)"
      @clear="emit('search')"
      @keyup.enter="emit('search')"
    /><el-button :loading="loading" @click="emit('search')">搜索</el-button>
  </div>
  <el-alert
    v-if="error || actionError"
    :title="error || actionError"
    type="error"
    :closable="false"
    ><el-button v-if="error" text @click="emit('search')"
      >重新加载</el-button
    ></el-alert
  >
  <div class="knowledge-document-list" v-loading="loading">
    <article
      v-for="doc in documents"
      :key="doc.id"
      class="knowledge-document-row"
    >
      <el-icon class="knowledge-document-icon"><Document /></el-icon>
      <div class="knowledge-document-main">
        <button class="knowledge-text-link" @click="preview(doc)">
          {{ doc.title }}
        </button>
        <div class="knowledge-muted">
          {{ doc.chunkCount }} 片段 · {{ date(doc.createdAt) }}
        </div>
        <p v-if="doc.failureReason" role="alert" class="knowledge-error">
          {{ doc.failureReason }}
        </p>
      </div>
      <span
        class="knowledge-stage"
        :class="{ 'is-failed': stage(doc) === '处理失败' }"
        :title="stageTitle(doc)"
        >{{ stage(doc) }}</span
      >
      <div class="knowledge-actions">
        <el-button
          text
          :loading="actionId === doc.id"
          :disabled="!!actionId"
          @click="act(doc, false)"
          >{{ stage(doc) === "处理失败" ? "重试" : "重新解析" }}</el-button
        ><el-dropdown trigger="click"
          ><el-button
            text
            circle
            icon="MoreFilled"
            :aria-label="`${doc.title}的操作`"
          /><template #dropdown
            ><el-dropdown-menu
              ><el-dropdown-item @click="preview(doc)"
                >文档详情</el-dropdown-item
              ><el-dropdown-item :disabled="!!actionId" @click="act(doc, true)"
                >删除文档</el-dropdown-item
              ></el-dropdown-menu
            ></template
          ></el-dropdown
        >
      </div>
    </article>
    <el-empty
      v-if="!documents.length && !loading"
      :description="query ? '没有匹配的文档' : '先添加一份资料'"
      :image-size="80"
      ><p v-if="!query" class="knowledge-muted">
        支持文件上传，也可以直接粘贴文本。
      </p>
      <el-button v-if="!query" type="primary" @click="upload = true"
        >上传第一份文档</el-button
      ></el-empty
    >
  </div>
  <div v-if="documents.length" class="knowledge-next-step">
    <span>资料添加完成后，试试能否找回需要的内容。</span
    ><el-button text type="primary" @click="emit('retrieval')"
      >测试检索 <el-icon><ArrowRight /></el-icon
    ></el-button>
  </div>
  <KnowledgeDocumentUpload
    v-model="upload"
    :kb-id="kbId"
    :base-url="baseUrl"
    @saved="emit('changed')"
    @changed="emit('changed')"
  />
  <el-drawer
    v-model="detailVisible"
    title="文档详情"
    size="min(720px, 100vw)"
    @closed="detailRequest++"
    ><div v-loading="detailLoading">
      <el-alert
        v-if="detailError"
        :title="detailError"
        type="error"
        :closable="false"
      /><template v-if="detail"
        ><h2>{{ detail.title }}</h2>
        <p class="knowledge-muted">
          {{ documentStage(detail) }} · {{ detail.chunkCount }} 片段
        </p>
        <el-tabs
          ><el-tab-pane label="原文">
            <pre class="knowledge-pre">{{ detail.content }}</pre></el-tab-pane
          ><el-tab-pane label="文本片段"
            ><article
              v-for="chunk in detail.chunks"
              :key="chunk.id"
              class="knowledge-result"
            >
              <div class="knowledge-result-head">
                <strong>片段 {{ chunk.chunkIndex + 1 }}</strong
                ><small>{{ chunk.tokenEstimate }} tokens（估算）</small>
              </div>
              <pre class="knowledge-pre">{{ chunk.content }}</pre>
            </article></el-tab-pane
          ></el-tabs
        ></template
      >
    </div></el-drawer
  >
</template>
