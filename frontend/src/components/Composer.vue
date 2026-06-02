<script setup lang="ts">
import { Delete, Promotion, SwitchButton } from '@element-plus/icons-vue';

const props = defineProps<{
  draft: string;
  isSubmitting: boolean;
  requestId: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:draft': [value: string];
  submit: [];
  stop: [];
  clear: [];
}>();

function onEnter() { if (!props.disabled) emit('submit'); }
</script>

<template>
  <div class="composer">
    <el-card class="composer-card" shadow="never">
      <el-input
        :model-value="draft"
        type="textarea"
        :rows="3"
        resize="vertical"
        :placeholder="placeholder || '给 LLM Gather 发送消息…'"
        :disabled="disabled"
        @update:model-value="(v: string) => emit('update:draft', v)"
        @keydown.enter.exact.prevent="onEnter()"
      />
      <div class="composer-bar">
        <div class="composer-meta">
          <el-text v-if="requestId" type="info" size="small">request id: {{ requestId }}</el-text>
        </div>
        <div class="composer-actions">
          <el-button :icon="Delete" @click="emit('clear')">清空</el-button>
          <el-button v-if="isSubmitting" type="danger" :icon="SwitchButton" @click="emit('stop')">停止</el-button>
          <el-button v-else type="primary" :icon="Promotion" @click="emit('submit')" :disabled="!draft.trim()">发送</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>
