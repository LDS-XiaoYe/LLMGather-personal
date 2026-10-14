import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../auth/users.service';
import {
  ProviderApiKeyStore,
  ProviderApiKeyRow,
  ProviderConfig,
  ProviderConfigInput,
} from '../providers/provider-api-key.store';
import { ApiKeyPoolSnapshot } from '../providers/api-key-pool';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { SystemSettingsService } from '../common/system-settings.service';
import { AuthUser } from '../auth/auth.types';
import { modelMapping, price, record, validateSettingValue } from '../common/setting-validation';

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export interface AdminStats {
  totalUsers: number;
  totalRevenue: number;
  totalRequests: number;
  activeModels: number;
  newUsersToday: number;
  totalTokens: number;
}

export interface TodayStats {
  requests: number;
  revenue: number;
  tokens: number;
}

export interface ModelUsageStat {
  model: string;
  providerName: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  avgCost: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  role: string;
  credits: number;
  totalSpent: number;
  requestCount: number;
  createdAt: string;
  invitationCode: string;
}

export interface AdminBillingRow {
  id: string;
  userId: string;
  username: string;
  model: string;
  requestType: string;
  providerName: string;
  providerKeyId: string;
  providerKeyName: string;
  providerKeyPrefix: string;
  auditMetadata: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly apiKeyStore: ProviderApiKeyStore,
    private readonly usersService: UsersService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly settings: SystemSettingsService,
  ) {}

  async getStats(): Promise<AdminStats> {
    const db = this.databaseService.connection;

    const { total: totalUsers } = await db.prepare(
      'SELECT COUNT(*) as total FROM users',
    ).get() as { total: number };

    const { total: totalRevenue } = await db.prepare(
      'SELECT COALESCE(SUM(total_spent), 0) as total FROM users',
    ).get() as { total: number };

    const { total: totalRequests } = await db.prepare(
      'SELECT COUNT(*) as total FROM billing_ledger',
    ).get() as { total: number };

    // Count distinct models that appeared in billing_ledger recently
    const { count: activeModels } = await db.prepare(
      'SELECT COUNT(DISTINCT model) as count FROM billing_ledger',
    ).get() as { count: number };

    // New users today
    const todayStr = new Date().toISOString().slice(0, 10);
    const { total: newUsersToday } = await db.prepare(
      "SELECT COUNT(*) as total FROM users WHERE created_at >= ?",
    ).get(`${todayStr} 00:00:00.000`) as { total: number };

    const { total: totalTokens } = await db.prepare(
      'SELECT COALESCE(SUM(total_tokens), 0) as total FROM billing_ledger',
    ).get() as { total: number };

    return {
      totalUsers,
      totalRevenue: Number(totalRevenue),
      totalRequests,
      activeModels,
      newUsersToday,
      totalTokens: Number(totalTokens),
    };
  }

  async listUsers(page = 1, pageSize = 50, search?: string): Promise<{ data: AdminUserRow[]; total: number }> {
    const db = this.databaseService.connection;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: string[] = [];

    if (search) {
      whereClause = ' WHERE u.username LIKE ? OR u.email LIKE ?';
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    const { total } = await db.prepare(
      `SELECT COUNT(*) as total FROM users u${whereClause}`,
    ).get(...params) as { total: number };

    params.push(String(pageSize), String(offset));
    const rows = await db.prepare(
      `SELECT u.id, u.username, u.email, u.email_verified as emailVerified, u.role, u.credits, u.total_spent as totalSpent,
              u.created_at as createdAt, u.invitation_code as invitationCode,
              COALESCE(bc.req_count, 0) as requestCount
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as req_count FROM billing_ledger GROUP BY user_id) bc ON bc.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params) as Array<{
      id: string; username: string; email: string | null; emailVerified: number | string | boolean; role: string;
      credits: number; totalSpent: number; createdAt: string;
      invitationCode: string; requestCount: number;
    }>;

    return {
      data: rows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email || null,
        emailVerified: Number(r.emailVerified ?? 0) === 1 || r.emailVerified === true,
        role: r.role || 'user',
        credits: Number(r.credits),
        totalSpent: Number(r.totalSpent),
        requestCount: Number(r.requestCount),
        createdAt: r.createdAt,
        invitationCode: r.invitationCode || '',
      })),
      total: Number(total),
    };
  }

  async createUser(input: { username: string; password: string; email: string; role?: string; credits?: number; emailVerified?: boolean }): Promise<AdminUserRow> {
    const role = input.role === 'admin' ? 'admin' : 'user';
    const user = await this.usersService.createUser(input.username, input.password, input.email, undefined, {
      role,
      credits: input.credits,
      emailVerified: input.emailVerified ?? true,
    });
    return this.getAdminUserRow(user.id);
  }

  async updateUser(userId: string, updates: { credits?: number; role?: string; emailVerified?: boolean; expectedCredits?: number }): Promise<AdminUserRow> {
    const db = this.databaseService.connection;

    const user = await db.prepare(
      'SELECT id, username, email, email_verified as emailVerified, role, credits, total_spent as totalSpent, created_at as createdAt FROM users WHERE id = ?',
    ).get(userId) as unknown as AdminUserRow | undefined;

    if (!user) throw new NotFoundException('用户不存在');

    if (updates.credits !== undefined) price(updates.credits, 'credits');
    if (updates.role !== undefined && !['admin', 'user'].includes(updates.role)) throw new BadRequestException('无效的角色值');
    if (updates.emailVerified !== undefined && typeof updates.emailVerified !== 'boolean') throw new BadRequestException('无效的邮箱验证状态');
    await this.databaseService.transaction(async tx => {
      // Serialize role changes so concurrent requests cannot remove every administrator.
      const admins = updates.role !== undefined ? await tx.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id FOR UPDATE").all() : [];
      const current = await tx.prepare('SELECT id,role,credits FROM users WHERE id=? FOR UPDATE').get(userId);
      if (!current) throw new NotFoundException('用户不存在');
      if (current.role === 'admin' && updates.role === 'user' && admins.length <= 1) throw new ForbiddenException('至少保留一个管理员账户');
      if (updates.credits !== undefined && updates.expectedCredits !== undefined && Number(current.credits) !== updates.expectedCredits) throw new ConflictException('用户余额已变化，请刷新用户列表后重新编辑');
      if (updates.credits !== undefined) await tx.prepare('UPDATE users SET credits=? WHERE id=?').run(Number(updates.credits.toFixed(6)), userId);
      if (updates.role !== undefined) await tx.prepare('UPDATE users SET role=? WHERE id=?').run(updates.role, userId);
      if (updates.emailVerified !== undefined) await tx.prepare('UPDATE users SET email_verified=? WHERE id=?').run(updates.emailVerified ? 1 : 0, userId);
    });

    // Re-fetch with request count
    const updated = await db.prepare(
      `SELECT u.id, u.username, u.email, u.email_verified as emailVerified, u.role, u.credits, u.total_spent as totalSpent,
              u.created_at as createdAt, u.invitation_code as invitationCode,
              COALESCE(bc.req_count, 0) as requestCount
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as req_count FROM billing_ledger GROUP BY user_id) bc ON bc.user_id = u.id
       WHERE u.id = ?`,
    ).get(userId) as unknown as AdminUserRow;

    return {
      ...updated,
      emailVerified: Number(updated.emailVerified ?? 0) === 1 || updated.emailVerified === true,
      role: updated.role || 'user',
      credits: Number(updated.credits),
      totalSpent: Number(updated.totalSpent),
      requestCount: Number(updated.requestCount),
      invitationCode: updated.invitationCode || '',
    };
  }

  private async getAdminUserRow(userId: string): Promise<AdminUserRow> {
    const row = await this.databaseService.connection.prepare(
      `SELECT u.id, u.username, u.email, u.email_verified as emailVerified, u.role, u.credits, u.total_spent as totalSpent,
              u.created_at as createdAt, u.invitation_code as invitationCode,
              COALESCE(bc.req_count, 0) as requestCount
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as req_count FROM billing_ledger GROUP BY user_id) bc ON bc.user_id = u.id
       WHERE u.id = ?`,
    ).get(userId) as unknown as (AdminUserRow & { emailVerified: number | string | boolean }) | undefined;
    if (!row) throw new NotFoundException('用户不存在');
    return {
      ...row,
      email: row.email || null,
      emailVerified: Number(row.emailVerified ?? 0) === 1 || row.emailVerified === true,
      role: row.role || 'user',
      credits: Number(row.credits),
      totalSpent: Number(row.totalSpent),
      requestCount: Number(row.requestCount),
      invitationCode: row.invitationCode || '',
    };
  }

  async listBillingLedger(
    page = 1,
    pageSize = 50,
    filters?: { username?: string; model?: string; provider?: string; fromDate?: string; toDate?: string },
  ): Promise<{ data: AdminBillingRow[]; total: number }> {
    const db = this.databaseService.connection;
    const offset = (page - 1) * pageSize;
    const modelProviderMap = await this.buildModelProviderMap();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.username) {
      conditions.push('u.username LIKE ?');
      params.push(`%${filters.username}%`);
    }
    if (filters?.model) {
      conditions.push('bl.model = ?');
      params.push(filters.model);
    }
    if (filters?.provider) {
      conditions.push('bl.provider_name = ?');
      params.push(filters.provider);
    }
    if (filters?.fromDate) {
      conditions.push('bl.created_at >= ?');
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      conditions.push('bl.created_at <= ?');
      params.push(filters.toDate);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const { total } = await db.prepare(
      `SELECT COUNT(*) as total
       FROM billing_ledger bl
       LEFT JOIN users u ON u.id = bl.user_id
       ${whereClause}`,
    ).get(...params) as { total: number };

    params.push(pageSize, offset);
    const rows = await db.prepare(
      `SELECT bl.id, bl.user_id as userId, COALESCE(u.username, 'deleted') as username,
              bl.model, bl.request_type as requestType,
              bl.provider_name as providerName, bl.provider_key_id as providerKeyId,
              bl.provider_key_name as providerKeyName, bl.provider_key_prefix as providerKeyPrefix,
              bl.audit_metadata as auditMetadata,
              bl.prompt_tokens as promptTokens, bl.completion_tokens as completionTokens,
              bl.total_tokens as totalTokens, bl.cost, bl.created_at as createdAt
       FROM billing_ledger bl
       LEFT JOIN users u ON u.id = bl.user_id
       ${whereClause}
       ORDER BY bl.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params) as unknown as Array<AdminBillingRow>;

    return {
      data: rows.map((r) => ({
        ...r,
        providerName: r.providerName || modelProviderMap.get(r.model) || '',
        promptTokens: Number(r.promptTokens),
        completionTokens: Number(r.completionTokens),
        totalTokens: Number(r.totalTokens),
        cost: Number(r.cost),
      })),
      total: Number(total),
    };
  }

  async updateBillingRule(key: string, value: number, description?: string): Promise<{key: string; value: number; description: string}> {
    price(value, key);
    if (!['default_prompt_price_per_1k', 'default_completion_price_per_1k'].includes(key)) throw new NotFoundException('请通过定价映射页面管理此规则');
    await this.settings.mutateJSON('default_prices', current => ({...current, [key === 'default_prompt_price_per_1k' ? 'prompt' : 'completion']: value}));
    return {key, value, description: description || ''};
  }

  /** Simple check — returns true if the user has admin role */
  async isAdmin(userId: string): Promise<boolean> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT role FROM users WHERE id = ?',
    ).get(userId) as { role: string } | undefined;
    return row?.role === 'admin';
  }

  /* ──────── User management extensions ──────── */

  async deleteUser(userId: string): Promise<void> {
    const db = this.databaseService.connection;

    const user = await db.prepare(
      'SELECT id, role FROM users WHERE id = ?',
    ).get(userId) as { id: string; role: string } | undefined;

    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === 'admin') throw new ForbiddenException('不能删除管理员账户');

    await this.databaseService.transaction(async tx => {
      const current = await tx.prepare('SELECT id,role FROM users WHERE id=? FOR UPDATE').get(userId);
      if (!current) throw new NotFoundException('用户不存在');
      if (current.role === 'admin') throw new ForbiddenException('不能删除管理员账户');
      for (const table of ['billing_ledger','conversation_messages','conversations','api_keys']) await tx.prepare('DELETE FROM '+table+' WHERE user_id=?').run(userId);
      await tx.prepare('DELETE FROM bailian_sync_credentials WHERE owner_id=?').run(userId);
      await tx.prepare('DELETE FROM users WHERE id=?').run(userId);
    });
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    const db = this.databaseService.connection;
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
    if (!user) throw new NotFoundException('用户不存在');
    await this.usersService.resetPassword(userId, newPassword);
  }

  /* ──────── Model usage stats ──────── */

  async getModelUsageStats(): Promise<ModelUsageStat[]> {
    const db = this.databaseService.connection;

    // Build model → provider mapping from provider_configs
    const modelProviderMap = await this.buildModelProviderMap();

    const rows = await db.prepare(
      `SELECT model,
              COUNT(*) as requests,
              COALESCE(SUM(prompt_tokens), 0) as promptTokens,
              COALESCE(SUM(completion_tokens), 0) as completionTokens,
              COALESCE(SUM(total_tokens), 0) as totalTokens,
              COALESCE(SUM(cost), 0) as totalCost,
              COALESCE(AVG(cost), 0) as avgCost
       FROM billing_ledger
       GROUP BY model
       ORDER BY requests DESC`,
    ).all() as Array<{
      model: string; requests: number;
      promptTokens: number; completionTokens: number;
      totalTokens: number; totalCost: number; avgCost: number;
    }>;

    return rows.map((r) => ({
      model: r.model,
      providerName: modelProviderMap.get(r.model) || 'unknown',
      requests: Number(r.requests),
      promptTokens: Number(r.promptTokens),
      completionTokens: Number(r.completionTokens),
      totalTokens: Number(r.totalTokens),
      totalCost: Number(r.totalCost),
      avgCost: Number(r.avgCost),
    }));
  }

  private async buildModelProviderMap(): Promise<Map<string, string>> {
    const configs = await this.apiKeyStore.listConfigs();
    const map = new Map<string, string>();
    for (const cfg of configs) {
      const models = cfg.models.split(',').map((m) => m.trim()).filter(Boolean);
      for (const model of models) {
        map.set(model, cfg.providerName);
      }
    }
    return map;
  }

  async getTodayStats(): Promise<TodayStats> {
    const db = this.databaseService.connection;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayParam = `${todayStr} 00:00:00.000`;

    const row = await db.prepare(
      `SELECT COUNT(*) as requests,
              COALESCE(SUM(cost), 0) as revenue,
              COALESCE(SUM(total_tokens), 0) as tokens
       FROM billing_ledger WHERE created_at >= ?`,
    ).get(todayParam) as { requests: number; revenue: number; tokens: number };

    return {
      requests: Number(row.requests),
      revenue: Number(row.revenue),
      tokens: Number(row.tokens),
    };
  }

  async exportBillingCsv(
    filters?: { username?: string; model?: string; provider?: string; fromDate?: string; toDate?: string },
  ): Promise<string> {
    const db = this.databaseService.connection;
    const modelProviderMap = await this.buildModelProviderMap();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.username) { conditions.push('u.username LIKE ?'); params.push(`%${filters.username}%`); }
    if (filters?.model) { conditions.push('bl.model = ?'); params.push(filters.model); }
    if (filters?.provider) { conditions.push('bl.provider_name = ?'); params.push(filters.provider); }
    if (filters?.fromDate) { conditions.push('bl.created_at >= ?'); params.push(filters.fromDate); }
    if (filters?.toDate) { conditions.push('bl.created_at <= ?'); params.push(filters.toDate); }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.prepare(
      `SELECT bl.id, COALESCE(u.username, 'deleted') as username,
              bl.model, bl.request_type as requestType,
              bl.provider_name as providerName, bl.provider_key_name as providerKeyName,
              bl.provider_key_prefix as providerKeyPrefix, bl.audit_metadata as auditMetadata,
              bl.prompt_tokens as promptTokens, bl.completion_tokens as completionTokens,
              bl.total_tokens as totalTokens, bl.cost, bl.created_at as createdAt
       FROM billing_ledger bl
       LEFT JOIN users u ON u.id = bl.user_id
       ${whereClause}
       ORDER BY bl.created_at DESC`,
    ).all(...params) as Array<{
      id: string; username: string; model: string; requestType: string;
      providerName: string; providerKeyName: string; providerKeyPrefix: string; auditMetadata: string;
      promptTokens: number; completionTokens: number; totalTokens: number;
      cost: number; createdAt: string;
    }>;

    const header = 'ID,用户,模型,请求类型,Provider,Provider Key,Key 前缀,审计元数据,输入Token,输出Token,总Token,费用,时间';
    const csvRows = rows.map((r) => {
      const providerName = r.providerName || modelProviderMap.get(r.model) || '';
      return [r.id, r.username, r.model, r.requestType, providerName, r.providerKeyName || '', r.providerKeyPrefix || '', r.auditMetadata || '', r.promptTokens, r.completionTokens, r.totalTokens, Number(r.cost).toFixed(6), r.createdAt].map(csvCell).join(',');
    });

    // Add BOM for Excel UTF-8 compatibility
    return '﻿' + [header, ...csvRows].join('\n');
  }

  /* ──────── Provider API Key management ──────── */

  async listProviderApiKeys(providerName?: string): Promise<ProviderApiKeyRow[]> {
    return this.apiKeyStore.listKeys(providerName);
  }

  async listProviderKeyMetrics(providerName?: string): Promise<Array<{ providerName: string; pool: ApiKeyPoolSnapshot }>> {
    return this.apiKeyStore.listPoolMetrics(providerName);
  }

  async addProviderApiKey(
    providerName: string,
    name: string,
    apiKey: string,
  ): Promise<ProviderApiKeyRow> {
    const row = await this.apiKeyStore.addKey(providerName, name, apiKey);
    await this.providerRegistry.reloadProvider(providerName);
    return row;
  }

  async deleteProviderApiKey(id: string): Promise<{ providerName: string }> {
    const result = await this.apiKeyStore.removeKey(id);
    await this.providerRegistry.reloadProvider(result.providerName);
    return result;
  }

  /* ──────── Provider Config management ──────── */

  async listProviderConfigs(): Promise<ProviderConfig[]> {
    return this.apiKeyStore.listConfigs();
  }

  async createProviderConfig(input: ProviderConfigInput): Promise<ProviderConfig> {
    const config = await this.apiKeyStore.createConfig(input);
    await this.providerRegistry.reloadProvider(input.providerName);
    return config;
  }

  async updateProviderConfig(
    id: string,
    input: Partial<ProviderConfigInput>,
  ): Promise<ProviderConfig> {
    const config = await this.apiKeyStore.updateConfig(id, input);
    await this.providerRegistry.reloadProvider(config.providerName);
    return config;
  }

  async toggleProviderEnabled(
    id: string,
    enabled: boolean,
    expectedUpdatedAt?: string,
  ): Promise<ProviderConfig> {
    const config = await this.apiKeyStore.toggleEnabled(id, enabled, expectedUpdatedAt);
    await this.providerRegistry.reloadProvider(config.providerName);
    return config;
  }

  async deleteProviderConfig(id: string): Promise<{ providerName: string }> {
    const result = await this.apiKeyStore.deleteConfig(id);
    // Remove from in-memory registry
    await this.providerRegistry.reloadProvider(result.providerName);
    return result;
  }

  /* ──────── System Settings ──────── */

  async getSystemSettings(): Promise<Array<{ key: string; value: string; description: string }>> {
    const db = this.databaseService.connection;
    const rows = await db.prepare(
      'SELECT `key`, value, description FROM system_settings ORDER BY `key`',
    ).all() as Array<{ key: string; value: string; description: string }>;
    return rows;
  }

  async getSystemSetting(key: string): Promise<string | null> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async updateSystemSetting(key: string, value: string, expectedValue?: string): Promise<void> {
    await this.settings.updateValues({ [key]: value }, expectedValue === undefined ? {} : { [key]: expectedValue });
    if (key.startsWith('api_key_')) {
      try {
        for (const config of await this.apiKeyStore.listConfigs()) if (config.enabled) {
          await this.apiKeyStore.reloadPool(config.providerName);
          await this.providerRegistry.reloadProvider(config.providerName);
        }
      } catch { throw new ServiceUnavailableException('配置已保存，但密钥池刷新失败，请刷新确认并重启后端'); }
    }
  }

  /* ──────── Model Tier Management ──────── */

  async getModelTiers(): Promise<{ tiers: Record<string, string[]>; prices: Record<string, {prompt: number; completion: number; description: string}>; labels: Record<string, string>; examples: Record<string, string>; versions: Record<string, string> }> {
    const rows = await this.databaseService.connection.prepare("SELECT `key`,value FROM system_settings WHERE `key` IN ('model_tier_mapping','tier_prices','tier_labels','tier_examples')").all();
    const versions = Object.fromEntries(rows.map(r => [String(r.key), String(r.value)]));
    const tiers = modelMapping(JSON.parse(versions.model_tier_mapping || '{}'), 'model_tier_mapping');
    const rawPrices = record(JSON.parse(versions.tier_prices || '{}'), 'tier_prices');
    const prices: Record<string, {prompt: number; completion: number; description: string}> = {};
    for (const [tier, input] of Object.entries(rawPrices)) {
      const p = record(input, 'tier_prices');
      prices[tier] = {prompt: price(p.prompt, 'tier_prices'), completion: price(p.completion, 'tier_prices'), description: typeof p.description === 'string' ? p.description : '【'+tier+'】'};
    }
    return { tiers, prices, labels: JSON.parse(versions.tier_labels || '{}'), examples: JSON.parse(versions.tier_examples || '{}'), versions };
  }

  async updateModelTiers(body: { tiers: Record<string, string[]>; prices: Record<string, { prompt: number; completion: number }>; labels?: Record<string, string>; examples?: Record<string, string>; expected?: Record<string, string> }): Promise<Awaited<ReturnType<AdminService['getModelTiers']>>> {
    record(body, 'model tiers');
    if (Object.keys(body).some(k => !['tiers','prices','labels','examples','expected'].includes(k))) throw new BadRequestException('无效的定价字段');
    const tiers = modelMapping(body.tiers, 'model_tier_mapping');
    const values: Record<string, string> = { model_tier_mapping: JSON.stringify(tiers), tier_prices: JSON.stringify(body.prices) };
    if (body.labels !== undefined) values.tier_labels = JSON.stringify(body.labels);
    if (body.examples !== undefined) values.tier_examples = JSON.stringify(body.examples);
    const expected = body.expected === undefined ? {} : record(body.expected, 'expected');
    if (Object.values(expected).some(v => typeof v !== 'string')) throw new BadRequestException('无效的配置版本');
    if (Object.keys(values).some(key => typeof expected[key] !== 'string')) throw new BadRequestException('请先加载完整定价配置再保存');
    await this.settings.updateValues(values, expected as Record<string, string>);
    return this.getModelTiers();
  }

  async addModelsToTier(tierKey: string, models: string[]): Promise<{tiers: Record<string, string[]>}> {
    const requested = modelMapping({[tierKey]: models}, 'model_tier_mapping')[tierKey];
    await this.settings.mutateJSON('model_tier_mapping', value => {
      const tiers = modelMapping(value, 'model_tier_mapping');
      if (!Object.hasOwn(tiers, tierKey)) throw new NotFoundException('计费档位不存在');
      for (const m of requested) {
        if (!tiers[tierKey].includes(m)) tiers[tierKey].push(m);
        for (const k of Object.keys(tiers)) if (k !== tierKey) tiers[k] = tiers[k].filter(x => x !== m);
      }
      return tiers;
    });
    return {tiers: (await this.getModelTiers()).tiers};
  }

  async removeModelFromTier(tierKey: string, modelId: string): Promise<{tiers: Record<string, string[]>}> {
    record({[tierKey]: []}, 'model_tier_mapping');
    await this.settings.mutateJSON('model_tier_mapping', value => {
      const tiers = modelMapping(value, 'model_tier_mapping');
      if (!Object.hasOwn(tiers, tierKey)) throw new NotFoundException('计费档位不存在');
      tiers[tierKey] = tiers[tierKey].filter(m => m !== modelId);
      return tiers;
    });
    return {tiers: (await this.getModelTiers()).tiers};
  }

  private sanitizeModelTierMapping(tiers: Record<string, string[]>): Record<string, string[]> { return modelMapping(tiers, 'model_tier_mapping'); }






}
