<script setup lang="ts">
import type { KnowledgeBase } from "../../api";
import KnowledgeEmbeddingSelector from "../KnowledgeEmbeddingSelector.vue";
defineProps<{ kb: KnowledgeBase; baseUrl: string }>();
const emit = defineEmits<{ changed: []; indexing: [value: boolean] }>();
</script>
<template>
  <div class="knowledge-section-head">
    <div>
      <h2>设置</h2>
      <p>管理知识来源、Embedding 模型与索引方式。</p>
    </div>
  </div>
  <section class="knowledge-settings-section">
    <h3>基础信息</h3>
    <dl class="knowledge-info">
      <dt>名称</dt>
      <dd>{{ kb.name }}</dd>
      <dt>描述</dt>
      <dd>{{ kb.description || "未填写" }}</dd>
      <dt>知识库引擎</dt>
      <dd>{{ kb.provider === "native" ? "本地知识库" : "RAGFlow" }}</dd>
    </dl>
    <p class="knowledge-muted">
      当前接口未提供名称、描述与引擎的修改操作，这些信息在创建时确定。
    </p>
  </section>
  <section v-if="kb.provider === 'native'" class="knowledge-settings-section">
    <h3>Embedding 模型</h3>
    <p class="knowledge-muted">
      绑定后自动重建索引，文档原文保留。模型部署与计算节点在管理后台“知识库模型”中管理。
    </p>
    <KnowledgeEmbeddingSelector
      :key="kb.id"
      :kb-id="kb.id"
      :model-value="kb.embeddingInstanceId || ''"
      :base-url="baseUrl"
      @changed="emit('changed')"
      @indexing="emit('indexing', $event)"
    />
  </section>
  <el-collapse
    ><el-collapse-item title="高级配置" name="advanced"
      ><dl class="knowledge-info" v-if="kb.provider === 'native'">
        <dt>文档分块</dt>
        <dd>
          固定长度 1,200 字符，重叠 160
          字符。由后端统一管理，当前不支持按知识库调整。
        </dd>
        <dt>检索</dt>
        <dd>关键词 / 向量 / 混合；Top K 与向量阈值在“检索测试”设置。</dd>
        <dt>索引</dt>
        <dd>更换模型时自动索引，状态自动更新。旧模型向量不会与新模型混用。</dd>
      </dl>
      <dl v-else class="knowledge-info">
        <dt>RAGFlow 地址</dt>
        <dd>{{ kb.engine?.baseUrl || "—" }}</dd>
        <dt>Dataset ID</dt>
        <dd>{{ kb.engine?.datasetId || kb.externalId || "—" }}</dd>
        <dt>API Key</dt>
        <dd>
          {{
            kb.engine?.apiKeyConfigured ? "已配置（不显示原始密钥）" : "未配置"
          }}
        </dd>
        <dt>分块与索引</dt>
        <dd>由 RAGFlow 数据集配置管理。</dd>
      </dl></el-collapse-item
    ></el-collapse
  >
  <section class="knowledge-settings-section">
    <h3>数据管理</h3>
    <p class="knowledge-muted">
      删除文档请在“文档”中操作，并确认删除。当前接口未提供知识库整体删除，不展示无效的删除按钮。
    </p>
  </section>
</template>
