<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { fetchAgents, updateAgent, type AgentDefinition } from "../../api";
import { knowledgeAssociation } from "../../utils/knowledge-navigation";
import { message } from "../../composables/useKnowledgeWorkspace";
const props = defineProps<{ kbId: string; baseUrl: string }>();
const emit = defineEmits<{ changed: [agents: AgentDefinition[]] }>();
const agents = ref<AgentDefinition[]>([]),
  selectedIds = ref<string[]>([]),
  originalIds = ref<string[]>([]),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  picker = ref(false),
  query = ref("");
const changed = computed(
  () =>
    [...selectedIds.value].sort().join(",") !==
    [...originalIds.value].sort().join(","),
);
const selected = computed(() =>
  agents.value.filter((a) => selectedIds.value.includes(a.id)),
);
const filtered = computed(() =>
  agents.value.filter((a) =>
    `${a.name} ${a.description}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
);
let request = 0,
  disposed = false;
async function load() {
  const current = ++request;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchAgents(props.baseUrl);
    if (disposed || request !== current) return;
    agents.value = data;
    selectedIds.value = data
      .filter((a) => a.knowledgeBaseIds.includes(props.kbId))
      .map((a) => a.id);
    originalIds.value = [...selectedIds.value];
  } catch (e) {
    if (!disposed && request === current) error.value = message(e);
  } finally {
    if (!disposed && request === current) loading.value = false;
  }
}
async function save() {
  if (saving.value || !changed.value) return;
  saving.value = true;
  error.value = "";
  const kbId = props.kbId,
    baseUrl = props.baseUrl,
    desired = [...selectedIds.value],
    original = [...originalIds.value];
  const changes = agents.value.filter(
    (a) => desired.includes(a.id) !== original.includes(a.id),
  );
  try {
    // Read current records before patching, so other KB associations are not overwritten by stale UI state.
    const fresh = await fetchAgents(baseUrl);
    for (const agent of changes) {
      const current = fresh.find((a) => a.id === agent.id);
      if (!current)
        throw new Error(`Agent“${agent.name}”已不存在，请重新加载。`);
      await updateAgent(
        agent.id,
        {
          knowledgeBaseIds: knowledgeAssociation(
            current.knowledgeBaseIds,
            kbId,
            desired.includes(agent.id),
          ),
        },
        baseUrl,
      );
      if (disposed || props.kbId !== kbId) return;
      originalIds.value = desired.includes(agent.id)
        ? [...new Set([...originalIds.value, agent.id])]
        : originalIds.value.filter((id) => id !== agent.id);
    }
    ElMessage.success("关联已保存");
    emit("changed", await fetchAgents(baseUrl));
  } catch (e) {
    if (!disposed)
      error.value = `${message(e)} 已成功保存的关联会保留，剩余更改可重试。`;
  } finally {
    if (!disposed) saving.value = false;
  }
}
watch(
  [() => props.kbId, () => props.baseUrl],
  () => {
    picker.value = false;
    void load();
  },
  { immediate: true },
);
onUnmounted(() => {
  disposed = true;
  request++;
});
</script>
<template>
  <div class="knowledge-section-head">
    <div>
      <h2>关联应用</h2>
      <p>允许 Agent 在回答问题时检索此知识库。</p>
    </div>
    <el-button :disabled="loading || saving" icon="Plus" @click="picker = true"
      >添加关联</el-button
    >
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"
    ><el-button v-if="!changed" text @click="load"
      >重新加载</el-button
    ></el-alert
  >
  <div v-loading="loading">
    <article
      v-for="agent in selected"
      :key="agent.id"
      class="knowledge-document-row"
    >
      <el-icon class="knowledge-document-icon"><User /></el-icon>
      <div class="knowledge-document-main">
        <h3>{{ agent.name }}</h3>
        <p class="knowledge-muted">{{ agent.description || "Agent 应用" }}</p>
      </div>
      <el-button
        text
        :disabled="saving"
        @click="selectedIds = selectedIds.filter((id) => id !== agent.id)"
        >解除关联</el-button
      >
    </article>
    <el-empty
      v-if="!selected.length && !loading"
      description="尚未关联 Agent"
      :image-size="72"
      ><p class="knowledge-muted">关联现有 Agent 后，它就能使用这里的资料。</p>
      <el-button @click="picker = true">选择 Agent</el-button></el-empty
    >
  </div>
  <div class="knowledge-save-bar">
    <span class="knowledge-muted">{{
      changed ? "有未保存的更改" : "关联更改不会影响 Agent 的其他知识库。"
    }}</span
    ><el-button
      type="primary"
      :loading="saving"
      :disabled="!changed || loading"
      @click="save"
      >保存更改</el-button
    >
  </div>
  <el-dialog
    v-model="picker"
    title="选择 Agent"
    width="min(560px, calc(100vw - 32px))"
    ><el-input
      v-model="query"
      clearable
      placeholder="搜索 Agent"
      aria-label="搜索 Agent"
    /><el-checkbox-group
      v-model="selectedIds"
      :disabled="saving"
      class="knowledge-agent-options"
      ><el-checkbox v-for="a in filtered" :key="a.id" :value="a.id">{{
        a.name
      }}</el-checkbox></el-checkbox-group
    ><el-empty
      v-if="!agents.length"
      description="请先在 Agent 工作台创建 Agent"
      :image-size="64"
    /><template #footer
      ><el-button type="primary" @click="picker = false"
        >完成选择</el-button
      ></template
    ></el-dialog
  >
</template>
