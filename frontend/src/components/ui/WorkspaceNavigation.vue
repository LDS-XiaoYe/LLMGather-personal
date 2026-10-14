<script setup lang="ts">
import { computed, unref } from 'vue';
import { ChatDotRound, Star, Document, MagicStick, Lightning, UserFilled, TrendCharts, Headset, PictureFilled, DataAnalysis, Setting, Cpu, Guide } from '@element-plus/icons-vue';
const props = defineProps<{ app: Record<string, any> }>();
const emit = defineEmits<{ navigate: [] }>();
const value = (key: string) => unref(props.app[key]);
const current = computed(() => value('pageMode'));
const tools = [{ mode: 'battle', label: '对战', icon: Lightning }, { mode: 'group', label: '群组', icon: UserFilled }, { mode: 'collab', label: '协同推理', icon: TrendCharts }, { mode: 'tts', label: '语音生成', icon: Headset }, { mode: 'multimodal', label: '全模态 Beta', icon: PictureFilled }];
function navigate(mode: string) { unref(props.app.switchPage)?.(mode); emit('navigate'); }
</script>
<template>
  <el-menu class="aside-menu workspace-navigation" :default-active="current" :background-color="value('menuBgColor')" :text-color="value('menuTextColor')" :active-text-color="value('menuActiveColor')" @select="navigate" aria-label="主要导航">
    <el-menu-item index="chat"><el-icon><ChatDotRound /></el-icon><span>聊天</span></el-menu-item>
    <el-menu-item index="agent"><el-icon><Star /></el-icon><span>Agent 工作台</span></el-menu-item>
    <el-menu-item index="rag"><el-icon><Document /></el-icon><span>知识库</span></el-menu-item>
    <el-sub-menu index="toolbox"><template #title><el-icon><MagicStick /></el-icon><span>玩具箱</span></template>
      <el-menu-item v-for="item in tools" :key="item.mode" :index="item.mode"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
      <el-sub-menu index="more-tools"><template #title>更多工具</template>
        <el-menu-item index="vision"><el-icon><Cpu /></el-icon><span>图像理解</span></el-menu-item>
        <el-menu-item index="router"><el-icon><Guide /></el-icon><span>智能路由</span></el-menu-item>
      </el-sub-menu>
    </el-sub-menu>
    <el-menu-item index="console"><el-icon><DataAnalysis /></el-icon><span>控制台</span></el-menu-item>
    <el-menu-item index="api"><el-icon><Document /></el-icon><span>API 用法</span></el-menu-item>
    <el-menu-item v-if="value('isAdmin')" index="admin"><el-icon><Setting /></el-icon><span>管理后台</span></el-menu-item>
  </el-menu>
</template>
