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
const SwitchButton = bind(app, 'SwitchButton');
const formatTime = bind(app, 'formatTime');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const agents = bind(app, 'agents');
const apiKeys = bind(app, 'apiKeys');
const apiKeyLoading = bind(app, 'apiKeyLoading');
const apiKeyCreateDialog = bind(app, 'apiKeyCreateDialog');
const apiKeyNewName = bind(app, 'apiKeyNewName');
const errorCodes = bind(app, 'errorCodes');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isAuthenticated = bind(app, 'isAuthenticated');
const apiBaseUrl = bind(app, 'apiBaseUrl');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const openCreateApiKey = bind(app, 'openCreateApiKey');
const createApiKey = bind(app, 'createApiKey');
const revokeApiKey = bind(app, 'revokeApiKey');
const copyToClipboard = bind(app, 'copyToClipboard');
</script>

<template>
        <div class="page-header">
          <div class="header-left"><strong>API 用法</strong></div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
            <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
            <el-dropdown v-else trigger="click" @command="handleUserMenu">
              <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="console"><el-icon><DataAnalysis /></el-icon> 控制台</el-dropdown-item>
                  <el-dropdown-item v-if="userInvitationCode" disabled>
                    <span style="color:#666;">邀请码：{{ userInvitationCode }}</span>
                    <el-button size="small" style="margin-left:8px" @click.stop="copyToClipboard(userInvitationCode)">复制</el-button>
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            </template>
          </div>
        </div>

        <div class="api-docs-page">
          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <strong>中转 API Key</strong>
                <el-button type="primary" size="small" @click="openCreateApiKey()">创建新 Key</el-button>
              </div>
            </template>
            <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以管理 API Key" />
            <template v-else>
              <el-table :data="apiKeys" stripe size="small" v-if="apiKeys.length > 0">
                <el-table-column label="Key" min-width="320">
                  <template #default="{ row }">
                    <code style="font-size:12px;word-break:break-all">{{ row.maskedKey }}</code>
                    <el-button size="small" text type="primary" @click="copyToClipboard(row.fullKey || row.maskedKey)">复制</el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="name" label="名称" width="140" />
                <el-table-column label="创建时间" width="180">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-popconfirm title="确定要删除这个 API Key 吗？删除后使用该 Key 的请求将立即失败。" @confirm="revokeApiKey(row.id)">
                      <template #reference>
                        <el-button size="small" text type="danger">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="还没有 API Key，点击上方按钮创建" :image-size="64" />
            </template>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header><strong>快速开始</strong></template>
            <div class="api-info-grid">
              <div class="api-info-item"><span class="api-info-label">Base URL</span><code class="api-info-value">{{ apiBaseUrl }}</code></div>
              <div class="api-info-item"><span class="api-info-label">认证方式</span><span class="api-info-value">Header <code>Authorization: Bearer sk-xxxx</code></span></div>
              <div class="api-info-item"><span class="api-info-label">API Key</span><span class="api-info-value">上方创建的 Key，以 <code>sk-</code> 开头，可替代 JWT Token 用于中转接口</span></div>
            </div>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header><strong>接口索引</strong></template>
            <div class="api-index-grid">
              <a href="#api-chat">模型与聊天</a>
              <a href="#api-agent">Agent</a>
              <a href="#api-capabilities">能力资源</a>
              <a href="#api-orchestration">编排协作</a>
              <a href="#api-account">账户与计费</a>
              <a href="#api-admin">管理接口</a>
            </div>
          </el-card>

          <el-card id="api-chat" shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>OpenAI 兼容接口</strong><el-tag size="small" type="success">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/relay/openai/chat/completions</div>
            <div class="api-sub-title">cURL 示例</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/relay/openai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "glm-5.1",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'</pre>
            <div class="api-sub-title">Python SDK</div>
            <pre class="api-code-block">from openai import OpenAI

client = OpenAI(
    base_url="{{ apiBaseUrl }}/relay/openai",
    api_key="sk-your-api-key",
)

