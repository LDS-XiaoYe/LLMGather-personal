#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const defaultBackupDir = path.join(backendDir, 'sqlbackup');

function loadEnvFiles() {
  const files = [
    path.join(backendDir, '.env'),
    path.join(repoRoot, '.env'),
    path.join(backendDir, 'sqlbackup', '.env'),
    path.join(repoRoot, '.env.docker'),
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: false });
    }
  }
}

function parseArgs(argv) {
  const options = {
    backupDir: process.env.BACKUP_DIR || '',
    output: '',
    keepDays: Number(process.env.RETAIN_DAYS || 0),
    help: false,
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg.startsWith('--backup-dir=')) options.backupDir = arg.slice('--backup-dir='.length);
    else if (arg.startsWith('--out=')) options.output = arg.slice('--out='.length);
    else if (arg.startsWith('--keep-days=')) options.keepDays = Number(arg.slice('--keep-days='.length));
    else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`用法:
  node backend/scripts/export-sanitized-sql.cjs [--backup-dir=backend/sqlbackup] [--out=/path/to/file.sql] [--keep-days=30]

环境变量:
  MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
  兼容 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
  BACKUP_DIR      输出目录，默认 backend/sqlbackup
  RETAIN_DAYS     可选，清理多少天前的 sanitized SQL 备份

说明:
  导出完整表结构和数据，但会自动屏蔽 API Key、Token、Secret 等敏感字段。`);
}

