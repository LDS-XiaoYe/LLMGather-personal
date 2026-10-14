<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { applyBailianModels, bailianCredentialRequest, previewBailianModels, type BailianCredentialStatus, type BailianSyncPreview, type ProviderConfigRow } from '../api';

const props = withDefaults(defineProps<{ baseUrl?: string; configs: ProviderConfigRow[] }>(), { baseUrl: '/v1' });
const emit = defineEmits<{ synced: [] }>();
const dialog = ref(false), loading = ref(false), saving = ref(false), error = ref('');
const preview = ref<BailianSyncPreview | null>(null);
const selectedKeys = ref<string[]>([]), changeFilter = ref('all'), search = ref('');
const form = ref({ region: 'cn-beijing', workspaceId: '', apiKey: '', rememberKey: true, saveKey: true, removeMissing: true });
const credential = ref<BailianCredentialStatus>({ remembered: false }), credentialLoading = ref(false);
const forgettingKey = ref(false);
let credentialRequest = 0;
const regions = [
  { value: 'cn-beijing', label: '北京' }, { value: 'ap-southeast-1', label: '新加坡' },
  { value: 'cn-hongkong', label: '中国香港' }, { value: 'ap-northeast-1', label: '东京' },
  { value: 'eu-central-1', label: '法兰克福' }, { value: 'us-east-1', label: '弗吉尼亚' },
];
const requiresWorkspace = computed(() => !['cn-beijing', 'ap-southeast-1', 'cn-hongkong'].includes(form.value.region));
const busy = computed(() => loading.value || saving.value || forgettingKey.value);
const changes = computed(() => preview.value?.providers.flatMap(p => p.changes.map(c => ({ ...c, providerId: p.id, provider: p.displayName, key: JSON.stringify([p.id, c.id, c.action]) }))) || []);
const selected = computed(() => changes.value.filter(c => selectedKeys.value.includes(c.key)));
const counts = computed(() => ({ added: selected.value.filter(c => c.action === 'added').length, removed: selected.value.filter(c => c.action === 'removed').length }));
const visibleChanges = computed(() => {
  const query = search.value.trim().toLowerCase();
  return changes.value.filter(c => (changeFilter.value === 'all' || c.action === changeFilter.value) && (!query || `${c.id} ${c.name} ${c.provider}`.toLowerCase().includes(query)));
});
const visibleSelected = computed(() => visibleChanges.value.filter(c => selectedKeys.value.includes(c.key)).length);
const changeRowKey = (row: { key: string }) => row.key;
const providerSummary = computed(() => preview.value?.providers.map(p => {
  const chosen = selected.value.filter(c => c.providerId === p.id), added = chosen.filter(c => c.action === 'added').length, removed = chosen.filter(c => c.action === 'removed').length;
  return { ...p, added, removed, afterCount: p.beforeCount + added - removed };
}) || []);
function toggleSelected(key: string, checked: boolean) {
  if (busy.value) return;
  selectedKeys.value = checked ? [...new Set([...selectedKeys.value, key])] : selectedKeys.value.filter(k => k !== key);
}
function selectVisible(checked: boolean) {
  if (busy.value) return;
  const keys = visibleChanges.value.map(c => c.key);
  selectedKeys.value = checked ? [...new Set([...selectedKeys.value, ...keys])] : selectedKeys.value.filter(k => !keys.includes(k));
}
watch(preview, value => {
  // Addition candidates start selected; deletions always require a deliberate selection.
  selectedKeys.value = value ? changes.value.filter(c => c.action === 'added').map(c => c.key) : [];
  changeFilter.value = 'all'; search.value = '';
});

