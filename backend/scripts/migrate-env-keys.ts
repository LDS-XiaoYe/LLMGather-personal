/**
 * 迁移脚本：将 .env 中的 Provider API Key 写入数据库（明文存储）。
 *
 * 用法（在 backend 目录下）:
 *   npx ts-node scripts/migrate-env-keys.ts
 *
 * 脚本会读取 .env 中的 QWEN_API_KEY / GLM_API_KEY / DEEPSEEK_API_KEY / XIAOMI_API_KEY，
 * 然后插入到 provider_api_keys 表（MySQL）。已存在的 key（按 provider_name 去重）不会重复插入。
 */

import 'dotenv/config';
import { createConnection } from 'mysql2/promise';
import { randomUUID } from 'crypto';

function mask(key: string): string {
  if (!key || key.length <= 8) return '***';
  return '***' + key.slice(-4);
}

async function main() {
  const keys: Array<{ provider: string; envVar: string; value: string | undefined }> = [
    { provider: 'qwen', envVar: 'QWEN_API_KEY', value: process.env.QWEN_API_KEY },
    { provider: 'glm', envVar: 'GLM_API_KEY', value: process.env.GLM_API_KEY },
    { provider: 'deepseek', envVar: 'DEEPSEEK_API_KEY', value: process.env.DEEPSEEK_API_KEY },
    { provider: 'xiaomi-mimo', envVar: 'XIAOMI_API_KEY', value: process.env.XIAOMI_API_KEY },
  ];

  // Filter to only keys that have a value
  const validKeys = keys.filter((k) => k.value && k.value.trim().length > 0);

  if (validKeys.length === 0) {
    console.log('No API keys found in .env. Nothing to migrate.');
    return;
  }

  console.log(`Found ${validKeys.length} key(s) in .env:`);
  for (const k of validKeys) {
    console.log(`  ${k.envVar} = ${mask(k.value!)}`);
  }

  await migrateMysql(validKeys);

  console.log('\nMigration complete! Restart the server to load the new keys.');
  console.log('You can now remove the API key entries from .env.');
}

async function migrateMysql(
  keys: Array<{ provider: string; envVar: string; value: string | undefined }>,
) {
  const conn = await createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'llmgather',
  });

  try {
    for (const k of keys) {
      const val = k.value!.trim();

      // Check if this provider already has this exact key
      const [existing] = await conn.execute(
        'SELECT id FROM provider_api_keys WHERE provider_name = ? AND api_key = ?',
        [k.provider, val],
      ) as any[];

      if (existing.length > 0) {
        console.log(`  [SKIP] ${k.provider}: key already exists in DB`);
        continue;
      }

      const id = randomUUID();
      const keyPrefix = mask(val);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 23);

      await conn.execute(
        'INSERT INTO provider_api_keys (id, provider_name, name, api_key, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, k.provider, 'Default (from .env)', val, keyPrefix, now],
      );
      console.log(`  [OK] ${k.provider}: inserted (${keyPrefix})`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
