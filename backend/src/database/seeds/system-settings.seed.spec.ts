import { IDatabaseAdapter } from '../database.adapter.interface';
import { seedSystemSettings, validateSystemSettings } from './system-settings.seed';
import { SYSTEM_SETTINGS_DEFAULTS, SYSTEM_SETTINGS_SEED_VERSION } from './system-settings.defaults';

function fixture() {
  const rows = new Map<string, { key: string; value: string; description: string | null; updated_at: number }>();
  const sql: string[] = [];
  const db = { prepare: (query: string) => {
    sql.push(query);
    return {
      run: async (key: string, value: string, description?: string) => {
        if (!rows.has(key)) rows.set(key, { key, value, description: description ?? null, updated_at: 1 });
        return { changes: 1 };
      },
      all: async () => [...rows.values()],
    };
  } } as unknown as IDatabaseAdapter;
  return { db, rows, sql };
}

describe('versioned missing-only system settings', () => {
  it('seeds 23 reviewed TEXT defaults with explicit per-key provenance', async () => {
    const { db, rows, sql } = fixture();
    await seedSystemSettings(db);
    expect(rows.size).toBe(23);
    for (const setting of SYSTEM_SETTINGS_DEFAULTS) {
      expect(rows.get(setting.key)).toMatchObject({ key: setting.key, value: setting.value, description: setting.description });
      expect(setting.seedVersion).toBe(SYSTEM_SETTINGS_SEED_VERSION);
    }
    expect(rows.get('max_json_body_size')?.value).toBe('2mb');
    expect(rows.get('rate_limit_relay')?.value).toBe('30/60000');
    expect(sql.some(query => /INSERT IGNORE|UPDATE value|DELETE|TRUNCATE/i.test(query))).toBe(false);
  });
  it('keeps every byte and timestamp on repeat and preserves administrator changes', async () => {
    const { db, rows } = fixture();
    await seedSystemSettings(db);
    rows.set('model_tags', { key: 'model_tags', value: '{"auto":["custom"]}', description: 'administrator', updated_at: 42 });
    const before = [...rows.values()];
    await seedSystemSettings(db);
    expect([...rows.values()]).toEqual(before);
    rows.delete('invitation_credits');
    await seedSystemSettings(db);
    expect(rows.size).toBe(23);
    expect(rows.get('model_tags')?.updated_at).toBe(42);
  });
  it('preserves SQL NULL and empty descriptions distinctly', async () => {
    const { db, rows, sql } = fixture();
    await seedSystemSettings(db, [
      { key: 'nullable', value: '', description: null, seedVersion: 'test' },
      { key: 'empty', value: 'x', description: '', seedVersion: 'test' },
    ]);
    expect(rows.get('nullable')?.description).toBeNull();
    expect(rows.get('empty')?.description).toBe('');
    expect(sql[0]).toContain('VALUES (?, ?, NULL)');
  });
  it('rejects missing required keys and incomplete/duplicate manifests', async () => {
    const { db, sql } = fixture();
    await expect(validateSystemSettings(db)).rejects.toThrow('23 required keys');
    await expect(seedSystemSettings(db, [])).rejects.toThrow('Empty');
    await expect(seedSystemSettings(db, [SYSTEM_SETTINGS_DEFAULTS[0], { ...SYSTEM_SETTINGS_DEFAULTS[0], key: SYSTEM_SETTINGS_DEFAULTS[0].key.toUpperCase() }])).rejects.toThrow('Invalid');
    expect(sql.filter(query => query.startsWith('INSERT'))).toHaveLength(0);
  });
  it('propagates insert failures and validation failures', async () => {
    const { db } = fixture();
    jest.spyOn(db, 'prepare').mockImplementation(() => ({ run: async () => { throw Error('seed failed'); } } as never));
    await expect(seedSystemSettings(db)).rejects.toThrow('seed failed');
    jest.spyOn(db, 'prepare').mockImplementation(() => ({ run: async () => ({ changes: 0 }), all: async () => [] } as never));
    await expect(seedSystemSettings(db)).rejects.toThrow('validation failed');
  });
});
