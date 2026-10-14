import { BadRequestException } from '@nestjs/common';

function invalid(key: string): never { throw new BadRequestException(`配置 ${key} 的格式或取值无效`); }
export function record(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(key);
  const entries = Object.entries(value);
  if (entries.length > 2048 || entries.some(([k]) => !k || k.length > 256 || ['__proto__', 'prototype', 'constructor'].includes(k))) return invalid(key);
  return value as Record<string, unknown>;
}
export function price(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999) return invalid(key);
  return value;
}
export function modelMapping(value: unknown, key: string): Record<string, string[]> {
  const source = record(value, key), out: Record<string, string[]> = {};
  for (const [tier, models] of Object.entries(source)) {
    if (!Array.isArray(models) || models.length > 1024 || models.some(m => typeof m !== 'string' || !m.trim() || m.length > 256)) return invalid(key);
    out[tier] = [...new Set((models as string[]).filter(m => m !== 'auto'))];
  }
  return out;
}
export function validateSettingValue(key: string, input: unknown): string {
  if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > 65535) return invalid(key);
  const text = input.trim();
  if (['model_tags', 'model_tier_mapping', 'tier_labels', 'tier_examples', 'tier_prices', 'default_prices'].includes(key)) {
    let parsed: unknown;
    try { parsed = JSON.parse(input); } catch { return invalid(key); }
    const source = record(parsed, key);
    if (key === 'model_tier_mapping') return JSON.stringify(modelMapping(source, key));
    if (key === 'model_tags') {
      const out: Record<string, string[]> = {};
      for (const [model, tags] of Object.entries(source)) {
        if (!Array.isArray(tags) || tags.some(t => !['language', 'vision', 'audio'].includes(t))) return invalid(key);
        if (model !== 'auto') out[model] = [...new Set(tags as string[])];
      }
      return JSON.stringify(out);
    }
    if (key === 'tier_labels' || key === 'tier_examples') {
      if (Object.values(source).some(v => typeof v !== 'string' || v.length > 8192)) return invalid(key);
    } else {
      const prices = key === 'default_prices' ? [source] : Object.values(source).map(v => record(v, key));
      for (const p of prices) {
        price(p.prompt, key); price(p.completion, key);
        if (Object.keys(p).some(k => !['prompt', 'completion', 'description'].includes(k))) return invalid(key);
      }
    }
    return JSON.stringify(source);
  }
  if (key.startsWith('page_models_')) {
    if (!text || text === '*') return '*';
    const models = [...new Set(text.split(',').map(m => m.trim()).filter(m => m && m !== 'auto'))];
    if (!models.length || models.some(m => m.length > 256 || m === '*')) return invalid(key);
    return models.join(',');
  }
  if (key.startsWith('rate_limit_')) {
    const match = text.match(/^([1-9]\d*)\/([1-9]\d*)$/);
    if (!match || Number(match[1]) > 100000 || Number(match[2]) > 86400000) return invalid(key);
  }
  const limits: Record<string, [number, number]> = {
    default_temperature: [0, 2], invitation_credits: [0, 999999],
    api_key_cooldown_ms: [1, 86400000], api_key_circuit_breaker_ms: [1, 86400000],
    frontend_request_timeout_ms: [100, 300000], max_image_upload_size_bytes: [1, 104857600],
    api_key_failure_threshold: [1, 1000], api_key_half_open_probe_count: [1, 1000], api_key_half_open_success_threshold: [1, 1000],
  };
  if (limits[key]) {
    const n = Number(text), [min, max] = limits[key];
    if (!text || !Number.isFinite(n) || n < min || n > max || (!['default_temperature', 'invitation_credits'].includes(key) && !Number.isInteger(n))) return invalid(key);
  }
  if (key === 'max_json_body_size') {
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i);
    const bytes = match ? Number(match[1]) * ({b: 1, kb: 1024, mb: 1048576}[match[2]?.toLowerCase() || 'b'] ?? 1) : NaN;
    if (!Number.isFinite(bytes) || bytes < 1024 || bytes > 104857600) return invalid(key);
  }
  if (key === 'router_classifier_model' && (!text || text === 'auto')) return invalid(key);
  if (key === 'api_key_pool_strategy' && !['round_robin', 'random', 'weighted_round_robin'].includes(text)) return invalid(key);
  if (key === 'tts_default_format' && !['wav', 'mp3', 'pcm', 'opus', 'flac', 'aac'].includes(text)) return invalid(key);
  return input;
}