resp = client.chat.completions.create(
    model="glm-5.1",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)</pre>
          </el-card>

          <el-card id="api-agent" shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>Agent API</strong><el-tag size="small" type="primary">开发 / 调用</el-tag></div>
            </template>
            <div class="api-sub-title">开发管理接口使用登录 JWT；调用接口支持 API Key；公开调用不需要认证，但 Agent 必须开启公开发布和 API 接入。</div>
            <div class="api-sub-title">Agent 运行参数支持 <code>mode</code>、<code>contextStrategy</code>、<code>maxSteps</code>、<code>retryPolicy</code>、<code>approvedToolIds</code>。</div>
            <div class="api-endpoint">GET /v1/agents</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">GET /v1/agents/:id</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">POST /v1/agents</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "客服助手",
    "description": "回答产品和售后问题",
    "model": "glm-5.1",
    "systemPrompt": "你是专业客服助手。",
    "temperature": 0.4,
    "maxTokens": 1024,
    "memoryEnabled": true,
    "toolIds": [],
    "knowledgeBaseIds": [],
    "skillIds": []
  }'</pre>
            <div class="api-endpoint">PATCH /v1/agents/:id</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "客服助手 Pro",
    "systemPrompt": "你是专业客服助手。先确认问题，再给出可执行答案。",
    "temperature": 0.3,
    "maxTokens": 2048,
    "status": "active"
  }'</pre>
            <div class="api-endpoint">DELETE /v1/agents/:id</div>
            <pre class="api-code-block">curl -X DELETE {{ apiBaseUrl }}/agents/agent-id \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">POST /v1/agents/generate</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "requirement": "创建一个能结合知识库回答售后问题的客服 Agent",
    "model": "glm-5.1",
    "persist": true
  }'</pre>
            <div class="api-endpoint">PATCH /v1/agents/:id/publication</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/publication \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "published": true,
    "apiEnabled": true,
    "publicSlug": "support-agent"
  }'</pre>
            <div class="api-endpoint">POST /v1/agents/:id/invoke</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "input": "请根据知识库回答：如何申请退款？",
    "messages": [],
    "mode": "reflective",
    "contextStrategy": "balanced",
    "maxSteps": 6,
    "retryPolicy": {"maxRetries": 1, "retryToolFailure": true},
    "approvedToolIds": []
  }'</pre>
            <div class="api-endpoint">POST /v1/agents/:id/runs</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "input": "运行一次非流式 Agent 任务",
    "mode": "standard",
    "maxSteps": 4
  }'</pre>
            <div class="api-endpoint">POST /v1/agents/:id/runs/stream</div>
            <pre class="api-code-block">curl -N {{ apiBaseUrl }}/agents/agent-id/runs/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "input": "流式运行，并返回 Trace SSE 事件",
    "mode": "reflective"
  }'</pre>
            <div class="api-endpoint">POST /v1/public/agents/:slug/runs</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/public/agents/support-agent/runs \
  -H "Content-Type: application/json" \
  -d '{
    "input": "公开调用这个 Agent"
  }'</pre>
            <div class="api-endpoint">GET /v1/agents/:id/runs</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/runs \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">GET /v1/agents/runs/:runId</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/runs/run-id \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">POST /v1/agents/runs/:runId/evaluations</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/runs/run-id/evaluations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "expectedOutput": "应该说明退款入口、条件和处理时间",
    "rubric": "准确、可执行、语气友好",
    "mode": "hybrid"
  }'</pre>
            <div class="api-endpoint">GET /v1/agents/:id/evaluations · GET /v1/agents/:id/stats</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/evaluations \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agents/agent-id/stats \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">POST /v1/agents/:id/improvement-suggestions</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/improvement-suggestions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "recentRunLimit": 8,
    "judgeModel": "glm-5.1"
  }'</pre>
            <div class="api-endpoint">版本与测试集</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/agent-id/versions \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agents/agent-id/versions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"label":"上线前版本"}'

curl -X POST {{ apiBaseUrl }}/agents/agent-id/versions/version-id/restore \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agents/agent-id/test-suites \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agents/agent-id/test-suites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"客服回归测试","description":"退款、发票、物流"}'

curl {{ apiBaseUrl }}/agents/test-suites/suite-id/cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"退款问题","input":"如何退款？","expectedOutput":"退款条件和入口","rubric":"准确完整"}'

curl {{ apiBaseUrl }}/agents/test-suites/suite-id/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"evaluationMode":"hybrid","judgeModel":"glm-5.1"}'</pre>
            <div class="api-endpoint">模板、内置 Agent 与市场</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agents/builtin \
  -H "Authorization: Bearer your-jwt-token"

curl -X POST {{ apiBaseUrl }}/agents/builtin/research/install \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"model":"glm-5.1"}'

