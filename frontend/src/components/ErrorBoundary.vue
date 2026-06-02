<script setup lang="ts">
import { ref, onErrorCaptured, type Component } from 'vue';
import { ElButton, ElAlert } from 'element-plus';

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err: Error, _instance, _info) => {
  hasError.value = true;
  errorMessage.value = err.message || String(err);
  console.error('[ErrorBoundary] captured:', err);
  return false; // prevent propagation
});

function reset() {
  hasError.value = false;
  errorMessage.value = '';
}
</script>

<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary-fallback">
    <el-alert type="error" show-icon :closable="false" title="页面发生错误">
      <template #default>
        <p style="margin: 8px 0; font-family: monospace; font-size: 13px; word-break: break-all;">{{ errorMessage }}</p>
        <el-button type="primary" size="small" @click="reset">重试</el-button>
      </template>
    </el-alert>
  </div>
</template>

<style scoped>
.error-boundary-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: 200px;
}
</style>
