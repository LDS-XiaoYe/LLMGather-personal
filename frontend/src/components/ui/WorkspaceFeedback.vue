<script setup lang="ts">
import { computed, ref, unref, watch } from 'vue';
const props = defineProps<{ app: Record<string, any> }>();
const scope = unref(props.app.pageMode);
const message = ref('');
const warning = computed(() => /轮转/.test(message.value));
watch(() => unref(props.app.status), (text: unknown) => {
  message.value = '';
  if (unref(props.app.pageMode) !== scope || typeof text !== 'string') return;
  // Do not carry another workspace's execution status into this header.
  if (/Agent/.test(text) && scope !== 'agent') return;
  if (/知识库/.test(text) && scope !== 'rag' && scope !== 'admin') return;
  if (/失败|错误|异常|不足|未配置|不能为空|轮转|重试|error|failed|unauthorized|fetch/i.test(text)) message.value = text;
});
</script>
<template><span v-if="message" class="ui-header-feedback" :class="{ 'is-warning': warning }" :role="warning ? 'status' : 'alert'" :title="message">{{ message.length > 180 ? message.slice(0, 180) + '…' : message }}</span></template>
