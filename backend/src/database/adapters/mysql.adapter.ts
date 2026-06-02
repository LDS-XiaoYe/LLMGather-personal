import { IDatabaseAdapter, IStatement, RowArray, RowRecord } from '../database.adapter.interface';
import type { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';

/**
 * 在 npm workspace 环境下，ESM import 无法找到提升到根 node_modules 的依赖。
 * 改用 require + 多路径回退，确保 mysql2 能被加载。
 */
function loadMysql2(): typeof import('mysql2/promise') {
  // 尝试 1：直接 require（正常安装路径）
  try {
    return require('mysql2/promise') as typeof import('mysql2/promise');
  } catch {}

  // 尝试 2：workspace 根目录
  try {
    const rootPath = require('path').join(__dirname, '../../../node_modules/mysql2/promise');
    return require(rootPath) as typeof import('mysql2/promise');
  } catch {}

  // 尝试 3：用 NODE_PATH 风格的绝对路径
  const candidates = [
    `${process.cwd()}/../node_modules/mysql2/promise`,
    `${__dirname}/../../../../../node_modules/mysql2/promise`,
  ];
  for (const p of candidates) {
    try {
      return require(require('path').resolve(p)) as typeof import('mysql2/promise');
    } catch {}
  }

  throw new Error(
    '[Database] mysql2 模块未正确加载！\n' +
    '请在项目根目录执行: npm install\n' +
    '请确认 MySQL 连接配置已正确设置\n\n' +
    `搜索路径:\n  ${candidates.join('\n  ')}`,
  );
}

// 延迟加载，避免模块顶层报错
let _mysql: typeof import('mysql2/promise') | null = null;
function getMysql() {
  if (!_mysql) _mysql = loadMysql2();
  return _mysql;
}

class MysqlStatement implements IStatement {
  constructor(
    private readonly executor: Pool | PoolConnection,
    private readonly sql: string,
  ) {}

  /** Convert all params to strings for mysql2 execute() compatibility. */
  private static toStrParams(params: unknown[]): string[] {
    return params.map((p) => (p === null || p === undefined ? '' : String(p)));
  }

  async run(...params: unknown[]): Promise<{ lastInsertRowid?: number | bigint; changes: number }> {
    const [result] = await this.executor.execute(this.sql, MysqlStatement.toStrParams(params));
    const r = result as ResultSetHeader;
    return { lastInsertRowid: r.insertId, changes: r.affectedRows };
  }

  async get(...params: unknown[]): Promise<RowRecord | undefined> {
    const [rows] = await this.executor.execute(this.sql, MysqlStatement.toStrParams(params));
    return (rows as RowArray)[0];
  }

  async all(...params: unknown[]): Promise<RowArray> {
    const [rows] = await this.executor.execute(this.sql, MysqlStatement.toStrParams(params));
    return rows as RowArray;
  }
}

export class MysqlDatabaseAdapter implements IDatabaseAdapter {
  private pool!: Pool;
  private connection!: PoolConnection;

  constructor(private readonly config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) {}

  async init(): Promise<void> {
    const mysql = getMysql();
    const { host, port, user, password, database } = this.config;

    // Step 1: 先不指定数据库连接（用于自动建库）
    console.log(`[Database] Connecting to ${host}:${port} (no db) ...`);
    const tempConn = await mysql.createConnection({ host, port, user, password });
    try {
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`[Database] MySQL database "${database}" ready.`);
    } finally {
      await tempConn.end();
    }

    // Step 2: 带数据库名创建正式连接池
    this.pool = mysql.createPool({
      host, port, user, password, database,
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: false,
      charset: 'utf8mb4',
    });
    this.connection = await this.pool.getConnection();
    console.log('[Database] MySQL pool initialized.');
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  prepare(sql: string): IStatement {
    // Use the pool so that each query gets a healthy connection.
    // This avoids stale-connection errors after MySQL wait_timeout.
    return new MysqlStatement(this.pool, sql);
  }

  async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.connection.commit();
  }

  async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  async close(): Promise<void> {
    this.connection.release();
    await this.pool.end();
  }
}
