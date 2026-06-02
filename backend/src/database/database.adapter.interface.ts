export type RowRecord = Record<string, unknown>;
export type RowArray = RowRecord[];

export interface IStatement {
  run(...params: unknown[]): Promise<{ lastInsertRowid?: number | bigint; changes: number }>;
  get(...params: unknown[]): Promise<RowRecord | undefined>;
  all(...params: unknown[]): Promise<RowArray>;
}

export interface IDatabaseAdapter {
  /** 执行任意 SQL（DDL 等） */
  exec(sql: string): Promise<void>;

  /** 返回预编译语句，支持 .run() / .get() / .all() */
  prepare(sql: string): IStatement;

  /** 手动事务控制 */
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;

  /** 关闭连接 */
  close(): Promise<void>;
}
