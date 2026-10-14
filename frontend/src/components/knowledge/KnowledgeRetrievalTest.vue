<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from "vue";
import {
  searchKnowledgeBaseDetailed,
  type KnowledgeBase,
  type KnowledgeSearchResult,
  type KnowledgeRetrievalMeta,
} from "../../api";
import { createRagLabSession } from "../../utils/rag-lab-session";
const props = defineProps<{
  kb: KnowledgeBase;
  baseUrl: string;
  indexing: boolean;
  indexError: string;
}>();
const emit = defineEmits<{ applications: []; settings: [] }>();
const form = reactive({
  query: "",
  mode: "hybrid" as "hybrid" | "keyword" | "vector",
  limit: 5,
  thresholdEnabled: false,
  minDenseScore: 0.25,
});
type Request = {
  kbId: string;
  query: string;
  mode: typeof form.mode;
  limit: number;
  minDenseScore?: number;
  baseUrl: string;
};
const results = ref<KnowledgeSearchResult[]>([]),
  meta = ref<KnowledgeRetrievalMeta | null>(null),
  snapshot = ref<Request | null>(null),
  error = ref(""),
  searching = ref(false);
const session = createRagLabSession(
  { results, meta, snapshot, error, searching },
  (r: Request) =>
    searchKnowledgeBaseDetailed(
      r.kbId,
      r.query,
      { mode: r.mode, limit: r.limit, minDenseScore: r.minDenseScore },
      r.baseUrl,
    ),
);
watch(
  [
    () => props.kb.id,
    () => props.kb.embeddingInstanceId,
    () => props.baseUrl,
    () => props.indexing,
    () => ({ ...form }),
  ],
  () => session.invalidate(),
  { deep: true },
);
onUnmounted(() => session.invalidate());
function search() {
  if (
    searching.value ||
    !form.query.trim() ||
    (props.indexing && form.mode !== "keyword")
  )
    return;
  void session.run({
    kbId: props.kb.id,
    query: form.query.trim(),
    mode: form.mode,
    limit: form.limit,
    baseUrl: props.baseUrl,
    ...(form.thresholdEnabled &&
    form.mode !== "keyword" &&
    props.kb.provider === "native"
      ? { minDenseScore: form.minDenseScore }
      : {}),
  });
}
const modeLabel = (mode: string) =>
  ({
    hybrid: "混合检索",
    keyword: "关键词检索",
    vector: "向量检索",
    mixed: "分路检索",
  })[mode] || mode;
