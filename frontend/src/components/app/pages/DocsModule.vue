<script setup lang="ts">
import { unref } from 'vue';
import { ChatDotRound, Star, Document, PictureFilled, DataAnalysis, Connection } from '@element-plus/icons-vue';
import WorkspaceHeader from '../../ui/WorkspaceHeader.vue';
const props = defineProps<{ app: Record<string, any> }>();
const entries = [
  { title: '聊天', href: '#/chat', icon: ChatDotRound, description: '直接提问，选择模型，并查看回复与思考过程。' },
  { title: 'Agent 工作台', href: '#/agent', icon: Star, description: '配置能力、执行任务，查看工具调用与运行记录。' },
  { title: '知识库', href: '#/knowledge', icon: Document, description: '整理文档，测试知识召回，再关联到 Agent。' },
  { title: '全模态 Beta', href: '#/multimodal', icon: PictureFilled, description: '体验视频理解、图文检索、多模态对话与仿真。' },
  { title: '控制台', href: '#/console', icon: DataAnalysis, description: '查看账户余额、用量、计费规则和充值记录。' },
  { title: 'API 用法', href: '#/api', icon: Connection, description: '创建 API Key，查看接入示例与接口说明。' },
];
</script>
<template>
  <WorkspaceHeader title="功能说明" :app="props.app" />
  <section class="ui-docs-page" aria-label="功能指南">
    <div class="ui-help-intro"><h2>从这里开始</h2><p>按任务选择入口，技术细节在需要时展开。</p></div>
    <div class="ui-help-grid">
      <a v-for="entry in entries" :key="entry.href" :href="entry.href" class="ui-help-link">
        <el-icon :size="20"><component :is="entry.icon" /></el-icon><div><h3>{{ entry.title }}</h3><p>{{ entry.description }}</p></div>
      </a>
    </div>
    <section class="ui-help-questions">
      <h2>常见任务</h2>
      <details><summary>让 AI 使用自己的文档</summary><p>创建知识库，绑定可用的 Embedding 模型，再上传文档。处理完成后先测试检索，再关联 Agent。检索测试只验证知识召回，不生成最终回答。</p><a href="#/knowledge">打开知识库</a></details>
      <details><summary>选择聊天模型和回答模式</summary><p>聊天页可以指定模型，也可以选择智能路由。思考与直答用于选择回答方式；模型是否支持思考取决于当前服务商配置。回复中的思考过程可按需展开。</p><a href="#/chat">打开聊天</a></details>
      <details><summary>查看 Agent 的执行过程</summary><p>在 Agent 工作台切换到调用页，从历史选择运行记录。过程面板按真实步骤顺序展示输入、输出和异常。自动浏览不会重新执行模型或工具；重跑任务会先填入任务，确认后按当前配置运行新会话。</p><a href="#/agent">打开 Agent 工作台</a></details>
      <details><summary>比较多个模型的回答</summary><p>对战将同一个问题交给两个模型；群组让参与模型依次讨论；协同推理支持辩论、评审和分工。模型可用性与计费规则以当前平台配置为准。</p><a href="#/battle">模型对战</a> · <a href="#/group">群组讨论</a> · <a href="#/collab">协同推理</a></details>
      <details><summary>通过 API 接入</summary><p>在 API 用法中创建密钥并查看完整示例。中转调用使用 API Key，账户和资源管理接口使用登录认证。完整密钥仅创建时显示，请自行妥善保存。</p><a href="#/api">查看 API 用法</a></details>
      <details v-if="unref(props.app.isAdmin)"><summary>管理平台配置</summary><p>管理后台集中维护服务商、API Key、定价、知识库模型及系统配置。修改配置前请查看字段说明和保存状态。</p><a href="#/admin">打开管理后台</a></details>
    </section>
  </section>
</template>