curl {{ apiBaseUrl }}/agents/marketplace/templates \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agents/marketplace/install \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"templateId":"template-id","model":"glm-5.1"}'</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>Anthropic 兼容接口</strong><el-tag size="small" type="warning">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/relay/anthropic/messages</div>
            <div class="api-sub-title">cURL 示例</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/relay/anthropic/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'</pre>
          </el-card>

          <el-card id="api-capabilities" shadow="never" class="api-section">
            <template #header><strong>能力资源 API</strong></template>
            <div class="api-sub-title">工具、知识库、记忆、Skill、MCP 都使用登录 JWT。Agent 运行时会根据绑定关系读取这些资源。</div>
            <div class="api-endpoint">Tools</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/tools \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/tools \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "json_formatter",
    "displayName": "JSON 格式化",
    "runtime": "javascript",
    "riskLevel": "low",
    "inputSchema": {"type":"object"},
    "code": "function run(input){ return { result: JSON.stringify(input, null, 2) } }"
  }'

curl {{ apiBaseUrl }}/tools/tool-id/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"args":{"hello":"world"}}'

curl {{ apiBaseUrl }}/tools/tool-id/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"args":{"hello":"world"}}'</pre>
            <div class="api-endpoint">Knowledge</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/knowledge/bases \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/knowledge/bases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"产品手册","description":"客服知识"}'

curl {{ apiBaseUrl }}/knowledge/bases/kb-id/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"title":"退款政策","content":"退款条件、入口、处理时间..."}'

curl {{ apiBaseUrl }}/knowledge/bases/kb-id/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"query":"如何退款","limit":5}'

curl {{ apiBaseUrl }}/knowledge/parse-file \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"filename":"manual.pdf","fileBase64":"data:application/pdf;base64,..."}'</pre>
            <div class="api-endpoint">Memory</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/memory \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/memory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"agentId":"agent-id","memoryType":"preference","content":"用户偏好简洁回答","importance":4}'

curl {{ apiBaseUrl }}/memory/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"agentId":"agent-id","query":"回答偏好","limit":5}'</pre>
            <div class="api-endpoint">Skills</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/skills \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"客服校验","description":"检查回答是否完整","content":"检查答案是否包含入口、条件、时间。"}'

curl {{ apiBaseUrl }}/skills/skill-id/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"input":"请检查这段客服回答"}'

curl {{ apiBaseUrl }}/skills/skill-id/bind-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"agentId":"agent-id"}'</pre>
            <div class="api-endpoint">MCP Servers</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/mcp/servers \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"Notion","serverType":"notion","config":{"token":"secret_xxx"},"enabled":true}'

curl {{ apiBaseUrl }}/mcp/servers/server-id/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"query":"test"}'</pre>
          </el-card>

          <el-card id="api-orchestration" shadow="never" class="api-section">
            <template #header><strong>编排与协作 API</strong></template>
            <div class="api-endpoint">Agent Teams</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/agent-teams \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/agent-teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "客服审核 Team",
    "strategy": "review",
    "members": [
      {"agentId":"agent-a","role":"回答"},
      {"agentId":"agent-b","role":"审核"}
    ]
  }'

curl {{ apiBaseUrl }}/agent-teams/team-id/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"input":"请处理这个客户问题"}'</pre>
            <div class="api-endpoint">Workflows</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/workflows \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "客服处理流程",
    "nodes": [
      {"id":"n1","type":"prompt","config":{"prompt":"整理用户问题"}},
      {"id":"n2","type":"agent","config":{"agentId":"agent-id","input":"{{input}}"}}
    ]
  }'

curl {{ apiBaseUrl }}/workflows/workflow-id/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"input":"客户说想退款"}'</pre>
            <div class="api-endpoint">协同推理</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/collab/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "mode": "compare",
    "models": ["glm-5.1", "deepseek-v4-pro"],
    "messages": [{"role":"user","content":"比较两个方案"}]
  }'</pre>
          </el-card>

          <el-card id="api-account" shadow="never" class="api-section">
            <template #header><strong>账户、Key 与计费 API</strong></template>
            <div class="api-endpoint">Auth</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

curl {{ apiBaseUrl }}/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"Passw0rd!","email":"user@example.com","verificationCode":"123456"}'

curl {{ apiBaseUrl }}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"Passw0rd!"}'

