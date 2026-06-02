<script setup lang="ts">
import { Cpu, User, Sunny } from '@element-plus/icons-vue';
import { renderMarkdown } from '../utils';
import type { ChatMessage } from '../types';

const props = defineProps<{ msg: ChatMessage; isStreaming?: boolean }>();
</script>

<template>
  <div class="chat-bubble" :class="{ 'is-user': msg.role === 'user' }">
    <el-avatar
      :size="36"
      :icon="msg.role === 'user' ? User : Cpu"
      :style="{ backgroundColor: msg.role === 'user' ? '#1677ff' : '#7b68ee', flexShrink: 0 }"
    />
    <div class="bubble-body">
      <div class="bubble-name">{{ msg.role === 'user' ? '你' : '助手' }}</div>

      <template v-if="msg.role === 'assistant'">
        <div class="assistant-content-stack">
          <details v-if="msg.reasoning" open class="reasoning-box">
            <summary><el-icon><Sunny /></el-icon> 思考过程</summary>
            <p>{{ msg.reasoning }}</p>
          </details>
          <div
            v-if="msg.content"
            class="markdown-content"
            :class="{ 'is-streaming-update': isStreaming }"
            v-html="renderMarkdown(msg.content)"
          ></div>
          <div v-else-if="isStreaming" class="streaming-placeholder">正在生成回复...</div>
        </div>
      </template>
      <template v-else>
        <p>{{ msg.content }}</p>
      </template>
    </div>
  </div>
</template>
