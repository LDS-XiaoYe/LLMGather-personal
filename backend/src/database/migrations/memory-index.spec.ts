import { migrateMemoryIndex } from './memory-index';
describe('additive memory migration', () => {
  it('creates seven outbox fields, queue index and vector space registry', async () => {
    const db = { exec: jest.fn(async (_sql: string) => {}) };
    await migrateMemoryIndex(db as never);
    expect(db.exec).toHaveBeenCalledTimes(9);
    expect(db.exec.mock.calls.map(c => c[0]).join('\n')).not.toMatch(/DROP|DELETE/);
  });
  it('is restartable but does not hide real SQL errors', async () => {
    const db = { exec: jest.fn(async (sql: string) => {
      if (sql.startsWith('ALTER')) throw { code: 'ER_DUP_FIELDNAME' };
      if (sql.startsWith('CREATE INDEX')) throw { code: 'ER_DUP_KEYNAME' };
    }) };
    await expect(migrateMemoryIndex(db as never)).resolves.toBeUndefined();
    db.exec.mockRejectedValueOnce(new Error('disk full'));
    await expect(migrateMemoryIndex(db as never)).rejects.toThrow('disk full');
  });
});
