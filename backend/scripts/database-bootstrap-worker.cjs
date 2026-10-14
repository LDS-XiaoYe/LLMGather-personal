#!/usr/bin/env node
// Only called by the isolated test launcher. Never loads .env.
const path = require('node:path');
if (process.env.DATABASE_BOOTSTRAP_INTEGRATION !== 'true' || !/^seed_test_[a-z0-9_]+$/.test(process.env.MYSQL_DATABASE || '')) {
  throw new Error('Use the isolated database bootstrap test launcher');
}
require('reflect-metadata');
process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.json');
require('ts-node/register/transpile-only');
const { DatabaseService } = require('../src/database/database.service');
const { MysqlDatabaseAdapter } = require('../src/database/adapters/mysql.adapter');
const mode = process.argv[2] || 'bootstrap';
async function run() {
  if (mode === 'bootstrap') {
    const db = new DatabaseService();
    await db.initialize();
    if (!db.isReady) throw Error('Bootstrap did not become ready');
    await db.onModuleDestroy();
    console.log('PASS process bootstrap: schema + 23 settings validated');
    return;
  }
  if (mode === 'fail-seed' || mode === 'fail-schema') {
    const method = mode === 'fail-seed' ? 'prepare' : 'exec';
    const original = MysqlDatabaseAdapter.prototype[method];
    MysqlDatabaseAdapter.prototype[method] = function (sql, ...args) {
      if (mode === 'fail-seed' && /INSERT INTO system_settings/.test(sql)) {
        return { run: async () => { throw Object.assign(Error('SECRET_VALUE_SENTINEL'), { code: 'ER_TEST_SEED' }); } };
      }
      if (mode === 'fail-schema' && /CREATE TABLE/.test(sql)) {
        return Promise.reject(Object.assign(Error('SECRET_VALUE_SENTINEL'), { code: 'ER_TEST_SCHEMA' }));
      }
      return original.call(this, sql, ...args);
    };
  }
  if (mode === 'fail-connection') {
    process.env.MYSQL_PORT = '1';
    process.env.MYSQL_BOOTSTRAP_RETRIES = '2';
    process.env.MYSQL_CONNECT_TIMEOUT_MS = '100';
  }
  if (mode === 'fail-lock') process.env.MYSQL_BOOTSTRAP_LOCK_TIMEOUT_SECONDS = '1';
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../src/app.module');
  const { SystemSettingsService } = require('../src/common/system-settings.service');
  let app, listened = false;
  try {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    const settings = app.get(SystemSettingsService);
    if (!settings.getString('tier_labels')) throw Error('Cache not ready before app.listen');
    app.setGlobalPrefix('v1');
    await app.listen(0, '127.0.0.1');
    listened = true;
    const result = await fetch((await app.getUrl()) + '/v1/health');
    if (result.status !== 200 || !app.get(DatabaseService).isReady) throw Error('Application health failed');
    if (mode.startsWith('fail-')) throw Error('Unexpected Ready');
    console.log('PASS full NestJS fresh application: cached settings ready before listen; GET /v1/health=200');
  } catch (error) {
    if (!mode.startsWith('fail-') || listened || !/application not ready/.test(error.message) || /SECRET_VALUE_SENTINEL/.test(error.message)) throw error;
    console.log('PASS ' + mode + ': application not ready; listen=false; no sensitive values logged');
  } finally { if (app) await app.close(); }
}
run().then(() => process.exit(0)).catch(() => { console.error('FAIL isolated bootstrap worker'); process.exit(1); });