</script>
<template>
  <div class="knowledge-section-head">
    <div>
      <h2>检索测试</h2>
      <p>检查问题能召回哪些资料，不调用 LLM 生成回答。</p>
    </div>
  </div>
  <div class="knowledge-retrieval-input">
    <label for="knowledge-question">测试问题</label
    ><el-input
      id="knowledge-question"
      v-model="form.query"
      type="textarea"
      :rows="3"
      maxlength="2000"
      show-word-limit
      resize="vertical"
      :disabled="searching"
      placeholder="例如：产品的退款规则是什么？"
      @keydown.ctrl.enter="search"
    />
    <div class="knowledge-retrieval-actions">
      <el-segmented
        v-model="form.mode"
        :disabled="searching"
        :options="[
          { label: '混合', value: 'hybrid' },
          { label: '关键词', value: 'keyword' },
          { label: '向量', value: 'vector' },
        ]"
        aria-label="检索策略"
      /><el-button
        type="primary"
        icon="Search"
        :loading="searching"
        :disabled="!form.query.trim() || (indexing && form.mode !== 'keyword')"
        @click="search"
        >开始检索</el-button
      >
    </div>
    <p class="knowledge-muted">
      {{
        form.mode === "hybrid"
          ? "同时召回关键词匹配与语义相近的内容，再融合排序。"
          : form.mode === "keyword"
            ? "按词面匹配召回，适合名称、术语与编号。"
            : "按 Embedding 语义相似度召回，适合同义表达。"
      }}
    </p>
  </div>
  <el-collapse class="knowledge-advanced"
    ><el-collapse-item title="高级参数" name="advanced"
      ><el-form label-position="top" class="knowledge-parameter-grid"
        ><el-form-item label="返回片段数（Top K）"
          ><el-input-number
            v-model="form.limit"
            :min="1"
            :max="12"
            :precision="0"
            :step="1"
            step-strictly
            :disabled="searching"
            aria-label="返回片段数" /></el-form-item
        ><el-form-item
          v-if="kb.provider === 'native' && form.mode !== 'keyword'"
          label="向量相似度过滤"
          ><el-switch
            v-model="form.thresholdEnabled"
            active-text="启用阈值"
            :disabled="searching"
          /><el-input-number
            v-if="form.thresholdEnabled"
            v-model="form.minDenseScore"
            :min="-1"
            :max="1"
            :precision="2"
            :step="0.05"
            :disabled="searching"
            aria-label="最低余弦相似度"
          /><small
            >仅过滤原始余弦相似度，不代表答案置信度。</small
          ></el-form-item
        ><el-form-item label="Embedding 与检索引擎"
          ><span>{{
            kb.provider === "ragflow"
              ? "RAGFlow 外部引擎"
              : kb.embeddingInstanceId
                ? "已绑定托管模型"
                : "环境配置模型"
          }}</span
          ><el-button text type="primary" @click="emit('settings')"
            >查看配置</el-button
          ><small
            >模型与计算节点由知识库设置及后台模型服务管理，不在检索时临时切换。</small
          ></el-form-item
        ></el-form
      ></el-collapse-item
    ></el-collapse
  >
  <p v-if="indexing" role="status" class="knowledge-muted">
    索引正在更新。关键词检索仍可使用，向量与混合检索将在完成后自动恢复。
  </p>
  <el-alert
    v-if="indexError"
    :title="`索引状态读取失败：${indexError}`"
    type="warning"
    :closable="false"
  />
  <section class="knowledge-results" aria-live="polite" :aria-busy="searching">
    <div class="knowledge-section-head">
      <h2>
        召回结果 <small v-if="snapshot">{{ results.length }} 个片段</small>
      </h2>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
    /><el-alert
      v-if="meta?.degraded"
      title="部分检索路径不可用，以下显示实际执行的结果。"
      type="warning"
      :closable="false"
    />
    <p v-if="snapshot" class="knowledge-muted">
      {{ snapshot.query }} ·
      {{ modeLabel(meta?.effectiveMode || snapshot.mode) }}
    </p>
    <el-skeleton v-if="searching" :rows="5" animated />
    <article
      v-for="(result, index) in results"
      :key="result.id"
      class="knowledge-result"
    >
      <div class="knowledge-result-head">
        <strong>{{ index + 1 }}. {{ result.title }}</strong>
        <div class="knowledge-score">
          <span v-if="result.denseScore !== undefined"
            >余弦 {{ result.denseScore.toFixed(4) }}</span
          ><span v-if="result.lexicalScore !== undefined"
            >词面 {{ result.lexicalScore.toFixed(3) }}</span
          ><span v-if="result.fusionScore !== undefined"
            >融合 {{ result.fusionScore.toFixed(6) }}</span
          ><span v-if="result.externalScore !== undefined"
            >外部引擎 {{ result.externalScore.toFixed(4) }}</span
          ><span v-if="!result.scoreType"
            >引擎 {{ Number(result.score).toFixed(4) }}</span
          >
        </div>
      </div>
      <pre class="knowledge-pre">{{ result.content }}</pre>
    </article>
    <el-empty
      v-if="!searching && !error && !results.length"
      :description="
        snapshot
          ? '没有找到符合条件的片段，试试调整问题或检索策略。'
          : '输入问题，检查你的资料能否被准确召回。'
      "
      :image-size="64"
    />
    <details v-if="meta?.queryTerms?.length" class="knowledge-muted">
      <summary>查看查询词项</summary>
      {{ meta.queryTerms.join(" · ") }}
    </details>
  </section>
  <div v-if="results.length" class="knowledge-next-step">
    <span>召回效果满意？让 Agent 使用这些资料。</span
    ><el-button text type="primary" @click="emit('applications')"
      >关联 Agent <el-icon><ArrowRight /></el-icon
    ></el-button>
  </div>
</template>