curl {{ apiBaseUrl }}/auth/me \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">API Keys</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/api-keys \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"name":"Production Key"}'

curl -X DELETE {{ apiBaseUrl }}/api-keys/key-id \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">Billing</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/billing/rules \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/billing/ledger \
  -H "Authorization: Bearer your-jwt-token"

curl {{ apiBaseUrl }}/billing/usage/daily \
  -H "Authorization: Bearer your-jwt-token"</pre>
            <div class="api-endpoint">Recharge</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/recharge/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"amount": 50}'

curl {{ apiBaseUrl }}/recharge/orders/order-id/check \
  -X POST \
  -H "Authorization: Bearer your-jwt-token"</pre>
          </el-card>

          <el-card id="api-admin" shadow="never" class="api-section">
            <template #header><strong>管理 API</strong></template>
            <div class="api-sub-title">以下接口需要管理员 JWT。</div>
            <div class="api-endpoint">系统统计与用户</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/admin/check \
  -H "Authorization: Bearer admin-jwt-token"

curl {{ apiBaseUrl }}/admin/stats \
  -H "Authorization: Bearer admin-jwt-token"

curl "{{ apiBaseUrl }}/admin/users?page=1&pageSize=20&search=demo" \
  -H "Authorization: Bearer admin-jwt-token"

curl {{ apiBaseUrl }}/admin/users/user-id \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-jwt-token" \
  -d '{"credits":100,"role":"user"}'</pre>
            <div class="api-endpoint">模型、供应商、设置</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/admin/provider-configs \
  -H "Authorization: Bearer admin-jwt-token"

curl {{ apiBaseUrl }}/admin/provider-keys \
  -H "Authorization: Bearer admin-jwt-token"

curl {{ apiBaseUrl }}/admin/settings \
  -H "Authorization: Bearer admin-jwt-token"

curl {{ apiBaseUrl }}/admin/model-tiers \
  -H "Authorization: Bearer admin-jwt-token"</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>视觉理解（Vision）</strong><el-tag size="small" type="warning">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/chat/completions</div>
            <div class="api-sub-title">与聊天接口相同，在 messages 中传入 image 类型的 content。支持 base64 编码图片和图片 URL。</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "qwen-vl-plus-latest",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "请描述这张图片"},
        {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
      ]
    }],
    "stream": false
  }'</pre>
            <div class="api-sub-title">或使用 base64 编码</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "qwen-vl-max-latest",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这是什么"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]
    }],
    "stream": false
  }'</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px"><strong>语音合成（TTS）</strong><el-tag size="small" type="success">POST</el-tag></div>
            </template>
            <div class="api-endpoint">POST /v1/tts</div>
            <div class="api-sub-title">将文本转为语音，返回音频文件。默认格式为 wav。</div>
            <pre class="api-code-block">curl {{ apiBaseUrl }}/tts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "mimo-v2.5-tts",
    "input": "你好，欢迎使用 LLMGather TTS 服务",
    "voice": "冰糖",
    "response_format": "wav"
  }' --output speech.wav</pre>
            <div class="api-sub-title">Python 示例</div>
            <pre class="api-code-block">import requests

resp = requests.post(
    "{{ apiBaseUrl }}/tts",
    headers={
        "Authorization": "Bearer sk-your-api-key",
        "Content-Type": "application/json",
    },
    json={
        "model": "mimo-v2.5-tts",
        "input": "你好，世界",
        "voice": "冰糖",
        "response_format": "wav",
    },
)
with open("output.wav", "wb") as f:
    f.write(resp.content)</pre>
          </el-card>

          <el-card shadow="never" class="api-section">
            <template #header><strong>错误码参考</strong></template>
            <el-table :data="errorCodes" stripe size="small">
              <el-table-column prop="status" label="状态码" width="80" />
              <el-table-column prop="code" label="类型" width="140" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </el-card>
        </div>

        <!-- Create API Key Dialog -->
        <el-dialog v-model="apiKeyCreateDialog" title="创建 API Key" width="420px">
          <el-form label-position="top">
            <el-form-item label="Key 名称">
              <el-input v-model="apiKeyNewName" placeholder="给 Key 取个名字" @keyup.enter="createApiKey()" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="apiKeyCreateDialog = false">取消</el-button>
            <el-button type="primary" :loading="apiKeyLoading" @click="createApiKey()">创建</el-button>
          </template>
        </el-dialog>
</template>
