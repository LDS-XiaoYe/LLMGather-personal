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