function open() {
  const host = props.configs.map(c => { try { return new URL(c.baseUrl).hostname; } catch { return ''; } }).find(h => h.includes('maas.aliyuncs.com') || h === 'dashscope.aliyuncs.com' || h === 'dashscope-intl.aliyuncs.com' || h === 'cn-hongkong.dashscope.aliyuncs.com');
  const dedicated = host?.match(/^([a-zA-Z0-9-]+)\.(cn-beijing|ap-southeast-1|cn-hongkong|ap-northeast-1|eu-central-1|us-east-1)\.maas\.aliyuncs\.com$/);
  form.value = { region: dedicated?.[2] || (host === 'dashscope-intl.aliyuncs.com' ? 'ap-southeast-1' : host === 'cn-hongkong.dashscope.aliyuncs.com' ? 'cn-hongkong' : 'cn-beijing'), workspaceId: dedicated?.[1] || '', apiKey: '', rememberKey: true, saveKey: true, removeMissing: true };
  preview.value = null; error.value = ''; dialog.value = true;
}
// Changing any input invalidates the preview; a confirmation must apply exactly the displayed options.
watch(form, () => { preview.value = null; error.value = ''; }, { deep: true });
function clearSecret() { form.value.apiKey = ''; preview.value = null; }
watch(() => [dialog.value, form.value.region, form.value.workspaceId.trim().toLowerCase()], async () => {
  const request = ++credentialRequest;
  credential.value = { remembered: false }; credentialLoading.value = false;
  form.value.apiKey = '';
  if (!dialog.value || (requiresWorkspace.value && !form.value.workspaceId.trim())) return;
  credentialLoading.value = true;
  try {
    const status = await bailianCredentialRequest('status', { region: form.value.region, workspaceId: form.value.workspaceId.trim() }, props.baseUrl);
    if (request === credentialRequest && dialog.value) credential.value = status;
  } catch (e) { if (request === credentialRequest && dialog.value) error.value = e instanceof Error ? e.message : '读取已保存 Key 状态失败，请手动输入后重试'; }
  finally { if (request === credentialRequest) credentialLoading.value = false; }
});
async function forgetKey() {
  if (busy.value || credentialLoading.value || !credential.value.remembered) return;
  try { await ElMessageBox.confirm('仅移除此管理员在当前地域／业务空间记住的同步 Key，不删除服务商调用密钥。', '忘记 Key', { type: 'warning', confirmButtonText: '忘记 Key', cancelButtonText: '取消' }); }
  catch { return; }
  if (busy.value) return;
  forgettingKey.value = true; error.value = '';
  try {
    credential.value = await bailianCredentialRequest('forget', { region: form.value.region, workspaceId: form.value.workspaceId.trim() }, props.baseUrl);
    clearSecret(); ElMessage.success('已忘记同步 Key');
  } catch (e) { error.value = e instanceof Error ? e.message : '移除已保存 Key 失败'; }
  finally { forgettingKey.value = false; }
}
async function fetchPreview() {
  if (busy.value || credentialLoading.value) return;
  const apiKey = form.value.apiKey.trim();
  if (!apiKey && !credential.value.remembered) { error.value = '请填写此地域的百炼 API Key'; return; }
  if (requiresWorkspace.value && !form.value.workspaceId.trim()) { error.value = '请填写业务空间 ID'; return; }
  loading.value = true; error.value = ''; preview.value = null;
  try {
    preview.value = await previewBailianModels({ ...form.value, workspaceId: form.value.workspaceId.trim(), apiKey: apiKey || undefined }, props.baseUrl);
    if (preview.value.credential) credential.value = preview.value.credential;
  }
  catch (e) { error.value = e instanceof Error ? e.message : '读取模型目录失败'; }
  finally { loading.value = false; }
}
async function sync() {
  if (busy.value || !preview.value) return;
  if (!selected.value.length) { error.value = '请至少选择一个要新增或删除的模型'; return; }
  saving.value = true; error.value = '';
  try {
    const selections = selected.value.map(c => ({ providerId: c.providerId, modelId: c.id, action: c.action }));
    const result = await applyBailianModels(preview.value.previewId, selections, props.baseUrl);
    dialog.value = false;
    ElMessage.success(`同步完成：新增 ${result.added} 个，移除 ${result.removed} 个`);
    for (const warning of result.warnings) ElMessage.warning(warning);
    emit('synced');
  } catch (e) {
    error.value = e instanceof Error && e.name === 'TimeoutError' ? '请求超时，请刷新服务商列表确认保存结果，再重新获取预览' : e instanceof Error ? e.message : '同步失败';
    preview.value = null;
  } finally { saving.value = false; }
}
</script>

