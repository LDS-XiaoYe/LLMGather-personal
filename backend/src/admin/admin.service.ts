import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../auth/users.service';
import {
  ProviderApiKeyStore,
  ProviderApiKeyRow,
  ProviderConfig,
  ProviderConfigInput,
} from '../providers/provider-api-key.store';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { SystemSettingsService } from '../common/system-settings.service';
import { AuthUser } from '../auth/auth.types';

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
      `SELECT u.id, u.username, u.email, u.role, u.credits, u.total_spent as totalSpent,
              u.created_at as createdAt, u.invitation_code as invitationCode,
              COALESCE(bc.req_count, 0) as requestCount
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as req_count FROM billing_ledger GROUP BY user_id) bc ON bc.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params) as Array<{
      id: string; username: string; email: string | null; role: string;
      credits: number; totalSpent: number; createdAt: string;
      invitationCode: string; requestCount: number;
    }>;

    return {
      data: rows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email || null,
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

  async updateUser(userId: string, updates: { credits?: number; role?: string }): Promise<AdminUserRow> {
    const db = this.databaseService.connection;

    const user = await db.prepare(
      'SELECT id, username, email, role, credits, total_spent as totalSpent, created_at as createdAt FROM users WHERE id = ?',
    ).get(userId) as unknown as AdminUserRow | undefined;

    if (!user) throw new NotFoundException('用户不存在');

    if (updates.credits !== undefined) {
      await db.prepare('UPDATE users SET credits = ? WHERE id = ?')
        .run(Number(updates.credits.toFixed(6)), userId);
    }
    if (updates.role !== undefined) {
      if (!['admin', 'user'].includes(updates.role)) {
        throw new ForbiddenException('无效的角色值，仅支持 admin 或 user');
      }
      await db.prepare('UPDATE users SET role = ? WHERE id = ?')
        .run(updates.role, userId);
    }

    // Re-fetch with request count
    const updated = await db.prepare(
      `SELECT u.id, u.username, u.email, u.role, u.credits, u.total_spent as totalSpent,
              u.created_at as createdAt, u.invitation_code as invitationCode,
              COALESCE(bc.req_count, 0) as requestCount
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as req_count FROM billing_ledger GROUP BY user_id) bc ON bc.user_id = u.id
       WHERE u.id = ?`,
    ).get(userId) as unknown as AdminUserRow;

    return {
      ...updated,
      role: updated.role || 'user',
      credits: Number(updated.credits),
      totalSpent: Number(updated.totalSpent),
      requestCount: Number(updated.requestCount),
      invitationCode: updated.invitationCode || '',
    };
  }

  async listBillingLedger(
    page = 1,
    pageSize = 50,
    filters?: { username?: string; model?: string; fromDate?: string; toDate?: string },
  ): Promise<{ data: AdminBillingRow[]; total: number }> {
    const db = this.databaseService.connection;
    const offset = (page - 1) * pageSize;

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
        promptTokens: Number(r.promptTokens),
        completionTokens: Number(r.completionTokens),
        totalTokens: Number(r.totalTokens),
        cost: Number(r.cost),
      })),
      total: Number(total),
    };
  }

  async updateBillingRule(key: string, value: number, description?: string): Promise<{ key: string; value: number; description: string }> {
    // Route to the appropriate system_settings key
    if (key === 'default_prompt_price_per_1k' || key === 'default_completion_price_per_1k') {
      // Read current default_prices, update, save back
      const db = this.databaseService.connection;
      const row = await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get('default_prices') as { value: string } | undefined;
      const dp = row?.value ? JSON.parse(row.value) : { prompt: 0.002, completion: 0.006 };
      if (key === 'default_prompt_price_per_1k') dp.prompt = value;
      else dp.completion = value;
      await db.prepare(
        'INSERT INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
      ).run('default_prices', JSON.stringify(dp), description || '默认价格', this.databaseService.now());
      await this.settings.reloadAll();
      return { key, value, description: description || '' };
    }
    throw new NotFoundException('不支持直接编辑此计费规则，请通过定价映射页面管理');
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

    // Cascade delete user data
    await db.prepare('DELETE FROM billing_ledger WHERE user_id = ?').run(userId);
    await db.prepare('DELETE FROM conversation_messages WHERE user_id = ?').run(userId);
    await db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    await db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
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
    filters?: { username?: string; model?: string; fromDate?: string; toDate?: string },
  ): Promise<string> {
    const db = this.databaseService.connection;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.username) { conditions.push('u.username LIKE ?'); params.push(`%${filters.username}%`); }
    if (filters?.model) { conditions.push('bl.model = ?'); params.push(filters.model); }
    if (filters?.fromDate) { conditions.push('bl.created_at >= ?'); params.push(filters.fromDate); }
    if (filters?.toDate) { conditions.push('bl.created_at <= ?'); params.push(filters.toDate); }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.prepare(
      `SELECT bl.id, COALESCE(u.username, 'deleted') as username,
              bl.model, bl.request_type as requestType,
              bl.prompt_tokens as promptTokens, bl.completion_tokens as completionTokens,
              bl.total_tokens as totalTokens, bl.cost, bl.created_at as createdAt
       FROM billing_ledger bl
       LEFT JOIN users u ON u.id = bl.user_id
       ${whereClause}
       ORDER BY bl.created_at DESC`,
    ).all(...params) as Array<{
      id: string; username: string; model: string; requestType: string;
      promptTokens: number; completionTokens: number; totalTokens: number;
      cost: number; createdAt: string;
    }>;

    const header = 'ID,用户,模型,请求类型,输入Token,输出Token,总Token,费用,时间';
    const csvRows = rows.map((r) =>
      [r.id, r.username, r.model, r.requestType, r.promptTokens, r.completionTokens, r.totalTokens, Number(r.cost).toFixed(6), r.createdAt].join(','),
    );

    // Add BOM for Excel UTF-8 compatibility
    return '﻿' + [header, ...csvRows].join('\n');
  }

  /* ──────── Provider API Key management ──────── */

  async listProviderApiKeys(providerName?: string): Promise<ProviderApiKeyRow[]> {
    return this.apiKeyStore.listKeys(providerName);
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
  ): Promise<ProviderConfig> {
    const config = await this.apiKeyStore.toggleEnabled(id, enabled);
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

  async updateSystemSetting(key: string, value: string): Promise<void> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();
    const sanitizedValue = this.sanitizeSystemSettingValue(key, value);
    await db.prepare(
      'UPDATE system_settings SET value = ?, updated_at = ? WHERE `key` = ?',
    ).run(sanitizedValue, now, key);
    await this.settings.reloadAll();
  }

  /* ──────── Model Tier Management ──────── */

  async getModelTiers(): Promise<{ tiers: Record<string, string[]>; prices: Record<string, { prompt: number; completion: number; description: string }>; labels: Record<string, string>; examples: Record<string, string> }> {
    const db = this.databaseService.connection;

    const tierRow = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('model_tier_mapping') as { value: string } | undefined;
    const tiers = this.sanitizeModelTierMapping(tierRow ? JSON.parse(tierRow.value) : {});

    const labelRow = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('tier_labels') as { value: string } | undefined;
    const labels: Record<string, string> = labelRow ? JSON.parse(labelRow.value) : {};

    const exampleRow = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('tier_examples') as { value: string } | undefined;
    const examples: Record<string, string> = exampleRow ? JSON.parse(exampleRow.value) : {};

    // Read prices from tier_prices system_settings
    const priceRow = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('tier_prices') as { value: string } | undefined;
    const rawPrices: Record<string, { prompt: number; completion: number }> = priceRow?.value ? JSON.parse(priceRow.value) : {};
    const prices: Record<string, { prompt: number; completion: number; description: string }> = {};
    for (const [tier, p] of Object.entries(rawPrices)) {
      prices[tier] = { prompt: p.prompt, completion: p.completion, description: `【${tier}】` };
    }

    if (tierRow && tierRow.value !== JSON.stringify(tiers)) {
      await db.prepare(
        'UPDATE system_settings SET value = ?, updated_at = ? WHERE `key` = ?',
      ).run(JSON.stringify(tiers), this.databaseService.now(), 'model_tier_mapping');
      await this.settings.reloadAll();
    }

    return { tiers, prices, labels, examples };
  }

  async updateModelTiers(body: { tiers: Record<string, string[]>; prices: Record<string, { prompt: number; completion: number }>; labels?: Record<string, string>; examples?: Record<string, string> }): Promise<{ tiers: Record<string, string[]>; prices: Record<string, { prompt: number; completion: number; description: string }>; labels: Record<string, string>; examples: Record<string, string> }> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();
    const tiers = this.sanitizeModelTierMapping(body.tiers);

    await db.prepare(
      'INSERT INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
    ).run('model_tier_mapping', JSON.stringify(tiers), '模型到计费档位的映射（JSON）', now);

    if (body.labels) {
      await db.prepare(
        'INSERT INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
      ).run('tier_labels', JSON.stringify(body.labels), '计费档位显示名称', now);
    }

    if (body.examples) {
      await db.prepare(
        'INSERT INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
      ).run('tier_examples', JSON.stringify(body.examples), '控制台计费规则模型举例', now);
    }

    // Save prices to tier_prices system_settings
    await db.prepare(
      'INSERT INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)',
    ).run('tier_prices', JSON.stringify(body.prices), '各档位价格（元/千token）', now);

    await this.settings.reloadAll();
    return this.getModelTiers();
  }

  async addModelsToTier(tierKey: string, models: string[]): Promise<{ tiers: Record<string, string[]> }> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();
    const row = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('model_tier_mapping') as { value: string } | undefined;
    const tiers: Record<string, string[]> = row ? JSON.parse(row.value) : {};

    if (models.includes('auto')) models = models.filter((model) => model !== 'auto');
    if (!tiers[tierKey]) tiers[tierKey] = [];
    for (const m of models) {
      if (!tiers[tierKey].includes(m)) tiers[tierKey].push(m);
      // Remove from other tiers
      for (const [k, v] of Object.entries(tiers)) {
        if (k !== tierKey) tiers[k] = v.filter((x) => x !== m);
      }
    }

    await db.prepare(
      'UPDATE system_settings SET value = ?, updated_at = ? WHERE `key` = ?',
    ).run(JSON.stringify(tiers), now, 'model_tier_mapping');

    await this.settings.reloadAll();
    return { tiers };
  }

  async removeModelFromTier(tierKey: string, modelId: string): Promise<{ tiers: Record<string, string[]> }> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();
    const row = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('model_tier_mapping') as { value: string } | undefined;
    const tiers: Record<string, string[]> = row ? JSON.parse(row.value) : {};

    if (tiers[tierKey]) {
      tiers[tierKey] = tiers[tierKey].filter((x) => x !== modelId);
    }

    await db.prepare(
      'UPDATE system_settings SET value = ?, updated_at = ? WHERE `key` = ?',
    ).run(JSON.stringify(tiers), now, 'model_tier_mapping');

    await this.settings.reloadAll();
    return { tiers };
  }

  private sanitizeModelTierMapping(tiers: Record<string, string[]>): Record<string, string[]> {
    const allowedGeminiModels = new Set(['gemini-3.5-flash']);
    const cleaned: Record<string, string[]> = {};
    for (const [tier, models] of Object.entries(tiers || {})) {
      cleaned[tier] = Array.from(new Set((models || []).filter((model) => (
        model &&
        model !== 'auto' &&
        (!model.startsWith('gemini-') || allowedGeminiModels.has(model))
      ))));
    }
    return cleaned;
  }

  private sanitizeSystemSettingValue(key: string, value: string): string {
    if (key === 'model_tags') {
      return JSON.stringify(this.sanitizeModelTags(value));
    }
    if (key.startsWith('page_models_')) {
      return this.sanitizeModelCsv(value);
    }
    if (key === 'model_tier_mapping') {
      try {
        return JSON.stringify(this.sanitizeModelTierMapping(JSON.parse(value) as Record<string, string[]>));
      } catch {
        return value;
      }
    }
    return value;
  }

  private sanitizeModelTags(value: string): Record<string, string[]> {
    const allowedTags = new Set(['language', 'vision', 'audio']);
    const parsed = JSON.parse(value) as Record<string, string[]>;
    const cleaned: Record<string, string[]> = {};
    for (const [model, tags] of Object.entries(parsed || {})) {
      if (!model || model === 'auto') continue;
      const next = Array.from(new Set((tags || []).filter((tag) => allowedTags.has(tag))));
      if (next.length > 0) cleaned[model] = next;
    }
    return cleaned;
  }

  private sanitizeModelCsv(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '*') return trimmed || '*';
    return Array.from(new Set(trimmed.split(',').map((model) => model.trim()).filter((model) => model && model !== 'auto'))).join(',');
  }
}
