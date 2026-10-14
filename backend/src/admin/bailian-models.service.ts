import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ProviderApiKeyStore, ProviderConfig } from '../providers/provider-api-key.store';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { SystemSettingsService } from '../common/system-settings.service';
import { validateSettingValue } from '../common/setting-validation';
import { BailianCredentialScopeDto, BailianModelSelectionDto, PreviewBailianModelsDto } from './bailian-models.dto';
import { seal, unseal } from '../workflows/runtime/persistence-codec';

interface CatalogModel {
  model: string; name?: string; provider: string; inference_provider: string;
  capabilities: string[]; features?: string[];
  inference_metadata?: { request_modality?: string[]; response_modality?: string[] };
  model_info?: { context_window?: number | null };
  inference_offline_info?: Record<string, { offline_time?: string }>;
}
export interface BailianModelChange {
  id: string; name: string; action: 'added' | 'removed'; reason: string;
  capabilities: string[]; contextWindow: number | null;
}
export interface BailianProviderPlan {
  id: string; providerName: string; displayName: string; beforeCount: number; afterCount: number;
  added: number; removed: number; changes: BailianModelChange[];
}
export interface BailianPreview {
  previewId: string; expiresAt: string; endpoint: string; catalogCount: number;
  providers: BailianProviderPlan[]; skipped: Array<{ displayName: string; reason: string }>;
  credential?: { remembered: boolean; keyPrefix?: string };
}
interface Pending {
  owner: string; expires: number; preview: BailianPreview; configHash: string;
  updates: Array<{ id: string; providerName: string; models: string }>;
  tags: Record<string, string[]>; apiKey?: string; applying: boolean;
  credentialId?: string;
}

const AUTHORS: Record<string, string[]> = {
  qwen: ['qwen'], glm: ['zhipu-ai'], deepseek: ['deepseek'], kimi: ['moonshot-ai'],
  minimax: ['mini-max'], 'xiaomi-mimo': ['xiaomi'], gui: ['qwen-domain-model'],
};
const splitModels = (value: string) => [...new Set(value.split(',').map(m => m.trim()).filter(Boolean))];
const hashConfigs = (configs: ProviderConfig[]) => createHash('sha256').update(JSON.stringify([...configs].sort((a, b) => a.id.localeCompare(b.id)).map(c =>
  [c.id, c.providerName, c.displayName, c.baseUrl, c.models, c.modelPrefix, c.authHeader, c.authPrefix, c.timeoutMs, c.retryCount, c.enabled, c.createdAt, c.updatedAt]))).digest('hex');

/** Only fixed official hosts receive the credential. Model changes remain confirmation-only. */
export function bailianEndpoint(region: string, workspaceId = ''): string {
  if (workspaceId && !/^[a-zA-Z0-9-]{1,128}$/.test(workspaceId)) throw new BadRequestException('业务空间 ID 格式无效');
  const hosts: Record<string, string> = {
    'cn-beijing': 'dashscope.aliyuncs.com', 'ap-southeast-1': 'dashscope-intl.aliyuncs.com',
    'cn-hongkong': 'cn-hongkong.dashscope.aliyuncs.com',
  };
  if (!['cn-beijing', 'ap-southeast-1', 'cn-hongkong', 'ap-northeast-1', 'eu-central-1', 'us-east-1'].includes(region)) throw new BadRequestException('地域无效');
  if (!workspaceId && !hosts[region]) throw new BadRequestException('此地域需要填写业务空间 ID');
  return `https://${workspaceId ? `${workspaceId}.${region}.maas.aliyuncs.com` : hosts[region]}/api/v1/models`;
}

function belongsToRegion(config: ProviderConfig, region: string, workspaceId = ''): boolean {
  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || !/^\/compatible-mode\/v1\/?$/.test(url.pathname)) return false;
    const legacy: Record<string, string> = { 'dashscope.aliyuncs.com': 'cn-beijing', 'dashscope-intl.aliyuncs.com': 'ap-southeast-1', 'cn-hongkong.dashscope.aliyuncs.com': 'cn-hongkong', 'dashscope-us.aliyuncs.com': 'us-east-1' };
    return legacy[url.hostname] === region || Boolean(workspaceId && url.hostname === `${workspaceId}.${region}.maas.aliyuncs.com`);
  } catch { return false; }
}

