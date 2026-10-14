import { IDatabaseAdapter } from '../database.adapter.interface';
import { SYSTEM_SETTINGS_DEFAULTS, SYSTEM_SETTINGS_SEED_VERSION, SystemSettingDefault } from './system-settings.defaults';

/** Preserve existing value, description and timestamp, including administrator overrides. */
export async function seedSystemSettings(
  db: IDatabaseAdapter, defaults: readonly SystemSettingDefault[] = SYSTEM_SETTINGS_DEFAULTS,
): Promise<void> {
  const keys = new Set<string>();
  for (const setting of defaults) {
    const key = setting.key.toLowerCase();
    if (!setting.key || setting.key.length > 128 || keys.has(key) ||
        typeof setting.value !== 'string' ||
        (setting.description !== null && typeof setting.description !== 'string') || !setting.seedVersion) {
      throw new Error('[Database] Invalid system settings seed manifest');
    }
    keys.add(key);
  }
  if (!defaults.length) throw new Error('[Database] Empty system settings seed manifest');

  for (const setting of defaults) {
    // Literal NULL preserves a null description; the existing adapter coerces null parameters to ''.
    const stmt = db.prepare(`INSERT INTO system_settings (\`key\`, value, description)
      VALUES (?, ?, ${setting.description === null ? 'NULL' : '?'})
      ON DUPLICATE KEY UPDATE \`key\` = system_settings.\`key\``);
    await stmt.run(...(setting.description === null
      ? [setting.key, setting.value] : [setting.key, setting.value, setting.description]));
  }
  await validateSystemSettings(db, defaults);
  console.log(`[Database] system_settings seed ${SYSTEM_SETTINGS_SEED_VERSION} validated (${defaults.length} required keys; existing values preserved)`);
}

/** Check presence/types, not equality: an administrator's changed default is valid. */
export async function validateSystemSettings(
  db: IDatabaseAdapter, defaults: readonly SystemSettingDefault[] = SYSTEM_SETTINGS_DEFAULTS,
): Promise<void> {
  const rows = await db.prepare('SELECT `key`, value FROM system_settings').all();
  const values = new Map(rows.map(row => [String(row.key).toLowerCase(), row.value]));
  const missing = defaults.filter(setting => typeof values.get(setting.key.toLowerCase()) !== 'string');
  if (missing.length) throw new Error(`[Database] system_settings validation failed (${missing.length} required keys missing or invalid)`);
}
