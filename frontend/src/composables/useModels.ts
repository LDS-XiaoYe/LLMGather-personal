import { watch } from 'vue';
import { fetchModels, getStoredToken, type ModelDescriptor } from '../api';
import { authUser, models, selectedModel, isLoadingModels, status } from './state';
import { getStoredValue, setStoredValue } from '../utils';

function getModelStorageKey(): string {
  return authUser.value ? `llmgather_model_${authUser.value.id}` : '';
}

function restoreSelectedModel(): void {
  const key = getModelStorageKey();
  if (key) {
    const saved = getStoredValue(key);
    if (saved) selectedModel.value = saved;
  }
}

function persistSelectedModel(): void {
  const key = getModelStorageKey();
  if (key) setStoredValue(key, selectedModel.value);
}

watch(selectedModel, () => { persistSelectedModel(); });

export function useModels() {
  async function loadModels(baseUrl: string) {
    if (!getStoredToken()) {
      models.value = [];
      status.value = '请先登录以加载模型';
      return;
    }

    isLoadingModels.value = true;
    status.value = '正在加载模型列表';
    try {
      const data = await fetchModels(baseUrl);
      models.value = data;
      restoreSelectedModel();
      if (data.length > 0 && !data.some((m) => m.id === selectedModel.value)) {
        selectedModel.value = data[0].id;
      }
      status.value = `已加载 ${data.length} 个模型`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : '加载模型失败';
    } finally {
      isLoadingModels.value = false;
    }
  }

  return { models, selectedModel, isLoadingModels, status, loadModels };
}