function localTimestamp() {
  const d = new Date();
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function resolveOutputPath(options, database) {
  if (options.output) {
    return path.resolve(process.cwd(), options.output);
  }

  const backupDir = options.backupDir
    ? path.resolve(process.cwd(), options.backupDir)
    : defaultBackupDir;
  const safeDb = String(database || 'database').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return path.join(backupDir, `${safeDb}_sanitized_backup_${localTimestamp()}.sql`);
}

function getBaseConfig() {
  return {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'llmgather',
  };
}

function connectionCandidates(base) {
  const candidates = [
    base,
  ];

  const devPort = Number(process.env.MYSQL_DEV_PORT || 3307);
  candidates.push({ ...base, host: '127.0.0.1', port: devPort });
  candidates.push({ ...base, host: '127.0.0.1', port: 3306 });

  const seen = new Set();
  return candidates.filter((item) => {
    const key = `${item.host}:${item.port}:${item.user}:${item.database}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function connectMysql(baseConfig) {
  const errors = [];
  for (const candidate of connectionCandidates(baseConfig)) {
    try {
      const conn = await mysql.createConnection({
        ...candidate,
        charset: 'utf8mb4',
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
      });
      return { conn, config: candidate };
    } catch (error) {
      errors.push(`${candidate.host}:${candidate.port} -> ${error.message}`);
    }
  }

  throw new Error(`无法连接 MySQL。已尝试:\n${errors.map((item) => `  - ${item}`).join('\n')}`);
}

function quoteIdent(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';

  const text = String(value)
    .replace(/\0/g, '\\0')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
    .replace(/'/g, "''");
  return `'${text}'`;
}

const sensitiveJsonKeyPattern = /^(apiKey|api_key|api-key|key|token|accessToken|access_token|access-token|refreshToken|refresh_token|refresh-token|secret|clientSecret|client_secret|client-secret|password|privateKey|private_key|private-key)$/i;

function isSensitiveJsonKey(key) {
  return sensitiveJsonKeyPattern.test(String(key));
}

function redactValue(label) {
  return `__REDACTED_${label.toUpperCase()}__`;
}

function sanitizeJsonValue(value, stats) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item, stats));
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveJsonKey(key)) {
        next[key] = redactValue('secret');
        stats.json += 1;
      } else {
        next[key] = sanitizeJsonValue(item, stats);
      }
    }
    return next;
  }
  return value;
}

function maybeSanitizeJson(text, stats) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return text;

  try {
    const parsed = JSON.parse(trimmed);
    const before = stats.json;
    const sanitized = sanitizeJsonValue(parsed, stats);
    if (stats.json === before) return text;
    return JSON.stringify(sanitized);
  } catch {
    return text;
  }
}

function sanitizeColumnValue(table, column, value, stats) {
  const tableName = String(table).toLowerCase();
  const columnName = String(column).toLowerCase();

  if (value === null || value === undefined) return value;

  if (tableName === 'provider_api_keys' && columnName === 'api_key') {
    stats.direct += 1;
    return redactValue('api_key');
  }
  if (tableName === 'api_keys' && columnName === 'key_hash') {
    stats.direct += 1;
    return redactValue('api_key_hash');
  }

  if (
    columnName === 'api_key' ||
    columnName === 'apikey' ||
    columnName === 'access_token' ||
    columnName === 'refresh_token' ||
    columnName === 'token' ||
    columnName === 'secret' ||
    columnName === 'private_key'
  ) {
    stats.direct += 1;
    return redactValue(columnName.replace(/[^a-z0-9]+/g, '_'));
  }

  if (
    columnName.endsWith('_json') ||
    columnName === 'metadata' ||
    columnName === 'audit_metadata'
  ) {
    return maybeSanitizeJson(value, stats);
  }

  return value;
}

async function listTables(conn, database) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME AS tableName
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME ASC`,
    [database],
  );
  return rows.map((row) => row.tableName);
}

async function showCreateTable(conn, table) {
  const [rows] = await conn.query(`SHOW CREATE TABLE ${quoteIdent(table)}`);
  return rows[0]['Create Table'];
}

async function listColumns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${quoteIdent(table)}`);
  return rows.map((row) => row.Field);
}

async function dumpTableData(conn, stream, table, columns, stats) {
  const [rows] = await conn.query(
    `SELECT ${columns.map(quoteIdent).join(', ')} FROM ${quoteIdent(table)}`,
  );

  if (rows.length === 0) return 0;

  const columnSql = columns.map(quoteIdent).join(', ');
  for (const row of rows) {
    const values = columns.map((column) => sqlValue(sanitizeColumnValue(table, column, row[column], stats)));
    stream.write(`INSERT INTO ${quoteIdent(table)} (${columnSql}) VALUES (${values.join(', ')});\n`);
  }
  return rows.length;
}

function cleanupOldBackups(backupDir, database, keepDays) {
  if (!Number.isFinite(keepDays) || keepDays <= 0) return 0;
  if (!fs.existsSync(backupDir)) return 0;

  const now = Date.now();
  const maxAgeMs = keepDays * 24 * 60 * 60 * 1000;
  const prefix = `${database}_sanitized_backup_`;
  let removed = 0;

  for (const name of fs.readdirSync(backupDir)) {
    if (!name.startsWith(prefix) || !name.endsWith('.sql')) continue;
    const fullPath = path.join(backupDir, name);
    const stat = fs.statSync(fullPath);
    if (now - stat.mtimeMs > maxAgeMs) {
      fs.unlinkSync(fullPath);
      removed += 1;
    }
  }
  return removed;
}

async function main() {
  loadEnvFiles();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const baseConfig = getBaseConfig();
  const outputPath = resolveOutputPath(options, baseConfig.database);
  const backupDir = path.dirname(outputPath);
  fs.mkdirSync(backupDir, { recursive: true });

  const { conn, config } = await connectMysql(baseConfig);
  const stats = { direct: 0, json: 0 };
  let tableCount = 0;
  let rowCount = 0;

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8', mode: 0o600 });
  try {
    const tables = await listTables(conn, config.database);
    if (tables.length === 0) {
      throw new Error(`数据库 ${config.database} 中没有可导出的表`);
    }

    stream.write(`-- LLM Gather sanitized SQL backup\n`);
    stream.write(`-- Database: ${config.database}\n`);
    stream.write(`-- Created at: ${new Date().toISOString()}\n`);
    stream.write(`-- Sensitive API keys/tokens/secrets are redacted.\n\n`);
    stream.write(`SET NAMES utf8mb4;\n`);
    stream.write(`SET FOREIGN_KEY_CHECKS=0;\n\n`);

    for (const table of tables) {
      tableCount += 1;
      const createSql = await showCreateTable(conn, table);
      const columns = await listColumns(conn, table);

      stream.write(`--\n-- Table structure for ${quoteIdent(table)}\n--\n`);
      stream.write(`DROP TABLE IF EXISTS ${quoteIdent(table)};\n`);
      stream.write(`${createSql};\n\n`);

      stream.write(`--\n-- Data for ${quoteIdent(table)}\n--\n`);
      const rows = await dumpTableData(conn, stream, table, columns, stats);
      rowCount += rows;
      stream.write(`\n`);
    }

    stream.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
  } finally {
    await new Promise((resolve, reject) => {
      stream.end((error) => error ? reject(error) : resolve());
    });
    await conn.end();
  }

  const stat = fs.statSync(outputPath);
  if (stat.size < 100) {
    fs.unlinkSync(outputPath);
    throw new Error('备份文件过小，已删除异常输出');
  }

  const removed = cleanupOldBackups(backupDir, config.database, options.keepDays);
  console.log(`数据库已导出: ${outputPath}`);
  console.log(`表: ${tableCount}, 行: ${rowCount}, 已脱敏字段: ${stats.direct + stats.json}（列 ${stats.direct}, JSON ${stats.json}）`);
  if (removed > 0) console.log(`已清理旧备份: ${removed} 个`);
}

main().catch((error) => {
  console.error(`导出失败: ${error.message}`);
  process.exit(1);
});
