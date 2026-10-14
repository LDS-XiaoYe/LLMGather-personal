<script setup lang="ts">
import type { KnowledgeBase } from "../../api";
defineProps<{
  bases: KnowledgeBase[];
  total: number;
  loading: boolean;
  query: string;
  error: string;
}>();
const emit = defineEmits<{
  open: [id: string, tab?: "documents" | "retrieval" | "settings"];
  create: [];
  library: [];
  retry: [];
  "update:query": [value: string];
}>();
const date = (value: string) =>
  value ? new Date(value).toLocaleDateString("zh-CN") : "—";
</script>
<template>
  <header class="knowledge-heading">
    <div>
      <h1>知识库</h1>
      <p>让 AI 基于你的专属知识回答问题</p>
    </div>
    <div class="knowledge-actions">
      <el-button @click="emit('library')">用户文件库</el-button
      ><el-button type="primary" :icon="'Plus'" @click="emit('create')"
        >新建知识库</el-button
      >
    </div>
  </header>
  <div class="knowledge-toolbar">
    <el-input
      :model-value="query"
      clearable
      prefix-icon="Search"
      placeholder="搜索知识库名称或描述"
      aria-label="搜索知识库"
      @update:model-value="emit('update:query', $event)"
    /><span>{{ total }} 个知识库</span>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"
    ><el-button text @click="emit('retry')">重新加载</el-button></el-alert
  >
  <el-skeleton v-if="loading && !total" :rows="5" animated />
  <div v-else-if="bases.length" class="knowledge-grid">
    <article v-for="kb in bases" :key="kb.id" class="knowledge-base-card">
      <div class="knowledge-card-head">
        <el-icon class="knowledge-folder"><FolderOpened /></el-icon
        ><el-dropdown trigger="click" @command="emit('open', kb.id, $event)"
          ><el-button
            text
            circle
            :aria-label="`${kb.name}的更多操作`"
            icon="MoreFilled"
          /><template #dropdown
            ><el-dropdown-menu
              ><el-dropdown-item command="documents">管理文档</el-dropdown-item
              ><el-dropdown-item command="retrieval">测试检索</el-dropdown-item
              ><el-dropdown-item command="settings"
                >知识库设置</el-dropdown-item
              ></el-dropdown-menu
            ></template
          ></el-dropdown
        >
      </div>
      <a
        class="knowledge-card-link"
        :href="`#/knowledge/${encodeURIComponent(kb.id)}/documents`"
        ><h2>{{ kb.name }}</h2>
        <p>{{ kb.description || "添加文档，为 AI 提供可靠的知识来源。" }}</p></a
      >
      <div class="knowledge-card-stats">
        <span>{{ kb.documentCount }} 文档</span
        ><span>{{ kb.chunkCount }} 片段</span>
      </div>
      <footer>
        <span
          >{{ kb.documentCount ? "已添加内容" : "待添加文档" }} ·
          {{ kb.provider === "ragflow" ? "RAGFlow" : "本地知识库" }}</span
        ><time :datetime="kb.updatedAt">{{ date(kb.updatedAt) }}</time>
      </footer>
    </article>
  </div>
  <el-empty
    v-else
    :description="query ? '没有找到匹配的知识库' : '创建你的第一个知识库'"
    :image-size="96"
    ><p v-if="!query" class="knowledge-muted">
      上传资料，测试检索，再关联 Agent。
    </p>
    <el-button v-if="!query" type="primary" @click="emit('create')"
      >创建第一个知识库</el-button
    ><el-button v-else @click="emit('update:query', '')"
      >清除搜索</el-button
    ></el-empty
  >
</template>
