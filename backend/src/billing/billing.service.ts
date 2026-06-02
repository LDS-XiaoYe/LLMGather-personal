import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthUser } from '../auth/auth.types';
import { ChatCompletionRequest, ChatCompletionUsage } from '../providers/provider.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BillingService {
  private readonly defaultPromptPricePer1k = Number(process.env.BILLING_PROMPT_PRICE_PER_1K || 0.002);
  private readonly defaultCompletionPricePer1k = Number(process.env.BILLING_COMPLETION_PRICE_PER_1K || 0.006);
  private readonly streamCompletionReserveTokens = Number(process.env.BILLING_STREAM_RESERVE_TOKENS || 256);

  constructor(private readonly databaseService: DatabaseService) {}

  reserveForStream(userId: string, request: ChatCompletionRequest): ChatCompletionUsage {
    const usage: ChatCompletionUsage = {
      prompt_tokens: this.estimatePromptTokens(request),
      completion_tokens: request.max_tokens ?? this.streamCompletionReserveTokens,
      total_tokens: 0,
    };
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    return usage;
  }

  async chargeForCompletion(
    userId: string,
    request: ChatCompletionRequest,
    usage?: ChatCompletionUsage,
    requestType: 'chat' | 'openai' | 'anthropic' = 'chat',
  ): Promise<AuthUser> {
    const normalizedUsage = usage ?? this.estimateNonStreamUsage(request);
    return this.charge(userId, request.model, requestType, normalizedUsage);
  }

  async getBalance(userId: string): Promise<AuthUser> {
    // Delegate to UsersService indirectly — here we just query the public fields
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT id, username, role, credits, total_spent as totalSpent, created_at as createdAt FROM users WHERE id = ?',
    ).get(userId) as unknown as AuthUser | undefined;
    if (!row) throw new ForbiddenException('用户不存在');
    return { ...row, role: row.role || 'user', credits: Number(row.credits), totalSpent: Number(row.totalSpent) };
  }

  async getRules() {
    const db = this.databaseService.connection;
    // Read from system_settings instead of billing_rules
    const prices = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('tier_prices') as { value: string } | undefined;
    const defaults = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('default_prices') as { value: string } | undefined;

    const result: Array<{ key: string; value: number; description: string; updatedAt: string }> = [];
    if (prices?.value) {
      const tierPrices = JSON.parse(prices.value) as Record<string, { prompt: number; completion: number }>;
      for (const [tier, p] of Object.entries(tierPrices)) {
        result.push({ key: `${tier}_prompt`, value: p.prompt, description: `【${tier}】输入价格`, updatedAt: '' });
        result.push({ key: `${tier}_completion`, value: p.completion, description: `【${tier}】输出价格`, updatedAt: '' });
      }
    }
    if (defaults?.value) {
      const dp = JSON.parse(defaults.value) as { prompt: number; completion: number };
      result.push({ key: 'default_prompt_price_per_1k', value: dp.prompt, description: '默认输入价格', updatedAt: '' });
      result.push({ key: 'default_completion_price_per_1k', value: dp.completion, description: '默认输出价格', updatedAt: '' });
    }
    return result;
  }

  async getLedger(userId: string) {
    const db = this.databaseService.connection;
    return await db.prepare(
      `SELECT id, model, request_type as requestType, prompt_tokens as promptTokens,
              completion_tokens as completionTokens, total_tokens as totalTokens,
              cost, created_at as createdAt
       FROM billing_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
    ).all(userId) as Array<{
      id: string;
      model: string;
      requestType: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
      createdAt: string;
    }>;
  }

  async getDailyUsage(userId: string, days = 30): Promise<Array<{ date: string; requests: number; tokens: number; cost: number }>> {
    const db = this.databaseService.connection;
    const since = new Date(Date.now() - days * 86400000);
    const sinceStr = since.toISOString().replace('T', ' ').slice(0, 23);

    const rows = await db.prepare(
      `SELECT DATE(created_at) as date,
              COUNT(*) as requests,
              COALESCE(SUM(total_tokens), 0) as tokens,
              COALESCE(SUM(cost), 0) as cost
       FROM billing_ledger
       WHERE user_id = ? AND created_at >= ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
    ).all(userId, sinceStr) as unknown as Array<{ date: string; requests: number; tokens: number; cost: number }>;

    return rows.map((r) => ({ ...r, requests: Number(r.requests), tokens: Number(r.tokens), cost: Number(r.cost) }));
  }

  async getDailyUsageAll(days = 30): Promise<Array<{ date: string; requests: number; tokens: number; cost: number }>> {
    const db = this.databaseService.connection;
    const since = new Date(Date.now() - days * 86400000);
    const sinceStr = since.toISOString().replace('T', ' ').slice(0, 23);

    const rows = await db.prepare(
      `SELECT DATE(created_at) as date,
              COUNT(*) as requests,
              COALESCE(SUM(total_tokens), 0) as tokens,
              COALESCE(SUM(cost), 0) as cost
       FROM billing_ledger
       WHERE created_at >= ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
    ).all(sinceStr) as unknown as Array<{ date: string; requests: number; tokens: number; cost: number }>;

    return rows.map((r) => ({ ...r, requests: Number(r.requests), tokens: Number(r.tokens), cost: Number(r.cost) }));
  }

  private async charge(
    userId: string,
    model: string,
    requestType: 'chat' | 'openai' | 'anthropic',
    usage: ChatCompletionUsage,
  ): Promise<AuthUser> {
    const cost = await this.calculateCost(model, usage);

    // Query user balance directly (avoid circular dependency with UsersService)
    const db = this.databaseService.connection;
    const userRow = await db.prepare(
      'SELECT id, role, credits, total_spent as totalSpent FROM users WHERE id = ?',
    ).get(userId) as { id: string; role: string; credits: number; totalSpent: number } | undefined;

    if (!userRow) throw new ForbiddenException('用户不存在');
    const credits = Number(userRow.credits);
    const totalSpent = Number(userRow.totalSpent);
    if (credits < cost) {
      throw new ForbiddenException(`余额不足。当前余额 ${credits.toFixed(4)}，本次花费 ${cost.toFixed(4)}`);
    }

    const newCredits = Number((credits - cost).toFixed(6));
    const newTotalSpent = Number((totalSpent + cost).toFixed(6));

    await db.prepare('UPDATE users SET credits = ?, total_spent = ? WHERE id = ?')
      .run(newCredits, newTotalSpent, userId);

    await db.prepare(
      'INSERT INTO billing_ledger (id, user_id, model, request_type, prompt_tokens, completion_tokens, total_tokens, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      randomUUID(), userId, model, requestType,
      usage.prompt_tokens, usage.completion_tokens, usage.total_tokens,
      cost, this.databaseService.now(),
    );

    return {
      id: userId,
      username: '',
      email: null,
      role: userRow.role || 'user',
      credits: newCredits,
      totalSpent: newTotalSpent,
      createdAt: '',
    };
  }

  private estimateNonStreamUsage(request: ChatCompletionRequest): ChatCompletionUsage {
    const promptTokens = this.estimatePromptTokens(request);
    const completionTokens = Math.min(request.max_tokens ?? 256, 512);
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };
  }

  private estimatePromptTokens(request: ChatCompletionRequest): number {
    let asciiChars = 0;
    let cjkChars = 0;
    let imageCount = 0;
    for (const msg of request.messages) {
      // Handle multimodal content (array of parts)
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : msg.content
            .filter((p) => p.type === 'text')
            .map((p) => (p as { type: 'text'; text: string }).text)
            .join('');
      // Count images for token estimate
      if (typeof msg.content !== 'string') {
        imageCount += msg.content.filter((p) => p.type === 'image_url').length;
      }
      for (const ch of textContent) {
        const code = ch.codePointAt(0) ?? 0;
        if (
          (code >= 0x4e00 && code <= 0x9fff) ||
          (code >= 0x3400 && code <= 0x4dbf) ||
          (code >= 0x20000 && code <= 0x2ebef) ||
          (code >= 0xf900 && code <= 0xfaff)
        ) {
          cjkChars++;
        } else {
          asciiChars++;
        }
      }
    }
    return Math.max(1, Math.ceil(cjkChars / 1.5 + asciiChars / 4 + imageCount * 500));
  }

  /**
   * 从 system_settings 读取模型所属定价档位
   */
  private async getModelTier(model: string): Promise<string | null> {
    try {
      const db = this.databaseService.connection;
      const row = (await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get('model_tier_mapping')) as { value: string } | undefined;
      if (row && row.value) {
        const mapping = JSON.parse(row.value) as Record<string, string[]>;
        for (const [tierKey, models] of Object.entries(mapping)) {
          if (Array.isArray(models) && models.includes(model)) return tierKey;
        }
      }
    } catch { /* fall through */ }
    return null;
  }

  private async getTierPrices(): Promise<Record<string, { prompt: number; completion: number }>> {
    try {
      const db = this.databaseService.connection;
      const row = (await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get('tier_prices')) as { value: string } | undefined;
      return row?.value ? JSON.parse(row.value) : {};
    } catch { return {}; }
  }

  private async getDefaultPrices(): Promise<{ prompt: number; completion: number }> {
    try {
      const db = this.databaseService.connection;
      const row = (await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get('default_prices')) as { value: string } | undefined;
      return row?.value ? JSON.parse(row.value) : { prompt: this.defaultPromptPricePer1k, completion: this.defaultCompletionPricePer1k };
    } catch { return { prompt: this.defaultPromptPricePer1k, completion: this.defaultCompletionPricePer1k }; }
  }

  private async calculateCost(model: string, usage: ChatCompletionUsage): Promise<number> {
    let promptPrice: number | undefined;
    let completionPrice: number | undefined;

    const tier = await this.getModelTier(model);
    if (tier) {
      const tierPrices = await this.getTierPrices();
      const tp = tierPrices[tier];
      if (tp) {
        promptPrice = tp.prompt;
        completionPrice = tp.completion;
      }
    }

    if (promptPrice === undefined || completionPrice === undefined) {
      const dp = await this.getDefaultPrices();
      promptPrice = promptPrice ?? dp.prompt;
      completionPrice = completionPrice ?? dp.completion;
    }

    const pp1k = promptPrice ?? this.defaultPromptPricePer1k;
    const cp1k = completionPrice ?? this.defaultCompletionPricePer1k;

    const promptCost = (usage.prompt_tokens / 1000) * pp1k;
    const completionCost = (usage.completion_tokens / 1000) * cp1k;
    return Number((promptCost + completionCost).toFixed(6));
  }
}