export function offline(model: CatalogModel, now: number): boolean {
  for (const item of Object.values(model.inference_offline_info || {})) {
    // API timestamps without an offset use Beijing time, not the backend machine's timezone.
    const value = item?.offline_time;
    if (typeof value !== 'string') continue;
    const date = Date.parse(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(value) ? value.replace(' ', 'T') + '+08:00' : value);
    if (Number.isFinite(date) && date <= now) return true;
  }
  return false;
}

function chatCompatible(model: CatalogModel): boolean {
  return model.capabilities.some(c => ['TG', 'Reasoning', 'VU'].includes(c))
    && (model.inference_metadata?.response_modality || []).includes('Text')
    && !model.capabilities.some(c => c.startsWith('Realtime'));
}
function authorMatches(config: ProviderConfig, model: CatalogModel): boolean {
  if (['bailian', 'aliyun', 'dashscope', 'alibaba'].includes(config.providerName)) return true;
  // The domain-model author includes embedding and other models; GUI belongs to its own existing group.
  if (config.providerName === 'gui') return model.provider === 'qwen-domain-model' && model.model.startsWith('gui-');
  return (AUTHORS[config.providerName] || [config.providerName]).includes(model.provider);
}

@Injectable()
export class BailianModelsService {
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly db: DatabaseService, private readonly keys: ProviderApiKeyStore,
    private readonly registry: ProviderRegistryService, private readonly settings: SystemSettingsService) {}

  private credentialScope(owner: string, input: BailianCredentialScopeDto) {
    const workspace = (input.workspaceId || '').trim().toLowerCase();
    bailianEndpoint(input.region, workspace);
    return { id: createHash('sha256').update(JSON.stringify([owner, input.region, workspace])).digest('hex'), owner, region: input.region, workspace };
  }

  async credentialStatus(owner: string, input: BailianCredentialScopeDto) {
    const scope = this.credentialScope(owner, input);
    const row = await this.db.connection.prepare('SELECT key_prefix FROM bailian_sync_credentials WHERE id=? AND owner_id=?').get(scope.id, owner);
    return row ? { remembered: true, keyPrefix: String(row.key_prefix) } : { remembered: false };
  }

  async forgetCredential(owner: string, input: BailianCredentialScopeDto) {
    const scope = this.credentialScope(owner, input);
    await this.db.connection.prepare('DELETE FROM bailian_sync_credentials WHERE id=? AND owner_id=?').run(scope.id, owner);
    for (const [id, pending] of this.pending) if (pending.owner === owner && pending.credentialId === scope.id && !pending.applying) this.pending.delete(id);
    return { remembered: false };
  }

  private async savedKey(owner: string, input: BailianCredentialScopeDto): Promise<string> {
    const scope = this.credentialScope(owner, input);
    const row = await this.db.connection.prepare('SELECT key_cipher FROM bailian_sync_credentials WHERE id=? AND owner_id=?').get(scope.id, owner);
    if (!row) throw new BadRequestException('此地域／业务空间尚未记住 Key，请先填写');
    try {
      const value = unseal<{ owner: string; region: string; workspace: string; apiKey: string }>(String(row.key_cipher));
      if (value.owner !== owner || value.region !== scope.region || value.workspace !== scope.workspace || typeof value.apiKey !== 'string' || !/^\S{1,512}$/.test(value.apiKey)) throw new Error();
      return value.apiKey;
    } catch { throw new BadRequestException('已保存的 Key 读取失败，请重新输入并记住，或移除已保存的 Key'); }
  }

  private async rememberCredential(owner: string, input: BailianCredentialScopeDto, apiKey: string) {
    const scope = this.credentialScope(owner, input), keyPrefix = '***' + apiKey.slice(-4);
    let encrypted: string;
    try { encrypted = seal({ owner, region: scope.region, workspace: scope.workspace, apiKey }); }
    catch { throw new ServiceUnavailableException('读取目录成功，但密钥加密配置异常；可取消记住 Key 后重试'); }
    try {
      await this.db.connection.prepare('INSERT INTO bailian_sync_credentials (id,owner_id,region,workspace_id,key_cipher,key_prefix,updated_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE key_cipher=VALUES(key_cipher),key_prefix=VALUES(key_prefix),updated_at=VALUES(updated_at)')
        .run(scope.id, owner, scope.region, scope.workspace, encrypted, keyPrefix, this.db.now());
    } catch { throw new ServiceUnavailableException('读取目录成功，但记住 Key 失败，请重试；模型配置未修改'); }
    return { remembered: true, keyPrefix };
  }

  private prune() {
    for (const [id, pending] of this.pending) if (pending.expires <= Date.now() && !pending.applying) this.pending.delete(id);
  }

  private async fetchCatalog(endpoint: string, apiKey: string): Promise<CatalogModel[]> {
    const models: CatalogModel[] = [], seen = new Set<string>();
    let total: number | undefined;
    const signal = AbortSignal.timeout(55000);
    for (let page = 1; page <= 100; page++) {
      const url = new URL(endpoint);
      url.searchParams.set('page_no', String(page)); url.searchParams.set('page_size', '100');
      // Fetch the entire directory first: a partial or filtered response must never remove local models.
      let response: Response, payload: any;
      try {
        response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal, redirect: 'error' });
        const body = await response.text();
        if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error();
        payload = JSON.parse(body);
      } catch { throw new BadGatewayException('读取百炼目录失败，请检查网络后重试；现有配置未修改'); }
      if (!response.ok || payload.success !== true || payload.code) {
        if ([401, 403].includes(response.status)) throw new BadRequestException('百炼 Key 无效或没有此地域／业务空间的访问权限');
        throw new BadGatewayException(`百炼目录请求失败（HTTP ${response.status}）；现有配置未修改`);
      }
      const output = payload.output;
      if (!output || !Number.isInteger(output.total) || output.total < 1 || output.total > 10000
        || output.page_no !== page || !Array.isArray(output.models) || output.models.length < 1 || output.models.length > 100
        || (total !== undefined && total !== output.total)) throw new BadGatewayException('百炼目录为空或分页发生变化，请重新获取；现有配置未修改');
      total = output.total;
      for (const model of output.models) {
        if (!model || typeof model.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(model.model)
          || typeof model.provider !== 'string' || typeof model.inference_provider !== 'string'
          || !Array.isArray(model.capabilities) || model.capabilities.some((c: unknown) => typeof c !== 'string')) throw new BadGatewayException('百炼模型信息格式异常；现有配置未修改');
        const identity = model.inference_provider + ':' + model.model;
        if (seen.has(identity)) throw new BadGatewayException('百炼分页包含重复模型，请重新获取；现有配置未修改');
        seen.add(identity); models.push(model);
      }
      if (models.length === total) return models;
      if (models.length > output.total) break;
    }
    throw new BadGatewayException('百炼目录分页不完整；现有配置未修改');
  }

  async preview(owner: string, input: PreviewBailianModelsDto): Promise<BailianPreview> {
    this.prune();
    if (this.pending.size >= 100) throw new ConflictException('待确认的同步任务过多，请稍后重试');
    const endpoint = bailianEndpoint(input.region, input.workspaceId);
    const configs = await this.keys.listConfigs();
    const eligible = configs.filter(c => belongsToRegion(c, input.region, input.workspaceId));
    if (!eligible.length) throw new BadRequestException('没有匹配此地域的百炼兼容服务商，请检查服务商端点或切换地域');
    const typedKey = input.apiKey?.trim() || '';
    const apiKey = typedKey || await this.savedKey(owner, input);
    const catalog = await this.fetchCatalog(endpoint, apiKey);
    // The marketplace also lists external inference providers: they cannot run through DashScope.
    const official = catalog.filter(m => ['aliyun-bailian', 'alibaba-cloud-modelstudio'].includes(m.inference_provider));
    if (!official.length) throw new BadGatewayException('目录未返回百炼推理模型；现有配置未修改');
    const byId = new Map(official.map(m => [m.model, m])), now = Date.now();
    const tags: Record<string, string[]> = Object.create(null);
    const updates: Pending['updates'] = [], providers: BailianProviderPlan[] = [];
    for (const config of eligible) {
      const previous = splitModels(config.models), next = new Set(previous), changes: BailianModelChange[] = [];
      for (const id of previous) {
        const model = byId.get(id);
        const reason = model && offline(model, now) ? '官方已下线' : !model && input.removeMissing ? '本地域百炼目录中已不存在' : '';
        if (reason) { next.delete(id); changes.push({ id, name: model?.name || id, action: 'removed', reason, capabilities: model?.capabilities || [], contextWindow: model?.model_info?.context_window ?? null }); }
      }
      for (const model of official) {
        if (!authorMatches(config, model) || !chatCompatible(model) || offline(model, now)) continue;
        if (!next.has(model.model)) { next.add(model.model); changes.push({ id: model.model, name: model.name || model.model, action: 'added', reason: '官方聊天／视觉模型', capabilities: model.capabilities, contextWindow: model.model_info?.context_window ?? null }); }
        const capabilities = ['language'];
        if (model.capabilities.includes('VU') || model.inference_metadata?.request_modality?.some(m => ['Image', 'Video'].includes(m))) capabilities.push('vision');
        tags[model.model] = capabilities;
      }
      const models = [...next].join(',');
      if (Buffer.byteLength(models) > 65535) throw new BadGatewayException('模型列表超过配置容量；现有配置未修改');
      updates.push({ id: config.id, providerName: config.providerName, models });
      providers.push({ id: config.id, providerName: config.providerName, displayName: config.displayName, beforeCount: previous.length, afterCount: next.size,
        added: changes.filter(c => c.action === 'added').length, removed: changes.filter(c => c.action === 'removed').length, changes });
    }
    const previewId = randomUUID(), expires = now + 10 * 60 * 1000;
    const preview: BailianPreview = { previewId, expiresAt: new Date(expires).toISOString(), endpoint, catalogCount: catalog.length, providers,
      skipped: configs.filter(c => !eligible.includes(c)).map(c => ({ displayName: c.displayName, reason: '非所选地域的百炼兼容端点' })) };
    if (typedKey && input.rememberKey) preview.credential = await this.rememberCredential(owner, input, typedKey);
    // One active preview per administrator; no complete credentials in responses, logs, localStorage, or .env.
    for (const [id, pending] of this.pending) if (pending.owner === owner && !pending.applying) this.pending.delete(id);
    this.pending.set(previewId, { owner, expires, preview, configHash: hashConfigs(configs), updates, tags, ...(input.saveKey ? { apiKey } : {}), applying: false, credentialId: this.credentialScope(owner, input).id });
    setTimeout(() => {
      const pending = this.pending.get(previewId);
      if (pending && !pending.applying) this.pending.delete(previewId);
    }, 10 * 60 * 1000).unref();
    return preview;
  }

  async apply(owner: string, previewId: string, selections: BailianModelSelectionDto[]) {
    this.prune();
    const pending = this.pending.get(previewId);
    if (!pending || pending.owner !== owner) throw new NotFoundException('同步预览已过期，请重新获取');
    if (pending.applying) throw new ConflictException('此同步正在执行，请勿重复提交');
    if (!Array.isArray(selections) || !selections.length || selections.length > 10000) throw new BadRequestException('请至少选择一个模型变更');
    const allowed = new Set(pending.preview.providers.flatMap(p => p.changes.map(c => JSON.stringify([p.id, c.id, c.action]))));
    const seen = new Set<string>();
    for (const selection of selections) {
      const key = JSON.stringify([selection?.providerId, selection?.modelId, selection?.action]);
      if (!allowed.has(key) || seen.has(key)) throw new BadRequestException('所选模型变更无效或重复，请重新获取预览');
      seen.add(key);
    }
    const updates = pending.updates.filter(u => selections.some(s => s.providerId === u.id));
    const retained = new Set<string>();
    pending.applying = true;
    try {
      await this.db.transaction(async tx => {
        // Compare the full persisted snapshot under row locks, not just a millisecond timestamp.
        await tx.prepare('SELECT id FROM provider_configs ORDER BY id FOR UPDATE').all();
        // Use the transaction connection for the snapshot to avoid stale reads outside the lock.
        const rows = await tx.prepare('SELECT * FROM provider_configs ORDER BY created_at ASC').all();
        const current = rows.map(r => ({ id: r.id, providerName: r.provider_name, displayName: r.display_name, baseUrl: r.base_url, models: r.models,
          modelPrefix: r.model_prefix || null, authHeader: r.auth_header || 'Authorization', authPrefix: r.auth_prefix || 'Bearer', timeoutMs: Number(r.timeout_ms), retryCount: Number(r.retry_count), enabled: r.enabled === 1, createdAt: r.created_at, updatedAt: r.updated_at })) as ProviderConfig[];
        if (hashConfigs(current) !== pending.configHash) throw new ConflictException('服务商配置已变化，请重新获取同步预览');
        for (const update of updates) {
          const previous = current.find(c => c.id === update.id)!;
          const models = new Set(splitModels(previous.models));
          for (const selection of selections.filter(s => s.providerId === update.id)) {
            if (selection.action === 'added') models.add(selection.modelId);
            else models.delete(selection.modelId);
          }
          for (const model of models) retained.add(model);
          const value = [...models].join(',');
          if (Buffer.byteLength(value) > 65535) throw new BadRequestException('所选模型列表超过配置容量，请减少新增模型');
          if (previous.models !== value) await tx.prepare('UPDATE provider_configs SET models=?,updated_at=? WHERE id=?').run(value, this.db.now(), update.id);
          if (pending.apiKey) {
            const existing = await tx.prepare('SELECT id FROM provider_api_keys WHERE provider_name=? AND api_key=?').get(update.providerName, pending.apiKey);
            if (!existing) await tx.prepare('INSERT INTO provider_api_keys (id,provider_name,name,api_key,key_prefix,created_at) VALUES (?,?,?,?,?,?)')
              .run(randomUUID(), update.providerName, '百炼同步 Key', pending.apiKey, '***' + pending.apiKey.slice(-4), this.db.now());
          }
        }
        const row = await tx.prepare('SELECT value FROM system_settings WHERE `key`=? FOR UPDATE').get('model_tags');
        if (row) {
          const tags = JSON.parse(String(row.value));
          for (const [model, added] of Object.entries(pending.tags)) if (retained.has(model)) tags[model] = [...new Set([...(tags[model] || []), ...added])];
          const value = validateSettingValue('model_tags', JSON.stringify(tags));
          if (value !== row.value) await tx.prepare('UPDATE system_settings SET value=?,updated_at=? WHERE `key`=?').run(value, this.db.now(), 'model_tags');
        }
      });
      this.pending.delete(previewId);
      const warnings: string[] = [];
      for (const update of updates) {
        try { await this.keys.reloadPool(update.providerName); await this.registry.reloadProvider(update.providerName); }
        catch { warnings.push(`${update.providerName} 已保存，但运行时刷新失败，请重启后端`); }
      }
      try { await this.settings.reloadAll(); } catch { warnings.push('模型标签已保存，请重启后端刷新缓存'); }
      return { added: selections.filter(s => s.action === 'added').length, removed: selections.filter(s => s.action === 'removed').length,
        providers: updates.length, warnings };
    } finally { pending.applying = false; }
  }
}