<template>
  <el-button :icon="Refresh" @click="open">同步百炼模型</el-button>
  <el-dialog v-model="dialog" title="同步百炼模型" class="bailian-sync-dialog" width="min(920px, calc(100vw - 32px))"
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @closed="clearSecret">
    <p class="sync-intro">从阿里云官方 API 获取最新目录，更新现有百炼服务商的聊天与视觉模型。</p>
    <el-form :disabled="busy" label-position="top" @submit.prevent="fetchPreview">
      <div class="sync-fields">
        <el-form-item label="地域"><el-select v-model="form.region"><el-option v-for="r in regions" :key="r.value" :label="r.label" :value="r.value" /></el-select></el-form-item>
        <el-form-item :label="requiresWorkspace ? '业务空间 ID' : '业务空间 ID（可选）'"><el-input v-model="form.workspaceId" placeholder="默认空间可留空" autocomplete="off" /></el-form-item>
        <el-form-item label="百炼 API Key" class="sync-key">
          <el-input v-model="form.apiKey" type="password" show-password :placeholder="credential.remembered ? `已记住 ${credential.keyPrefix}，留空复用；输入新 Key 可替换` : '填写对应地域的 API Key'" autocomplete="new-password" />
          <div v-if="credential.remembered" class="sync-remembered"><span>已记住 Key {{ credential.keyPrefix }}，下次无需重新输入。</span><el-button link type="danger" :disabled="busy || credentialLoading" @click="forgetKey">忘记 Key</el-button></div>
          <div v-else-if="credentialLoading" class="sync-note">正在检查已保存的 Key…</div>
          <div class="sync-key-guide">
            <a href="https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key" target="_blank" rel="noopener noreferrer">前往百炼获取 API Key ↗</a>
            <span>登录后选择与本页一致的地域，在 API Key 页面创建或复制密钥，再粘贴到这里。</span>
            <a href="https://help.aliyun.com/zh/model-studio/get-api-key/" target="_blank" rel="noopener noreferrer">查看官方指引</a>
          </div>
        </el-form-item>
      </div>
      <div class="sync-options">
        <el-checkbox v-model="form.rememberKey">记住 Key（成功获取预览后保存，下次自动复用）</el-checkbox>
        <el-checkbox v-model="form.saveKey">将此 Key 加入同步服务商的调用密钥（已有相同 Key 不重复添加）</el-checkbox>
        <el-checkbox v-model="form.removeMissing">列出本地域官方目录中已不存在的旧模型，供选择删除</el-checkbox>
      </div>
    </el-form>
    <div class="sync-note">仅执行勾选的变更，未勾选的模型保持不变。目录缺失不等同于全球下架；现有计费、分层和路由规则保持不变。</div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="sync-alert" />
    <section v-if="preview" class="sync-preview">
      <div class="sync-summary"><strong>已选变更</strong><span>新增 {{ counts.added }} 个 · 删除 {{ counts.removed }} 个</span></div>
      <div class="sync-selection-toolbar">
        <el-radio-group v-model="changeFilter" size="small" :disabled="busy"><el-radio-button value="all">全部</el-radio-button><el-radio-button value="added">新增</el-radio-button><el-radio-button value="removed">删除</el-radio-button></el-radio-group>
        <el-input v-model="search" size="small" clearable placeholder="搜索模型或服务商" :disabled="busy" />
      </div>
      <p class="sync-note">新增默认勾选，删除默认不勾选。表头复选框仅全选／取消当前筛选结果。</p>
      <el-table :data="visibleChanges" :row-key="changeRowKey" size="small" max-height="320" empty-text="没有符合筛选条件的模型">
        <el-table-column width="44" align="center">
          <template #header><el-checkbox :model-value="visibleChanges.length > 0 && visibleSelected === visibleChanges.length" :indeterminate="visibleSelected > 0 && visibleSelected < visibleChanges.length" :disabled="busy || !visibleChanges.length" aria-label="选择当前筛选模型" @change="selectVisible(Boolean($event))" /></template>
          <template #default="{ row }"><el-checkbox :model-value="selectedKeys.includes(row.key)" :disabled="busy" :aria-label="`${row.action === 'added' ? '新增' : '删除'} ${row.id}（${row.provider}）`" @change="toggleSelected(row.key, Boolean($event))" /></template>
        </el-table-column>
        <el-table-column label="变更" width="70"><template #default="{ row }"><el-tag size="small" :type="row.action === 'added' ? 'success' : 'danger'">{{ row.action === 'added' ? '新增' : '删除' }}</el-tag></template></el-table-column>
        <el-table-column label="模型" min-width="210"><template #default="{ row }"><div class="sync-model-id">{{ row.id }}</div><small>{{ row.name }} · {{ row.provider }}</small></template></el-table-column>
        <el-table-column label="说明" min-width="160"><template #default="{ row }">{{ row.reason }}<div v-if="row.action === 'added'"><small>{{ row.capabilities.join(' / ') }}<span v-if="row.contextWindow"> · {{ row.contextWindow.toLocaleString() }} tokens</span></small></div></template></el-table-column>
      </el-table>
      <el-collapse v-if="changes.length" class="sync-details">
        <el-collapse-item title="查看各服务商同步后的模型数" name="summary">
      <el-table :data="providerSummary" size="small" max-height="200">
        <el-table-column prop="displayName" label="服务商" min-width="140" />
        <el-table-column label="模型数" min-width="95"><template #default="{ row }">{{ row.beforeCount }} → {{ row.afterCount }}</template></el-table-column>
        <el-table-column prop="added" label="新增" width="70" />
        <el-table-column prop="removed" label="删除" width="70" />
      </el-table>
        </el-collapse-item>
      </el-collapse>
      <p v-if="preview.skipped.length" class="sync-note">保持不变：{{ preview.skipped.map(p => p.displayName).join('、') }}</p>
      <p class="sync-note">预览有效期 10 分钟。记住的 Key 加密保存在服务器，不写入 .env。取消不修改模型，已记住的 Key 仍保留。</p>
    </section>
    <template #footer>
      <div class="sync-footer"><el-button :disabled="busy" @click="dialog = false">取消</el-button>
        <el-button v-if="!preview" type="primary" :loading="loading" :disabled="busy || credentialLoading" @click="fetchPreview">获取同步预览</el-button>
        <template v-else><el-button :disabled="busy" @click="fetchPreview">重新获取</el-button><el-button type="primary" :loading="saving" :disabled="loading || !selected.length" @click="sync">确认同步（新增 {{ counts.added }} / 删除 {{ counts.removed }}）</el-button></template>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.bailian-sync-dialog) { display: flex; flex-direction: column; max-height: calc(100dvh - 48px); margin: 24px auto; }
