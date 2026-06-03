<script setup lang="ts">
import AppShell from './components/app/AppShell.vue';
import { useAppController } from './app/useAppController';

const app = useAppController();
</script>

<template>
  <AppShell :app="app" />
</template>

<style>
@import './styles.css';
</style>
