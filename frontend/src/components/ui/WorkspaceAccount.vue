<script setup lang="ts">
import { computed, isRef, ref, unref } from 'vue';
import { ArrowUp, DataAnalysis, SwitchButton, Setting } from '@element-plus/icons-vue';
const props = defineProps<{ app: Record<string, any> }>();
const emit = defineEmits<{ navigate: [] }>();
const menuOpen = ref(false);
const value = (key: string) => unref(props.app[key]);
const authenticated = computed(() => value('isAuthenticated'));
const user = computed(() => value('authUser'));
const call = (key: string, ...args: any[]) => unref(props.app[key])?.(...args);
function login() {
  if (isRef(props.app.isAuthDialogOpen)) props.app.isAuthDialogOpen.value = true;
  else props.app.isAuthDialogOpen = true;
  emit('navigate');
}
function command(key: string) {
  if (key === 'invitation') call('copyToClipboard', value('userInvitationCode'));
  else if (key === 'admin') call('switchPage', 'admin');
  else call('handleUserMenu', key);
  emit('navigate');
}
</script>
<template>
  <div class="ui-sidebar-account">
    <el-skeleton v-if="!value('isAuthLoaded')" class="ui-account-loading" :rows="0" animated />
    <el-button v-else-if="!authenticated" text class="ui-account-button" @click="login">
      <el-avatar :size="32">用</el-avatar>
      <span class="ui-account-name">登录 / 注册</span>
    </el-button>
    <el-dropdown v-else class="ui-account-dropdown" trigger="click" placement="top-start"
      :teleported="true" popper-class="ui-account-menu"
      @visible-change="menuOpen = $event" @command="command">
      <el-button text class="ui-account-button" :class="{ 'is-open': menuOpen }"
        :aria-label="`${user?.username || '账户'}的账户菜单`" :aria-expanded="menuOpen" aria-haspopup="menu">
        <el-avatar :size="32">{{ (user?.username || '用').charAt(0).toUpperCase() }}</el-avatar>
        <span class="ui-account-name">{{ user?.username || '账户' }}</span>
        <el-icon class="ui-account-chevron"><ArrowUp /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="console" :icon="DataAnalysis">账户与用量</el-dropdown-item>
          <el-dropdown-item v-if="value('isAdmin')" command="admin" :icon="Setting">管理后台</el-dropdown-item>
          <el-dropdown-item v-if="value('userInvitationCode')" command="invitation">复制邀请码</el-dropdown-item>
          <el-dropdown-item command="logout" divided :icon="SwitchButton">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
