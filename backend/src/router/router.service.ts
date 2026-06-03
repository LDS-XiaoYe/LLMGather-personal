import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { ProviderAdapter } from '../providers/provider.types';
import { ChatRequestDto } from '../gateway/dto/chat-request.dto';
import { ChatService } from '../gateway/chat.service';
import { classifyIntentByLLM, getIntentLabel, ClassifierDebug } from './llm-classifier';

export interface RouteDecision {
  intent: string;
  intentLabel: string;
  confidence: number;
  selectedModel: string;
  fallbacks: string[];
  reason: string;
  debug?: ClassifierDebug;
}

@Injectable()
export class RouterService implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly chatService: ChatService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRouterRules();
    await this.seedClassifierModel();
    console.log('[RouterService] Initialized');
  }

  /** Get the classifier model from system_settings, fallback to qwen-plus */
  async getClassifierModel(): Promise<string> {
    try {
      const row = await this.db.connection
        .prepare("SELECT value FROM system_settings WHERE `key` = 'router_classifier_model'")
        .get() as { value: string } | undefined;
      return row?.value || 'qwen-plus';
    } catch {
      return 'qwen-plus';
    }
  }

  private async seedClassifierModel(): Promise<void> {
    await this.db.connection
      .prepare("INSERT IGNORE INTO system_settings (`key`, value, description, updated_at) VALUES ('router_classifier_model', 'qwen-plus', '智能路由意图分类使用的模型', CURRENT_TIMESTAMP(3))")
      .run();
  }

  private async seedRouterRules(): Promise<void> {
    const { count } = (await this.db.connection
      .prepare('SELECT COUNT(*) as count FROM router_rules')
      .get()) as { count: number };
    if (count > 0) return;

    // Seed only a 'general' entry with all available language models
    const available = this.providerRegistry.listModels()
      .filter((m) => !m.id.includes('vl') && !m.id.includes('tts') && !m.id.includes('voice'))
      .map((m) => m.id)
      .slice(0, 5);

    await this.db.connection
      .prepare('INSERT INTO router_rules (intent, models, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP(3))')
      .run('general', JSON.stringify(available.length > 0 ? available : ['qwen-plus']));
  }

  /** Get routing rules from DB, filtered to available models */
  async getRules(): Promise<Record<string, string[]>> {
    const rows = (await this.db.connection
      .prepare('SELECT intent, models FROM router_rules')
      .all()) as Array<{ intent: string; models: string }>;
    const availableModels = this.providerRegistry.listModels().map((m) => m.id);
    const availableSet = new Set(availableModels);

    const rules: Record<string, string[]> = {};
    for (const r of rows) {
      try {
        const models: string[] = JSON.parse(r.models);
        rules[r.intent] = models.filter((m) => availableSet.has(m));
      } catch { rules[r.intent] = []; }
    }
    // Always ensure 'general' fallback exists
    if (!rules['general'] || rules['general'].length === 0) {
      rules['general'] = availableModels.filter((m) => !m.includes('vl') && !m.includes('tts') && !m.includes('voice')).slice(0, 3);
    }
    return rules;
  }

  /** Get all router rules as raw array for admin */
  async getRulesRaw(): Promise<Array<{ intent: string; models: string[] }>> {
    const rows = (await this.db.connection
      .prepare('SELECT intent, models FROM router_rules ORDER BY intent')
      .all()) as Array<{ intent: string; models: string }>;
    return rows.map((r) => {
      try { return { intent: r.intent, models: this.sanitizeRuleModels(JSON.parse(r.models)) }; }
      catch { return { intent: r.intent, models: [] }; }
    });
  }

  /** Update routing rules */
  async updateRule(intent: string, models: string[]): Promise<void> {
    const sanitizedModels = this.sanitizeRuleModels(models);
    await this.db.connection
      .prepare(
        'INSERT INTO router_rules (intent, models, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE models = VALUES(models), updated_at = VALUES(updated_at)',
      )
      .run(intent, JSON.stringify(sanitizedModels));
  }

  /** Delete a routing rule */
  async deleteRule(intent: string): Promise<void> {
    await this.db.connection
      .prepare('DELETE FROM router_rules WHERE intent = ?')
      .run(intent);
  }

  /** Route a request: classify intent via LLM → select best available model */
  async route(payload: ChatRequestDto): Promise<{ provider: ProviderAdapter; model: string; decision: RouteDecision }> {
    const lastUserMsg = [...payload.messages].reverse().find((m) => m.role === 'user');
    const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // 1. Classify intent using LLM (model + intents from system settings / DB)
    const classifierModel = await this.getClassifierModel();
    const rules = await this.getRules();
    const availableIntents = Object.keys(rules);
    const { intent, debug } = await classifyIntentByLLM(query, this.chatService, classifierModel, availableIntents);

    // 2. Get model list for this intent
    const candidates = rules[intent] ?? rules['general'] ?? [];

    // 3. Find first available model
    const availableModels = this.providerRegistry.listModels();
    let selectedModel = '';
    const fallbacks: string[] = [];

    for (const model of candidates) {
      const isAvailable = availableModels.some((m) => m.id === model);
      if (isAvailable && !selectedModel) {
        selectedModel = model;
      } else if (isAvailable) {
        fallbacks.push(model);
      }
    }

    if (!selectedModel && availableModels.length > 0) {
      selectedModel = availableModels[0].id;
    }

    if (!selectedModel) {
      throw new Error('No models available');
    }

    const provider = this.providerRegistry.resolveProvider(selectedModel);

    this.recordMetric(selectedModel, intent).catch(() => {});

    const decision: RouteDecision = {
      intent,
      intentLabel: getIntentLabel(intent),
      confidence: 0.9,
      selectedModel,
      fallbacks,
      reason: `LLM 分类: 意图「${getIntentLabel(intent)}」→ 路由到 ${selectedModel}`,
      debug,
    };

    return { provider, model: selectedModel, decision };
  }

  private async recordMetric(model: string, intent: string): Promise<void> {
    try {
      await this.db.connection
        .prepare(
          'INSERT INTO model_metrics (model, latency_ms, success, intent, created_at) VALUES (?, NULL, 1, ?, CURRENT_TIMESTAMP(3))',
        )
        .run(model, intent);
    } catch {}
  }

  /** Record a request metric after completion */
  async recordCompletion(model: string, latencyMs: number, success: boolean, intent?: string): Promise<void> {
    try {
      await this.db.connection
        .prepare(
          'INSERT INTO model_metrics (model, latency_ms, success, intent, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))',
        )
        .run(model, latencyMs, success ? 1 : 0, intent || '');
    } catch {}
  }

  /** Get recent metrics for admin dashboard */
  async getMetrics(limit = 100): Promise<Array<{ model: string; latencyMs: number; success: boolean; intent: string; createdAt: string }>> {
    const rows = (await this.db.connection
      .prepare('SELECT model, latency_ms as latencyMs, success, intent, created_at as createdAt FROM model_metrics ORDER BY created_at DESC LIMIT ?')
      .all(limit)) as any[];
    return rows.map((r: any) => ({ ...r, success: !!r.success }));
  }

  private sanitizeRuleModels(models: string[]): string[] {
    return Array.from(new Set((models || []).filter((model) => model && model !== 'auto')));
  }
}
