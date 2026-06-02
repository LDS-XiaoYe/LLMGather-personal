import { ref } from 'vue';
import {
  createApiKey as apiCreateApiKey,
  listApiKeys,
  revokeApiKey as apiRevokeApiKey,
} from '../api';
import { apiKeys, authUser, status } from './state';

const apiKeyLoading = ref(false);

export function useApiKeys() {
  async function loadApiKeys(baseUrl: string) {
    if (!authUser.value) return;
    try {
      const keys = await listApiKeys(baseUrl);
      apiKeys.value = keys.map((k) => ({ id: k.id, name: k.name, maskedKey: k.key, createdAt: k.createdAt }));
    } catch (e) { console.error('[loadApiKeys] failed:', e); }
  }

  async function createApiKey(baseUrl: string) {
    apiKeyLoading.value = true;
    try {
      const result = await apiCreateApiKey(`Key ${apiKeys.value.length + 1}`, baseUrl);
      apiKeys.value.push({
        id: result.id, name: result.name, maskedKey: result.key,
        fullKey: result.rawKey ?? result.key, createdAt: result.createdAt,
      });
    } catch (error) {
      status.value = error instanceof Error ? error.message : '创建 API Key 失败';
    } finally {
      apiKeyLoading.value = false;
    }
  }

  async function revokeApiKey(id: string, baseUrl: string) {
    try {
      await apiRevokeApiKey(id, baseUrl);
      apiKeys.value = apiKeys.value.filter((k) => k.id !== id);
    } catch (error) {
      status.value = error instanceof Error ? error.message : '删除 API Key 失败';
    }
  }

  return { apiKeys, apiKeyLoading, loadApiKeys, createApiKey, revokeApiKey };
}
