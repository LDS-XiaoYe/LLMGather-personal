<script setup lang="ts">
import WorkspaceFeedback from './WorkspaceFeedback.vue';
defineProps<{ title?: string; app: Record<string, any> }>();
</script>
<template>
  <header v-if="title" class="ui-page-heading">
    <h1 class="ui-page-title">{{ title }}</h1>
    <div class="header-left ui-header-controls"><slot /></div>
    <div class="header-right ui-page-status"><slot name="status" /></div>
    <WorkspaceFeedback :app="app" />
  </header>
  <WorkspaceFeedback v-else :app="app" />
</template>
