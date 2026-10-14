<script setup lang="ts">
import { computed, isRef, unref } from 'vue';
import { Plus, Document, Star, MoreFilled, Delete } from '@element-plus/icons-vue';
const props = defineProps<{ app: Record<string, any> }>();
const emit = defineEmits<{ navigate: [] }>();
const value = (key: string) => unref(props.app[key]);
const call = (key: string, ...args: any[]) => unref(props.app[key])?.(...args);
const kind = computed(() => value('pageMode'));
const items = computed(() => kind.value === 'chat' ? value('sidebarSessions') ?? [] : value('agents') ?? []);
const current = computed(() => value(kind.value === 'chat' ? 'activeSessionId' : 'activeAgentId'));
const duplicates = computed(() => {
  const counts = new Map<string, number>();
  for (const item of items.value) { const name = String(item.title || item.name || ''); counts.set(name, (counts.get(name) ?? 0) + 1); }
  return counts;
});
function date(item: any) {
  const timestamp = item.updatedAt || item.createdAt;
  if (!timestamp) return '';
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function select(item: any) {
  if (kind.value === 'chat') { if (isRef(props.app.activeSessionId)) props.app.activeSessionId.value = item.id; else props.app.activeSessionId = item.id; }
  else call('selectAgent', item);
  emit('navigate');
}
function create() { call(kind.value === 'chat' ? 'createNewChat' : 'createAgentDraft'); emit('navigate'); }
function remove(item: any) { call(kind.value === 'chat' ? 'handleSoftDeleteSession' : 'removeAgent', kind.value === 'chat' ? item.id : item); }
</script>
<template>
  <section v-if="kind === 'chat' || kind === 'agent'" class="aside-sessions" :aria-label="kind === 'chat' ? '对话列表' : 'Agent 列表'">
    <el-button type="primary" plain :icon="Plus" class="new-chat-btn" @click="create">{{ kind === 'chat' ? '新建对话' : '新建 Agent' }}</el-button>
    <el-scrollbar class="session-list">
      <div v-for="item in items" :key="item.id" class="session-item" :class="{ active: current === item.id }">
        <button type="button" class="ui-session-select" :aria-pressed="current === item.id" :title="item.title || item.name" @click="select(item)">
          <el-icon :size="14"><component :is="kind === 'chat' ? Document : Star" /></el-icon><span class="ui-session-text"><span class="session-title">{{ item.title || item.name }}</span><small v-if="(duplicates.get(item.title || item.name) ?? 0) > 1 && date(item)">{{ date(item) }}</small></span>
        </button>
        <el-dropdown trigger="click" class="session-menu" @command="(cmd: string | number) => { if (cmd === 'delete') remove(item); }">
          <el-button text size="small" :icon="MoreFilled" class="ui-session-more" :aria-label="`${item.title || item.name}的更多操作`" />
          <template #dropdown><el-dropdown-menu><el-dropdown-item command="delete" :icon="Delete" class="ui-danger-text">{{ kind === 'chat' ? '删除会话' : '删除 Agent' }}</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </div>
      <el-empty v-if="kind === 'agent' && !value('agentLoading') && !items.length" description="还没有 Agent" :image-size="64" />
    </el-scrollbar>
  </section>
</template>
