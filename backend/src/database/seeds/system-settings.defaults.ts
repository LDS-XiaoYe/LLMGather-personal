/**
 * Source: read-only SHOW CREATE TABLE / SELECT * from the running development MySQL.
 * Captured 2026-10-12. Schema: key VARCHAR(128) PK, value TEXT, description nullable TEXT.
 * 23 reviewed rows; 0 redacted, 0 adapted, 0 pending sensitivity review.
 * Values remain byte-for-byte TEXT, including units, rate expressions and JSON formatting.
 * updated_at is deliberately not copied: each installation owns its timestamps.
 * Key provenance is the entry's seedVersion, not an assertion of insertion history.
 */
export const SYSTEM_SETTINGS_SEED_VERSION = '2026-10-12.1';
export const SYSTEM_SETTINGS_SOURCE_SHA256 = '32cd78c93ac3905e5f200a740cca737a0a56593a5ae1e182f1a9bbef4e242bd3';
export interface SystemSettingDefault {
  key: string;
  value: string;
  description: string | null;
  seedVersion: string;
}
export const SYSTEM_SETTINGS_DEFAULTS: readonly SystemSettingDefault[] = [
  {
    "key": "api_key_cooldown_ms",
    "value": "30000",
    "description": "API Key 触发限流后的冷却时间（毫秒）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "default_prices",
    "value": "{\"prompt\":0.002,\"completion\":0.006}",
    "description": "默认价格（未分配档位的模型使用，JSON）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "default_temperature",
    "value": "0.7",
    "description": "默认 temperature 参数",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "frontend_request_timeout_ms",
    "value": "60000",
    "description": "前端请求超时时间（毫秒）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "invitation_credits",
    "value": "10",
    "description": "邀请注册奖励额度（元）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "max_image_upload_size_bytes",
    "value": "10485760",
    "description": "图片上传最大字节数（默认 10MB）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "max_json_body_size",
    "value": "2mb",
    "description": "后端 JSON body 最大大小",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "model_tags",
    "value": "{\"qwen-turbo\":[\"language\"],\"qwen-plus\":[\"language\"],\"qwen-max\":[\"language\"],\"qwen-vl-plus-latest\":[\"language\",\"vision\"],\"qwen-vl-max-latest\":[\"language\",\"vision\"],\"qwen-vl-ocr-latest\":[\"language\",\"vision\"],\"qwen2.5-vl-7b-instruct\":[\"language\",\"vision\"],\"qwen2.5-vl-72b-instruct\":[\"language\",\"vision\"],\"qwen2.5-14b-instruct\":[\"language\"],\"qwen2.5-7b-instruct\":[\"language\"],\"glm-5\":[\"language\"],\"glm-5.1\":[\"language\"],\"glm-4.5-air\":[\"language\"],\"deepseek-r1-distill-qwen-7b\":[\"language\"],\"deepseek-v3.2\":[\"language\"],\"deepseek-r1\":[\"language\"],\"deepseek-v4-pro\":[\"language\"],\"deepseek-v4-flash\":[\"language\"],\"MiniMax-M2.5\":[\"language\"],\"kimi-k2.6\":[\"language\",\"vision\"],\"gui-plus\":[\"language\",\"vision\"],\"mimo-latest\":[\"language\"],\"mimo-v2.5-tts\":[\"audio\"],\"mimo-v2.5-tts-voicedesign\":[\"audio\"],\"mimo-v2.5-tts-voiceclone\":[\"audio\"],\"qwen3.7-max\":[\"language\",\"vision\"],\"gemini-3.5-flash\":[\"language\",\"vision\"]}",
    "description": "模型能力标签（JSON）：language=语言, vision=视觉, audio=音频",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "model_tier_mapping",
    "value": "{\"tier_budget\":[\"qwen-turbo\",\"qwen2.5-7b-instruct\",\"deepseek-r1-distill-qwen-7b\",\"mimo-latest\"],\"tier_mainstream\":[\"qwen-plus\",\"qwen2.5-14b-instruct\",\"deepseek-v3.2\",\"deepseek-v4-flash\",\"glm-4.5-air\",\"MiniMax-M2.5\",\"gui-plus\"],\"tier_flagship\":[\"qwen-max\",\"qwen3.7-max\",\"glm-5\",\"glm-5.1\",\"deepseek-r1\",\"deepseek-v4-pro\",\"kimi-k2.6\"],\"tier_super_flagship\":[],\"tier_ultra\":[],\"tier_vision\":[\"qwen-vl-plus-latest\",\"qwen-vl-max-latest\",\"qwen-vl-ocr-latest\",\"qwen2.5-vl-7b-instruct\",\"qwen2.5-vl-72b-instruct\",\"gemini-3.5-flash\"],\"tier_audio\":[\"mimo-v2.5-tts\",\"mimo-v2.5-tts-voicedesign\",\"mimo-v2.5-tts-voiceclone\"]}",
    "description": "模型→定价层级映射（JSON）：budget/mainstream/flagship/vision/audio",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "page_models_battle",
    "value": "deepseek-v4-pro,deepseek-v4-flash,qwen-turbo,qwen-plus,qwen2.5-14b-instruct,qwen2.5-7b-instruct,qwen3.7-max,glm-5,glm-4.5-air,gui-plus,MiniMax-M2.5,kimi-k2.6",
    "description": "对战页面可用模型",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "page_models_chat",
    "value": "MiniMax-M2.5,qwen-turbo,qwen-max,glm-5.1,glm-4.5-air,glm-5,qwen2.5-7b-instruct,qwen2.5-14b-instruct,qwen-plus,deepseek-v4-pro,deepseek-v4-flash,qwen3.7-max",
    "description": "聊天页面可用模型（* 表示全部，或逗号分隔模型 ID）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "page_models_group",
    "value": "deepseek-r1-distill-qwen-7b,deepseek-v3.2,deepseek-v4-pro,deepseek-v4-flash,qwen-turbo,qwen-plus,qwen-max,qwen2.5-14b-instruct,qwen2.5-7b-instruct,qwen3.7-max,glm-5,glm-5.1,glm-4.5-air,gui-plus,MiniMax-M2.5,kimi-k2.6",
    "description": "群组聊天参与模型（* 表示全部，或逗号分隔模型 ID）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "page_models_tts",
    "value": "mimo-v2.5-tts,mimo-v2.5-tts-voicedesign,mimo-v2.5-tts-voiceclone",
    "description": "语音生成页面可用模型",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "page_models_vision",
    "value": "qwen3.7-max,qwen-vl-plus-latest,qwen-vl-max-latest,qwen-vl-ocr-latest,qwen2.5-vl-7b-instruct,qwen2.5-vl-72b-instruct,kimi-k2.6,gui-plus,gemini-3.5-flash",
    "description": "视觉理解页面可用模型",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "rate_limit_login",
    "value": "10/60000",
    "description": "登录接口限流：次数/毫秒",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "rate_limit_register",
    "value": "5/60000",
    "description": "注册接口限流：次数/毫秒",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "rate_limit_relay",
    "value": "30/60000",
    "description": "中继 API 限流：次数/毫秒",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "router_classifier_model",
    "value": "qwen-plus",
    "description": "智能路由意图分类使用的模型",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "tier_examples",
    "value": "{\"tier_budget\":\"qwen-turbo-latest, glm-4.5-flash, deepseek-v4-flash\",\"tier_mainstream\":\"qwen-plus-latest, glm-4.6, kimi-k2.6\",\"tier_flagship\":\"qwen-max-latest, deepseek-v4-pro, glm-4.5\",\"tier_super_flagship\":\"qwen3.6-plus, gui-plus\",\"tier_ultra\":\"qwen3.6-max\",\"tier_vision\":\"gemini-3.5-flash, qwen-vl-max-latest\",\"tier_audio\":\"qwen-audio-asr-latest, qwen-tts-latest\"}",
    "description": "控制台计费规则模型举例（JSON）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "tier_labels",
    "value": "{\"tier_budget\":\"入门\",\"tier_mainstream\":\"主流\",\"tier_flagship\":\"旗舰\",\"tier_super_flagship\":\"超旗舰\",\"tier_ultra\":\"至尊\",\"tier_vision\":\"视觉\",\"tier_audio\":\"音频\",\"测试\":\"123\"}",
    "description": "定价档位显示名称（JSON）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "tier_prices",
    "value": "{\"tier_budget\":{\"prompt\":0.001,\"completion\":0.002},\"tier_mainstream\":{\"prompt\":0.002,\"completion\":0.008},\"tier_flagship\":{\"prompt\":0.004,\"completion\":0.012},\"tier_super_flagship\":{\"prompt\":0.01,\"completion\":0.03},\"tier_ultra\":{\"prompt\":0.055,\"completion\":0.219},\"tier_vision\":{\"prompt\":0.005,\"completion\":0.015},\"tier_audio\":{\"prompt\":0.002,\"completion\":0.006}}",
    "description": "各档位价格（元/千token，JSON）",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "tts_default_format",
    "value": "wav",
    "description": "TTS 默认输出格式",
    "seedVersion": "2026-10-12.1"
  },
  {
    "key": "tts_default_voice",
    "value": "冰糖",
    "description": "TTS 默认音色",
    "seedVersion": "2026-10-12.1"
  }
];
