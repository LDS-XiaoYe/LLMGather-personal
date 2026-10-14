import { DatabaseService } from './database.service';
import { MysqlDatabaseAdapter } from './adapters/mysql.adapter';
import { SystemSettingsService } from '../common/system-settings.service';
import { bootstrapErrorCode, bootstrapInteger, retryMysqlConnection } from './bootstrap-retry';
import { seedSystemSettings } from './seeds/system-settings.seed';

jest.mock('./migrations/p0-infrastructure', () => ({ migrateP0: jest.fn() }));
jest.mock('./migrations/model-services', () => ({ migrateModelServices: jest.fn() }));
jest.mock('./migrations/memory-index', () => ({ migrateMemoryIndex: jest.fn() }));
jest.mock('./migrations/knowledge-lexical', () => ({ migrateKnowledgeLexical: jest.fn() }));
jest.mock('./seeds/system-settings.seed', () => ({ seedSystemSettings: jest.fn() }));
jest.mock('./adapters/mysql.adapter');

describe('database bootstrap readiness', () => {
  const oldEnv = { ...process.env };
  const close = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    close.mockResolvedValue(undefined);
    (MysqlDatabaseAdapter as jest.Mock).mockImplementation(() => ({
      init: jest.fn(), close,
      withInitializationLock: async (work: () => Promise<void>) => work(),
    }));
    (seedSystemSettings as jest.Mock).mockResolvedValue(undefined);
    for (const method of ['createTables', 'migrateColumnsIfNeeded', 'seedBuiltinTools', 'seedDefaultAgentSkills',
      'seedProviderConfigs', 'seedRouterRules']) {
      jest.spyOn(DatabaseService.prototype as any, method).mockResolvedValue(undefined);
    }
  });
  afterEach(() => { jest.restoreAllMocks(); process.env = { ...oldEnv }; });
  it('shares one initializer, seeds after schema, and marks ready only on success', async () => {
    const db = new DatabaseService();
    const first = db.initialize();
    expect(db.isReady).toBe(false);
    expect(db.initialize()).toBe(first);
    await Promise.all([first, db.onModuleInit()]);
    expect(db.isReady).toBe(true);
    expect(seedSystemSettings).toHaveBeenCalledTimes(1);
    const schema = (DatabaseService.prototype as any).createTables;
    expect(schema.mock.invocationCallOrder[0]).toBeLessThan((seedSystemSettings as jest.Mock).mock.invocationCallOrder[0]);
  });
  it.each(['schema', 'seed'])('fails closed on %s error without printing SQL/settings', async stage => {
    const sentinel = 'SECRET_VALUE_SENTINEL';
    const failure = Object.assign(new Error(sentinel), { code: 'ER_TEST_FAILURE', sql: sentinel });
    if (stage === 'schema') (DatabaseService.prototype as any).createTables.mockRejectedValue(failure);
    else (seedSystemSettings as jest.Mock).mockRejectedValue(failure);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = new DatabaseService();
    await expect(db.initialize()).rejects.toThrow('application not ready');
    expect(db.isReady).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sentinel);
  });
  it('retries transient connection failures finitely, without raw exception text', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const connect = jest.fn().mockRejectedValue(Object.assign(Error('SECRET_VALUE_SENTINEL'), { code: 'ECONNREFUSED' }));
    const sleep = jest.fn();
    await expect(retryMysqlConnection(connect, 3, 17, sleep)).rejects.toThrow('ECONNREFUSED');
    expect(connect).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET_VALUE_SENTINEL');
    connect.mockReset().mockRejectedValue(Object.assign(Error('secret'), { code: 'ER_ACCESS_DENIED_ERROR' }));
    await expect(retryMysqlConnection(connect, 3, 0, sleep)).rejects.toThrow('ER_ACCESS_DENIED_ERROR');
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('recovers connection and checks retry bounds and error codes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const connect = jest.fn().mockRejectedValueOnce({ code: 'ECONNREFUSED' }).mockResolvedValue('connected');
    await expect(retryMysqlConnection(connect, 2, 0, jest.fn())).resolves.toBe('connected');
    process.env.MYSQL_BOOTSTRAP_RETRIES = '0';
    expect(() => bootstrapInteger('MYSQL_BOOTSTRAP_RETRIES', 10, 1, 30)).toThrow('Invalid');
    expect(bootstrapErrorCode({ code: 'secret value' })).toBe('BOOTSTRAP_FAILED');
  });
  it('loads settings after readiness and never silently swallows cache errors', async () => {
    const order: string[] = [];
    const fake = { initialize: async () => { order.push('ready'); }, connection: { prepare: () => ({ all: async () => { order.push('cache'); return [{ key: 'test', value: 'custom' }]; } }) } };
    const settings = new SystemSettingsService(fake as unknown as DatabaseService);
    await settings.initialize();
    await settings.onModuleInit();
    expect(order).toEqual(['ready', 'cache']);
    expect(settings.getString('test')).toBe('custom');
    fake.connection.prepare = () => ({ all: async () => { throw Error('secret'); } });
    await expect(settings.reloadAll()).rejects.toThrow('cache load failed');
    expect(settings.getString('test')).toBe('custom');
  });
});