:global(.bailian-sync-dialog .el-dialog__body) { min-height: 0; overflow-y: auto; }
:global(.bailian-sync-dialog .el-dialog__header), :global(.bailian-sync-dialog .el-dialog__footer) { flex-shrink: 0; }
.sync-intro { margin: 0 0 20px; color: var(--el-text-color-regular); }
.sync-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 16px; }
.sync-key { grid-column: 1 / -1; }
.sync-remembered { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--el-color-success); }
.sync-key-guide { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 12px; line-height: 1.7; color: var(--el-text-color-secondary); }
.sync-key-guide a { color: var(--el-color-primary); text-decoration: none; }
.sync-key-guide a:hover { text-decoration: underline; }
.sync-selection-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.sync-selection-toolbar :deep(.el-input) { flex: 1; min-width: 160px; }
.sync-fields :deep(.el-select) { width: 100%; }
.sync-options { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.sync-options :deep(.el-checkbox) { height: auto; min-height: 28px; white-space: normal; align-items: flex-start; }
.sync-options :deep(.el-checkbox__input) { margin-top: 5px; }
.sync-options :deep(.el-checkbox__label) { line-height: 24px; }
.sync-note, .sync-preview small { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.7; }
.sync-alert, .sync-preview { margin-top: 16px; }
.sync-summary { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.sync-details { margin-top: 12px; }
.sync-model-id { overflow-wrap: anywhere; color: var(--el-text-color-primary); }
.sync-footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.sync-footer :deep(.el-button + .el-button) { margin-left: 0; }
@media (max-width: 540px) { .sync-fields { grid-template-columns: minmax(0, 1fr); } .sync-key { grid-column: auto; } }
</style>
