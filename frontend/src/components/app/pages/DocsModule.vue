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

const Cpu = bind(app, 'Cpu');
const ChatDotRound = bind(app, 'ChatDotRound');
const DataAnalysis = bind(app, 'DataAnalysis');
const Document = bind(app, 'Document');
const Headset = bind(app, 'Headset');
const Lightning = bind(app, 'Lightning');
const Monitor = bind(app, 'Monitor');
const Setting = bind(app, 'Setting');
const TrendCharts = bind(app, 'TrendCharts');
const UserFilled = bind(app, 'UserFilled');
const VideoCamera = bind(app, 'VideoCamera');
const models = bind(app, 'models');
const getModelTags = bind(app, 'getModelTags');
</script>

<template>
        <div class="page-header">
          <div class="header-left"><strong>功能文档</strong></div>
          <div class="header-right">
            <el-tag size="small" type="info">v1.0</el-tag>
          </div>
        </div>
        <div class="thread" style="flex:1;max-width:900px;margin:0 auto;width:100%;padding:24px 16px">

          <!-- Hero -->
          <div style="text-align:center;padding:32px 20px 24px">
            <el-icon :size="48" color="#8b5cf6"><Cpu /></el-icon>
            <h1 style="margin:12px 0 6px;font-size:28px;font-weight:800;color:#1e293b">LLM Gather</h1>
            <p style="color:#64748b;font-size:15px;max-width:600px;margin:0 auto">大模型 API 聚合平台 — 统一接入多家 AI 厂商模型，提供智能路由、协同推理、语义缓存、多模态融合等能力</p>
          </div>

          <!-- Feature Cards Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px">

            <!-- Chat -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="ChatDotRound" style="background:#3b82f6" />
                  <strong>聊天 Chat</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>与 AI 模型对话，支持 Markdown 渲染、代码高亮、思考过程展示。</p>
                <p><el-tag size="small" type="danger">Auto 智能路由</el-tag> LLM 分析意图 → 自动选模型</p>
                <p>流式 SSE 输出 · 会话管理 · 云端同步</p>
              </div>
            </el-card>

            <!-- Battle -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Lightning" style="background:#f59e0b" />
                  <strong>对战 Battle</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>双模型并发回答，左右分栏实时对比。</p>
                <p>随机/指定模型 · 并行流式输出</p>
                <p>展示思考过程 · 自动保存结果</p>
              </div>
            </el-card>

            <!-- Collab -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="TrendCharts" style="background:#8b5cf6" />
                  <strong>协同推理 Collab</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>多模型深度协同，三种模式：</p>
                <p><el-tag size="small">辩论</el-tag> <el-tag size="small" type="warning">评审</el-tag> <el-tag size="small" type="success">分工</el-tag></p>
                <p>模型选择 · 迭代优化 · 汇总合成</p>
              </div>
            </el-card>

            <!-- Group -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="UserFilled" style="background:#22c55e" />
                  <strong>群聊 Group</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>所有模型依次发言，参考前文回复。</p>
                <p>完整对话历史作为上下文</p>
                <p>支持中途停止</p>
              </div>
            </el-card>

            <!-- Vision -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Monitor" style="background:#ec4899" />
                  <strong>视觉理解 Vision</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>上传图片让视觉模型分析识别。</p>
                <p>多图支持 · 模型记忆 · 流式回复</p>
              </div>
            </el-card>

            <!-- TTS -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Headset" style="background:#ef4444" />
                  <strong>语音生成 TTS</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>文字转语音，8 种发音人可选。</p>
                <p>风格标签 · 唱歌模式 · 历史记录</p>
              </div>
            </el-card>

            <!-- Multimodal -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="VideoCamera" style="background:#6366f1" />
                  <strong>多模态 Beta</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>自动驾驶仿真 · 视频理解 · 图文检索 · 多模态对话</p>
                <p>多图+音频+视频输入 · AI 驾驶决策</p>
              </div>
            </el-card>

            <!-- Console -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="DataAnalysis" style="background:#10b981" />
                  <strong>控制台 Console</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>账户余额 · 用量趋势图 · 定价表</p>
                <p>消费流水 · 支付宝充值</p>
              </div>
            </el-card>

            <!-- Admin -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Setting" style="background:#6b7280" />
                  <strong>管理后台 Admin</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>用户管理 · 计费管理 · 模型统计</p>
                <p>Provider 配置 · 系统设置 · 热加载</p>
              </div>
            </el-card>

            <!-- API -->
            <el-card shadow="hover">
              <template #header>
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="28" :icon="Document" style="background:#2563eb" />
                  <strong>API 用法</strong>
                </div>
              </template>
              <div style="font-size:13px;line-height:1.7;color:#475569">
                <p>OpenAI 兼容接口 /v1/chat/completions</p>
                <p>API Key + JWT 双认证</p>
                <p>curl · Python · JavaScript 示例</p>
              </div>
            </el-card>
          </div>

          <!-- Core Tech Section -->
          <el-card shadow="never" style="margin-bottom:16px">
            <template #header><strong>核心技术特性</strong></template>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;font-size:13px;color:#475569">
              <div><strong>🤖 智能路由</strong><br/>LLM 意图分类 → 选模型，额外延迟 &lt;1s</div>
              <div><strong>💾 语义缓存</strong><br/>Jaccard+Levenshtein 相似度匹配</div>
              <div><strong>🧠 协同推理</strong><br/>辩论/评审/分工 三种模式</div>
              <div><strong>🎯 多模态融合</strong><br/>视频关键帧 · 多图对话</div>
              <div><strong>💰 计费系统</strong><br/>按 token·分档定价·流式扣费</div>
              <div><strong>🔄 Provider 热加载</strong><br/>管理后台修改即时生效</div>
              <div><strong>🔐 双认证</strong><br/>JWT + API Key (sk-xxx)</div>
              <div><strong>🌙 暗色模式</strong><br/>全页面暗色主题适配</div>
              <div><strong>🐳 Docker</strong><br/>MySQL+NestJS+Vue3 一键部署</div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header><strong>架构</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569;font-family:monospace">
              <div>前端 Vue3 → api.ts → /v1/chat/completions</div>
              <div style="margin-left:16px">→ ChatController (ApiKeyOrJwtGuard)</div>
              <div style="margin-left:32px">→ RouterService (model='auto' → LLM 分类 → 选模型)</div>
              <div style="margin-left:32px">→ ChatService → ProviderRegistry → OpenAI Compatible</div>
              <div style="margin-left:32px">→ CacheService (语义缓存查/存)</div>
            </div>
          </el-card>

          <!-- Smart Routing Detail -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>🤖 Auto 智能路由工作原理</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569">
              <p>当你选择 <el-tag size="small" type="danger">Auto</el-tag> 模型发送消息时：</p>
              <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:8px 0;font-family:monospace;font-size:12px">
                <div>1. 提取用户消息文本 → 发给 <strong>qwen-turbo</strong> 做意图分类</div>
                <div style="margin-left:16px">分类 prompt: "Classify into: coding/translation/creative/reasoning/vision/summary/data/general"</div>
                <div style="margin-left:16px">→ LLM 返回: e.g. "coding"</div>
                <div>2. 查路由规则表 (router_rules) → coding → [deepseek-v4-pro, deepseek-v4-flash, qwen-plus]</div>
                <div>3. 过滤到实际可用模型 → 选第一个 (deepseek-v4-pro)</div>
                <div>4. 后端用 deepseek-v4-pro 执行原始请求 → 返回流式输出</div>
                <div>5. 聊天界面显示路由状态: <el-tag size="small" type="danger">Auto</el-tag> → <el-tag size="small" type="warning">编程开发</el-tag> deepseek-v4-pro</div>
              </div>
              <p>额外延迟仅约 <strong>0.5-1秒</strong>（分类模型调用）。路由规则可在管理后台编辑。</p>
            </div>
          </el-card>

          <!-- Available Models -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>接入的模型厂商 (Provider)</strong></template>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;font-size:13px">
              <div v-for="m in models" :key="m.id" style="padding:6px 10px;background:#f8fafc;border-radius:6px;display:flex;align-items:center;gap:6px">
                <el-tag size="small" :type="getModelTags(m.id).includes('vision') ? 'warning' : getModelTags(m.id).includes('audio') ? 'success' : ''">{{ m.owned_by }}</el-tag>
                <span style="font-size:12px;color:#475569">{{ m.id }}</span>
              </div>
              <div v-if="models.length === 0" style="color:#909399;padding:12px">登录后自动加载模型列表</div>
            </div>
          </el-card>

          <!-- Quick Start -->
          <el-card shadow="never" style="margin-top:16px">
            <template #header><strong>快速开始</strong></template>
            <div style="font-size:13px;line-height:1.8;color:#475569">
              <p><strong>1.</strong> 注册/登录账号（支持邮箱验证码注册）</p>
              <p><strong>2.</strong> 聊天页选择 <el-tag size="small" type="danger">Auto</el-tag> 或指定模型，开始对话</p>
              <p><strong>3.</strong> 尝试 <strong>对战</strong> — 两个模型 PK 同一问题</p>
              <p><strong>4.</strong> 尝试 <strong>协同推理</strong> — 多模型协作输出最优答案</p>
              <p><strong>5.</strong> 上传图片到 <strong>视觉理解</strong>，让 AI 看图说话</p>
              <p><strong>6.</strong> 进入 <strong>多模态 Beta</strong> — 体验自动驾驶仿真和视频分析</p>
              <p><strong>7.</strong> 在 <strong>控制台</strong> 查看用量、通过支付宝充值</p>
              <p><strong>8.</strong> 在 <strong>API 用法</strong> 页面创建 API Key，通过 OpenAI 兼容接口调用</p>
            </div>
          </el-card>

        </div>
</template>
