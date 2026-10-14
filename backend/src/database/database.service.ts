import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { IDatabaseAdapter } from './database.adapter.interface';
import { MysqlDatabaseAdapter } from './adapters/mysql.adapter';
import { migrateP0 } from './migrations/p0-infrastructure';
import { migrateModelServices } from './migrations/model-services';
import { migrateMemoryIndex } from './migrations/memory-index';
import { migrateKnowledgeLexical } from './migrations/knowledge-lexical';
import { seedSystemSettings } from './seeds/system-settings.seed';
import { bootstrapErrorCode, bootstrapInteger, retryMysqlConnection } from './bootstrap-retry';

/**
 * 返回当前时间戳字符串（MySQL DATETIME(3) 兼容）
 */
export function dbNow(d = new Date()): string {
  // MySQL DATETIME(3) 格式：YYYY-MM-DD HH:mm:ss.SSS
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0') + ' ' +
    String(d.getHours()).padStart(2,'0') + ':' +
    String(d.getMinutes()).padStart(2,'0') + ':' +
    String(d.getSeconds()).padStart(2,'0') + '.' +
    String(d.getMilliseconds()).padStart(3,'0')
  );
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private adapter!: IDatabaseAdapter;
  private readonly sessions = new AsyncLocalStorage<IDatabaseAdapter>();

  constructor() {}

  private initialization?: Promise<void>;
  private ready = false;

  get isReady(): boolean { return this.ready; }

  initialize(): Promise<void> {
    return this.initialization ??= this.bootstrap();
  }

  async onModuleInit(): Promise<void> { await this.initialize(); }

  private async bootstrap(): Promise<void> {
    let stage = 'connection';
    console.log('[Database] Initializing: type = mysql');
    try {
      await this.initMysql();
      stage = 'bootstrap lock';
      await (this.adapter as MysqlDatabaseAdapter).withInitializationLock(async () => {
        stage = 'schema';
        await this.createTables();
        await this.migrateColumnsIfNeeded();
        await migrateP0(this.adapter);
        await migrateModelServices(this.adapter);
        await migrateMemoryIndex(this.adapter);
        stage = 'knowledge lexical index';
        await migrateKnowledgeLexical(this.adapter);
        stage = 'system_settings seed/validation';
        await seedSystemSettings(this.adapter);
        stage = 'existing bootstrap data';
        await this.seedBuiltinTools();
        await this.seedDefaultAgentSkills();
        await this.seedProviderConfigs();
        await this.seedRouterRules();
      }, bootstrapInteger('MYSQL_BOOTSTRAP_LOCK_TIMEOUT_SECONDS', 60, 1, 300));
      this.ready = true;
      console.log('[Database] Tables & seed data ready.');
    } catch (error) {
      if (this.adapter) await this.adapter.close().catch(() => {});
      const code = bootstrapErrorCode(error);
      console.error('[Database] initialization failed at ' + stage + ' (' + code + '); application not ready');
      throw new Error('[Database] initialization failed at ' + stage + ' (' + code + '); application not ready');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
    }
  }

  get connection(): IDatabaseAdapter {
    return this.sessions.getStore() ?? this.adapter;
  }

  transaction<T>(work: (session: Pick<IDatabaseAdapter, 'prepare' | 'exec'>) => Promise<T>): Promise<T> {
    const nested = this.sessions.getStore();
    if (nested) return work(nested);
    if (!this.adapter.transaction) throw new Error('Database transaction support is required');
    return this.adapter.transaction(tx => {
      // Every collaborating service resolves the same request-local SQL session.
      // Other concurrent requests continue to use the pool, not this transaction.
      const scoped = new Proxy(this.adapter, { get: (target, key) =>
        key === 'prepare' ? tx.prepare.bind(tx) : key === 'exec' ? tx.exec.bind(tx) : Reflect.get(target, key),
      });
      return this.sessions.run(scoped, () => work(scoped));
    });
  }

  /** 返回当前时间戳字符串（MySQL DATETIME(3) 兼容） */
  now(): string {
    return dbNow();
  }

  /* ------------------------------------------------------------------ */
  /*  MySQL 初始化                                                       */
  /* ------------------------------------------------------------------ */
  private async initMysql(): Promise<void> {
    const attempts = bootstrapInteger('MYSQL_BOOTSTRAP_RETRIES', 10, 1, 30);
    const delayMs = bootstrapInteger('MYSQL_BOOTSTRAP_RETRY_DELAY_MS', 2000, 0, 30000);
    const connectTimeout = bootstrapInteger('MYSQL_CONNECT_TIMEOUT_MS', 5000, 100, 30000);
    this.adapter = await retryMysqlConnection(async () => {
      const adapter = new MysqlDatabaseAdapter({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'llmgather',
        connectTimeout,
      });
      await adapter.init();
      return adapter;
    }, attempts, delayMs);
  }

  /* ------------------------------------------------------------------ */
  /*  建表（双引擎兼容）                                                  */
  /* ------------------------------------------------------------------ */
  private async createTables(): Promise<void> {
    await this.adapter.exec(`CREATE TABLE IF NOT EXISTS bootstrap_seed_state (
      name VARCHAR(64) PRIMARY KEY, completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    )`);
    // ── 类型别名（MySQL） ──
    const pk      = 'VARCHAR(36) PRIMARY KEY';
    const autoId  = 'INT AUTO_INCREMENT';
    const real    = 'DECIMAL(12,6) NOT NULL DEFAULT 0.000000';
    const int     = 'INT NOT NULL DEFAULT 0';
    const txt     = 'TEXT NOT NULL';
    const ts      = 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)';
    const fk      = ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id ${pk},
        username VARCHAR(64) UNIQUE,
        email VARCHAR(191) UNIQUE,
        email_verified INT NOT NULL DEFAULT 0,
        invitation_code VARCHAR(6) UNIQUE,
        invited_by VARCHAR(36),
        role VARCHAR(16) NOT NULL DEFAULT 'user',
        auth_version INT NOT NULL DEFAULT 0,
        password_hash ${txt}, salt ${txt},
        credits ${real}, total_spent ${real},
        created_at ${ts}
      )${fk};`);

    await this.adapter.exec(`CREATE TABLE IF NOT EXISTS auth_login_sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at BIGINT NOT NULL,
      INDEX idx_login_sessions_user (user_id),
      INDEX idx_login_sessions_expiry (expires_at)
    ) ENGINE=InnoDB${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id ${pk}, user_id VARCHAR(36) NOT NULL,
        chat_type VARCHAR(16) NOT NULL DEFAULT 'direct',
        title ${txt}, updated_at BIGINT NOT NULL, created_at BIGINT NOT NULL,
        deleted_at BIGINT DEFAULT NULL
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id ${autoId} PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
        role ${txt}, content TEXT NOT NULL, reasoning TEXT,
        model VARCHAR(128),
        sort_order ${int}, created_at BIGINT NOT NULL,
        deleted_at BIGINT DEFAULT NULL
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS billing_ledger (
        id ${pk}, user_id VARCHAR(36) NOT NULL,
        model VARCHAR(128) NOT NULL, request_type VARCHAR(32) NOT NULL,
        prompt_tokens ${int}, completion_tokens ${int}, total_tokens ${int},
        cost DECIMAL(14,6) NOT NULL,
        provider_name VARCHAR(64) NOT NULL DEFAULT '',
        provider_key_id VARCHAR(36) NOT NULL DEFAULT '',
        provider_key_name VARCHAR(128) NOT NULL DEFAULT '',
        provider_key_prefix VARCHAR(32) NOT NULL DEFAULT '',
        audit_metadata TEXT,
        created_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id ${pk}, user_id VARCHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL DEFAULT 'Default',
        key_hash VARCHAR(128) NOT NULL, key_prefix VARCHAR(16) NOT NULL,
        created_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS provider_api_keys (
        id ${pk},
        provider_name VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL DEFAULT 'Default',
        api_key TEXT NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        created_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS provider_configs (
        id ${pk},
        provider_name VARCHAR(64) NOT NULL UNIQUE,
        display_name VARCHAR(128) NOT NULL,
        base_url TEXT NOT NULL,
        models TEXT NOT NULL,
        model_prefix VARCHAR(32) DEFAULT NULL,
        auth_header VARCHAR(64) NOT NULL DEFAULT 'Authorization',
        auth_prefix VARCHAR(32) NOT NULL DEFAULT 'Bearer',
        timeout_ms INTEGER NOT NULL DEFAULT 25000,
        retry_count INTEGER NOT NULL DEFAULT 2,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at ${ts},
        updated_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS bailian_sync_credentials (
        id CHAR(64) PRIMARY KEY,
        owner_id VARCHAR(36) NOT NULL,
        region VARCHAR(32) NOT NULL,
        workspace_id VARCHAR(128) NOT NULL DEFAULT '',
        key_cipher TEXT NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        updated_at ${ts},
        INDEX idx_bailian_credential_owner (owner_id)
      ) ENGINE=InnoDB${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\` VARCHAR(128) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS recharge_orders (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        alipay_trade_no VARCHAR(64) DEFAULT NULL,
        qr_code TEXT DEFAULT NULL,
        created_at ${ts},
        paid_at DATETIME(3) DEFAULT NULL
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS router_rules (
        intent VARCHAR(32) PRIMARY KEY,
        models TEXT NOT NULL,
        updated_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS model_metrics (
        id ${autoId} PRIMARY KEY,
        model VARCHAR(128) NOT NULL,
        intent VARCHAR(32) DEFAULT NULL,
        latency_ms INT DEFAULT NULL,
        success INT NOT NULL DEFAULT 1,
        created_at ${ts}
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS semantic_cache (
        id ${pk},
        user_id VARCHAR(36) NOT NULL DEFAULT '',
        query_hash VARCHAR(64) NOT NULL,
        query_text TEXT NOT NULL,
        model VARCHAR(128) NOT NULL,
        response TEXT NOT NULL,
        tokens_saved ${int} DEFAULT 0,
        cost_saved DECIMAL(14,6) NOT NULL DEFAULT 0,
        hit_count ${int} DEFAULT 1,
        created_at ${ts},
        last_hit_at ${ts},
        INDEX idx_cache_user_hash (user_id, query_hash),
        INDEX idx_cache_user_model (user_id, model),
        INDEX idx_cache_hash (query_hash),
        INDEX idx_cache_model (model)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        description TEXT NOT NULL,
        model VARCHAR(128) NOT NULL,
        system_prompt TEXT NOT NULL,
        temperature DECIMAL(3,2) NOT NULL DEFAULT 0.70,
        max_tokens INT NOT NULL DEFAULT 1024,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        memory_enabled INT NOT NULL DEFAULT 1,
        published INT NOT NULL DEFAULT 0,
        api_enabled INT NOT NULL DEFAULT 0,
        public_slug VARCHAR(80) DEFAULT NULL,
        metadata TEXT,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agents_user (user_id),
        INDEX idx_agents_status (status),
        UNIQUE KEY uniq_agents_public_slug (public_slug),
        INDEX idx_agents_published (published, api_enabled)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id ${pk},
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        conversation_id VARCHAR(80) NOT NULL DEFAULT '',
        parent_run_id VARCHAR(36) DEFAULT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        model VARCHAR(128) NOT NULL,
        error TEXT NOT NULL,
        prompt_tokens INT NOT NULL DEFAULT 0,
        completion_tokens INT NOT NULL DEFAULT 0,
        total_tokens INT NOT NULL DEFAULT 0,
        latency_ms INT NOT NULL DEFAULT 0,
        created_at ${ts},
        completed_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agent_runs_agent (agent_id),
        INDEX idx_agent_runs_conversation (agent_id, user_id, conversation_id),
        INDEX idx_agent_runs_parent (parent_run_id),
        INDEX idx_agent_runs_user_created (user_id, created_at),
        INDEX idx_agent_runs_status (status)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id ${pk},
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        run_id VARCHAR(36) DEFAULT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'queued',
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT NOT NULL,
        options_json TEXT,
        created_at ${ts},
        started_at DATETIME(3) DEFAULT NULL,
        completed_at DATETIME(3) DEFAULT NULL,
        updated_at ${ts},
        INDEX idx_agent_tasks_agent (agent_id),
        INDEX idx_agent_tasks_user_created (user_id, created_at),
        INDEX idx_agent_tasks_status (status)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_run_steps (
        id ${autoId} PRIMARY KEY,
        run_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        step_type VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT NOT NULL,
        started_at ${ts},
        ended_at DATETIME(3) DEFAULT NULL,
        latency_ms INT NOT NULL DEFAULT 0,
        metadata TEXT,
        INDEX idx_agent_run_steps_run (run_id),
        INDEX idx_agent_run_steps_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_evaluations (
        id ${pk},
        agent_id VARCHAR(36) NOT NULL,
        run_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        score INT NOT NULL DEFAULT 0,
        grade VARCHAR(16) NOT NULL DEFAULT 'unknown',
        summary TEXT NOT NULL,
        rubric_json TEXT NOT NULL,
        created_at ${ts},
        INDEX idx_agent_evaluations_agent (agent_id, created_at),
        INDEX idx_agent_evaluations_run (run_id),
        INDEX idx_agent_evaluations_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_skills (
        id ${pk},
        user_id VARCHAR(36) DEFAULT NULL,
        name VARCHAR(80) NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'custom',
        icon VARCHAR(16) NOT NULL DEFAULT 'Star',
        input_schema_json TEXT,
        output_schema_json TEXT,
        permissions_json TEXT,
        example_input TEXT,
        example_output TEXT,
        risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
        version INT NOT NULL DEFAULT 1,
        enabled INT NOT NULL DEFAULT 1,
        created_at ${ts},
        updated_at ${ts},
        UNIQUE KEY uniq_agent_skills_user_name (user_id, name),
        INDEX idx_agent_skills_enabled (enabled),
        INDEX idx_agent_skills_category (category)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_skill_bindings (
        agent_id VARCHAR(36) NOT NULL,
        skill_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at ${ts},
        PRIMARY KEY (agent_id, skill_id),
        INDEX idx_agent_skill_bindings_user (user_id),
        INDEX idx_agent_skill_bindings_skill (skill_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_teams (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        description TEXT NOT NULL,
        strategy VARCHAR(24) NOT NULL DEFAULT 'sequential',
        members_json TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agent_teams_user (user_id),
        INDEX idx_agent_teams_status (status)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_team_runs (
        id ${pk},
        team_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT NOT NULL,
        member_outputs_json TEXT NOT NULL,
        latency_ms INT NOT NULL DEFAULT 0,
        created_at ${ts},
        completed_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agent_team_runs_team (team_id),
        INDEX idx_agent_team_runs_user_created (user_id, created_at)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id ${pk},
        user_id VARCHAR(36) DEFAULT NULL,
        name VARCHAR(80) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'builtin',
        schema_json TEXT NOT NULL,
        output_schema_json TEXT,
        permissions_json TEXT,
        implementation_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
        runtime VARCHAR(32) NOT NULL DEFAULT 'builtin',
        risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
        code LONGTEXT,
        version INT NOT NULL DEFAULT 1,
        timeout_ms INT NOT NULL DEFAULT 30000,
        retries INT NOT NULL DEFAULT 0,
        enabled INT NOT NULL DEFAULT 1,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        UNIQUE KEY uniq_tools_user_name (user_id, name),
        INDEX idx_tools_enabled (enabled)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_tools (
        agent_id VARCHAR(36) NOT NULL,
        tool_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        permission_level VARCHAR(24) NOT NULL DEFAULT 'auto',
        created_at ${ts},
        PRIMARY KEY (agent_id, tool_id),
        INDEX idx_agent_tools_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_marketplace_templates (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        source_agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'custom',
        template_json TEXT NOT NULL,
        public_enabled INT NOT NULL DEFAULT 1,
        created_at ${ts},
        updated_at ${ts},
        INDEX idx_agent_marketplace_user (user_id),
        INDEX idx_agent_marketplace_category (category)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS tool_invocations (
        id ${pk},
        tool_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) DEFAULT NULL,
        run_id VARCHAR(36) DEFAULT NULL,
        user_id VARCHAR(36) NOT NULL,
        tool_name VARCHAR(80) NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'succeeded',
        error TEXT NOT NULL,
        latency_ms INT NOT NULL DEFAULT 0,
        created_at ${ts},
        INDEX idx_tool_invocations_user (user_id, created_at),
        INDEX idx_tool_invocations_run (run_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'native',
        external_id VARCHAR(191) DEFAULT NULL,
        engine_config_json TEXT,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_kb_user (user_id),
        INDEX idx_kb_provider (provider),
        INDEX idx_kb_external (provider, external_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id ${pk},
        kb_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(191) NOT NULL,
        file_type VARCHAR(32) NOT NULL DEFAULT 'text',
        parse_status VARCHAR(24) NOT NULL DEFAULT 'succeeded',
        vector_status VARCHAR(24) NOT NULL DEFAULT 'succeeded',
        failure_reason TEXT,
        source_file_id VARCHAR(36) DEFAULT NULL,
        external_id VARCHAR(191) DEFAULT NULL,
        content LONGTEXT NOT NULL,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_kb_docs_kb (kb_id),
        INDEX idx_kb_docs_user (user_id),
        INDEX idx_kb_docs_external (external_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id ${pk},
        kb_id VARCHAR(36) NOT NULL,
        document_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        chunk_index INT NOT NULL DEFAULT 0,
        content TEXT NOT NULL,
        embedding_json TEXT,
        token_estimate INT NOT NULL DEFAULT 0,
        created_at ${ts},
        INDEX idx_kb_chunks_kb (kb_id),
        INDEX idx_kb_chunks_doc (document_id),
        FULLTEXT INDEX ft_kb_chunks_content (content)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS user_library_files (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        filename VARCHAR(191) NOT NULL,
        file_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
        mime_type VARCHAR(191) NOT NULL DEFAULT '',
        source VARCHAR(32) NOT NULL DEFAULT 'user_upload',
        kb_status VARCHAR(24) NOT NULL DEFAULT 'not_added',
        file_size INT NOT NULL DEFAULT 0,
        file_base64 LONGTEXT NOT NULL,
        parsed_content LONGTEXT,
        knowledge_document_id VARCHAR(36) DEFAULT NULL,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_user_library_user (user_id),
        INDEX idx_user_library_status (kb_status),
        INDEX idx_user_library_type (file_type)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        server_type VARCHAR(32) NOT NULL,
        config_json TEXT NOT NULL,
        enabled INT NOT NULL DEFAULT 1,
        last_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
        last_error TEXT NOT NULL,
        created_at ${ts},
        updated_at ${ts},
        INDEX idx_mcp_servers_user (user_id),
        INDEX idx_mcp_servers_type (server_type)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_versions (
        id ${pk},
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        version_number INT NOT NULL,
        label VARCHAR(120) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        traffic_percent INT NOT NULL DEFAULT 0,
        notes TEXT,
        snapshot_json LONGTEXT NOT NULL,
        published_at DATETIME(3) DEFAULT NULL,
        rolled_back_at DATETIME(3) DEFAULT NULL,
        created_at ${ts},
        UNIQUE KEY uniq_agent_versions_number (agent_id, version_number),
        INDEX idx_agent_versions_agent (agent_id),
        INDEX idx_agent_versions_user (user_id),
        INDEX idx_agent_versions_release (agent_id, status, published_at)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_test_suites (
        id ${pk},
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT NOT NULL,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agent_test_suites_agent (agent_id),
        INDEX idx_agent_test_suites_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_test_cases (
        id ${pk},
        suite_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        input TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        rubric TEXT NOT NULL,
        created_at ${ts},
        updated_at ${ts},
        INDEX idx_agent_test_cases_suite (suite_id),
        INDEX idx_agent_test_cases_agent (agent_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_test_runs (
        id ${pk},
        suite_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        summary_json TEXT NOT NULL,
        case_results_json LONGTEXT NOT NULL,
        created_at ${ts},
        completed_at DATETIME(3) DEFAULT NULL,
        INDEX idx_agent_test_runs_suite (suite_id),
        INDEX idx_agent_test_runs_agent (agent_id),
        INDEX idx_agent_test_runs_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
        agent_id VARCHAR(36) NOT NULL,
        kb_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at ${ts},
        PRIMARY KEY (agent_id, kb_id),
        INDEX idx_agent_kbs_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_workflows (
        agent_id VARCHAR(36) NOT NULL,
        workflow_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at ${ts},
        PRIMARY KEY (agent_id, workflow_id),
        INDEX idx_agent_workflows_user (user_id),
        INDEX idx_agent_workflows_workflow (workflow_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_sub_agents (
        agent_id VARCHAR(36) NOT NULL,
        sub_agent_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at ${ts},
        PRIMARY KEY (agent_id, sub_agent_id),
        INDEX idx_agent_sub_agents_user (user_id),
        INDEX idx_agent_sub_agents_sub_agent (sub_agent_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) DEFAULT NULL,
        namespace VARCHAR(64) NOT NULL DEFAULT 'default',
        memory_type VARCHAR(32) NOT NULL DEFAULT 'fact',
        content TEXT NOT NULL,
        importance INT NOT NULL DEFAULT 3,
        metadata TEXT,
        provider VARCHAR(32) NOT NULL DEFAULT 'native',
        external_id VARCHAR(191) NOT NULL DEFAULT '',
        provider_payload LONGTEXT,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_memories_user_agent (user_id, agent_id),
        INDEX idx_memories_provider (provider, external_id),
        FULLTEXT INDEX ft_memories_content (content)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        definition_json LONGTEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_workflows_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id ${pk},
        workflow_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT NOT NULL,
        created_at ${ts},
        completed_at DATETIME(3) DEFAULT NULL,
        INDEX idx_workflow_runs_workflow (workflow_id),
        INDEX idx_workflow_runs_user (user_id, created_at)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS workflow_run_steps (
        id ${autoId} PRIMARY KEY,
        run_id VARCHAR(36) NOT NULL,
        workflow_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        node_id VARCHAR(64) NOT NULL,
        node_type VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'succeeded',
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT NOT NULL,
        created_at ${ts},
        INDEX idx_workflow_run_steps_run (run_id)
      )${fk};`);
  }

  /* ------------------------------------------------------------------ */
  /*  迁移：修正已存在的列类型（版本升级时自动修复）                        */
  /* ------------------------------------------------------------------ */
  private async migrateColumnsIfNeeded(): Promise<void> {
    const pk = 'VARCHAR(36) PRIMARY KEY';
    const ts = 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)';
    const fk = ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

    // billing_ledger.cost: DECIMAL(12,8) → DECIMAL(14,6)
    try {
      await this.adapter.exec(
        `ALTER TABLE billing_ledger MODIFY COLUMN cost DECIMAL(14,6) NOT NULL`,
      );
    } catch {
      // 同上
    }

    for (const statement of [
      `ALTER TABLE billing_ledger ADD COLUMN provider_name VARCHAR(64) NOT NULL DEFAULT ''`,
      `ALTER TABLE billing_ledger ADD COLUMN provider_key_id VARCHAR(36) NOT NULL DEFAULT ''`,
      `ALTER TABLE billing_ledger ADD COLUMN provider_key_name VARCHAR(128) NOT NULL DEFAULT ''`,
      `ALTER TABLE billing_ledger ADD COLUMN provider_key_prefix VARCHAR(32) NOT NULL DEFAULT ''`,
      `ALTER TABLE billing_ledger ADD COLUMN audit_metadata TEXT`,
      `CREATE INDEX idx_billing_provider_key ON billing_ledger (provider_name, provider_key_id)`,
      `ALTER TABLE agent_runs ADD COLUMN conversation_id VARCHAR(80) NOT NULL DEFAULT ''`,
      `ALTER TABLE agent_runs ADD COLUMN parent_run_id VARCHAR(36) DEFAULT NULL`,
      `UPDATE agent_runs SET conversation_id = id WHERE conversation_id = '' OR conversation_id IS NULL`,
      `CREATE INDEX idx_agent_runs_conversation ON agent_runs (agent_id, user_id, conversation_id)`,
      `CREATE INDEX idx_agent_runs_parent ON agent_runs (parent_run_id)`,
    ]) {
      try {
        await this.adapter.exec(statement);
      } catch {}
    }

    // 统一字符集为 utf8mb4，避免 collation 不兼容错误
    const versionSnapshotColumn = await this.adapter.prepare("SELECT DATA_TYPE as dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_versions' AND COLUMN_NAME = 'snapshot_json'").get() as { dataType?: string } | undefined;
    if (versionSnapshotColumn && versionSnapshotColumn.dataType !== 'longtext') await this.adapter.exec('ALTER TABLE agent_versions MODIFY COLUMN snapshot_json LONGTEXT NOT NULL');
    const tables = ['users', 'conversations', 'conversation_messages', 'billing_ledger', 'api_keys', 'provider_api_keys', 'provider_configs', 'agents', 'agent_runs', 'agent_tasks', 'agent_run_steps', 'agent_evaluations', 'agent_skills', 'agent_skill_bindings', 'agent_teams', 'agent_team_runs', 'agent_versions', 'agent_test_suites', 'agent_test_cases', 'agent_test_runs', 'mcp_servers', 'tools', 'agent_tools', 'agent_marketplace_templates', 'tool_invocations', 'knowledge_bases', 'knowledge_documents', 'knowledge_chunks', 'user_library_files', 'agent_knowledge_bases', 'agent_workflows', 'agent_sub_agents', 'memories', 'workflows', 'workflow_runs', 'workflow_run_steps'];
    for (const table of tables) {
      try {
        await this.adapter.exec(
          `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      } catch {
        // 表不存在或已是目标字符集，忽略
      }
    }

    // ── 双引擎：新增列（ALTER TABLE ADD COLUMN，已有则忽略） ──
    // conversations: add chat_type column
    try {
      await this.adapter.exec(
        `ALTER TABLE conversations ADD COLUMN chat_type VARCHAR(16) NOT NULL DEFAULT 'direct'`,
      );
    } catch {
      // column already exists
    }

    // conversation_messages: add model column
    try {
      await this.adapter.exec(
        `ALTER TABLE conversation_messages ADD COLUMN model VARCHAR(128)`,
      );
    } catch {
      // column already exists
    }

    // semantic_cache: add user_id column for per-user cache isolation
    try {
      await this.adapter.exec(
        `ALTER TABLE semantic_cache ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''`,
      );
    } catch {
      // column already exists
    }
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_cache_user_hash ON semantic_cache (user_id, query_hash)`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_cache_user_model ON semantic_cache (user_id, model)`,
      );
    } catch {}

    try {
      await this.adapter.exec(
        `ALTER TABLE knowledge_bases ADD COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'native'`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE knowledge_bases ADD COLUMN external_id VARCHAR(191) DEFAULT NULL`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE knowledge_bases ADD COLUMN engine_config_json TEXT`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_kb_provider ON knowledge_bases (provider)`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_kb_external ON knowledge_bases (provider, external_id)`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE knowledge_documents ADD COLUMN external_id VARCHAR(191) DEFAULT NULL`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_kb_docs_external ON knowledge_documents (external_id)`,
      );
    } catch {}

    try {
      await this.adapter.exec(
        `ALTER TABLE agent_versions ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'draft'`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE agent_versions ADD COLUMN traffic_percent INT NOT NULL DEFAULT 0`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE agent_versions ADD COLUMN notes TEXT`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE agent_versions ADD COLUMN published_at DATETIME(3) DEFAULT NULL`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `ALTER TABLE agent_versions ADD COLUMN rolled_back_at DATETIME(3) DEFAULT NULL`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `CREATE INDEX idx_agent_versions_release ON agent_versions (agent_id, status, published_at)`,
      );
    } catch {}

    try {
      await this.adapter.exec(`
        CREATE TABLE IF NOT EXISTS agent_tasks (
          id ${pk},
          agent_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          run_id VARCHAR(36) DEFAULT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'queued',
          input TEXT NOT NULL,
          output TEXT NOT NULL,
          error TEXT NOT NULL,
          options_json TEXT,
          created_at ${ts},
          started_at DATETIME(3) DEFAULT NULL,
          completed_at DATETIME(3) DEFAULT NULL,
          updated_at ${ts},
          INDEX idx_agent_tasks_agent (agent_id),
          INDEX idx_agent_tasks_user_created (user_id, created_at),
          INDEX idx_agent_tasks_status (status)
        )${fk};`);
    } catch {}

    try {
      await this.adapter.exec(`
        CREATE TABLE IF NOT EXISTS agent_workflows (
          agent_id VARCHAR(36) NOT NULL,
          workflow_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          created_at ${ts},
          PRIMARY KEY (agent_id, workflow_id),
          INDEX idx_agent_workflows_user (user_id),
          INDEX idx_agent_workflows_workflow (workflow_id)
        )${fk};`);
    } catch {}

    // conversations: add deleted_at column
    try {
      await this.adapter.exec(
        `ALTER TABLE conversations ADD COLUMN deleted_at BIGINT DEFAULT NULL`,
      );
    } catch {
      // column already exists
    }

    // conversation_messages: add deleted_at column
    try {
      await this.adapter.exec(
        `ALTER TABLE conversation_messages ADD COLUMN deleted_at BIGINT DEFAULT NULL`,
      );
    } catch {
      // column already exists
    }

    // Fix incorrectly soft‑deleted records (deleted_at = 0)
    try {
      await this.adapter.exec(
        `UPDATE conversations SET deleted_at = NULL WHERE deleted_at = 0`,
      );
    } catch {}
    try {
      await this.adapter.exec(
        `UPDATE conversation_messages SET deleted_at = NULL WHERE deleted_at = 0`,
      );
    } catch {}

    // users: add role column
    try {
      await this.adapter.exec(
        `ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user'`,
      );
    } catch {
      // column already exists
    }

    // provider_api_keys: rename encrypted_key → api_key (plaintext storage)
    try {
      await this.adapter.exec(
        `ALTER TABLE provider_api_keys CHANGE COLUMN encrypted_key api_key TEXT NOT NULL`,
      );
    } catch {
      // column already renamed or doesn't exist
    }

    // users: add invitation_code column
    try {
      await this.adapter.exec(
        `ALTER TABLE users ADD COLUMN invitation_code VARCHAR(6) UNIQUE`,
      );
    } catch {
      // column already exists
    }

    // users: add invited_by column (references inviter's user id)
    try {
      await this.adapter.exec(
        `ALTER TABLE users ADD COLUMN invited_by VARCHAR(36)`,
      );
    } catch {
      // column already exists
    }

    // users: add email column
    try {
      await this.adapter.exec(
        `ALTER TABLE users ADD COLUMN email VARCHAR(191) UNIQUE`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE users ADD COLUMN email_verified INT NOT NULL DEFAULT 0`,
      );
    } catch {
      // column already exists
    }

    // Never turn an administrator's unverified account back into a verified account on restart.
    try { await this.adapter.exec('ALTER TABLE users ADD COLUMN auth_version INT NOT NULL DEFAULT 0'); }
    catch (error) { if ((error as {code?: string}).code !== 'ER_DUP_FIELDNAME') throw error; }

    // email_verification_codes table
    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id ${pk},
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(32) NOT NULL DEFAULT 'register',
        expires_at ${ts},
        used_at DATETIME(3) DEFAULT NULL,
        created_at ${ts}
      )${fk};`);

    // Generate invitation codes for existing users who don't have one
    await this.generateInvitationCodesForExistingUsers();

    try {
      await this.adapter.exec(
        `ALTER TABLE agents ADD COLUMN memory_enabled INT NOT NULL DEFAULT 1`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE memories ADD COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'native'`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE memories ADD COLUMN external_id VARCHAR(191) NOT NULL DEFAULT ''`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE memories ADD COLUMN provider_payload LONGTEXT`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE agents ADD COLUMN published INT NOT NULL DEFAULT 0`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE agents ADD COLUMN api_enabled INT NOT NULL DEFAULT 0`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE agents ADD COLUMN public_slug VARCHAR(80) DEFAULT NULL`,
      );
    } catch {
      // column already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE agents ADD UNIQUE KEY uniq_agents_public_slug (public_slug)`,
      );
    } catch {
      // index already exists
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE knowledge_chunks ADD COLUMN embedding_json TEXT`,
      );
    } catch {
      // column already exists
    }

    const knowledgeDocumentColumns = [
      `ALTER TABLE knowledge_documents ADD COLUMN file_type VARCHAR(32) NOT NULL DEFAULT 'text'`,
      `ALTER TABLE knowledge_documents ADD COLUMN parse_status VARCHAR(24) NOT NULL DEFAULT 'succeeded'`,
      `ALTER TABLE knowledge_documents ADD COLUMN vector_status VARCHAR(24) NOT NULL DEFAULT 'succeeded'`,
      `ALTER TABLE knowledge_documents ADD COLUMN failure_reason TEXT`,
      `ALTER TABLE knowledge_documents ADD COLUMN source_file_id VARCHAR(36) DEFAULT NULL`,
    ];
    for (const sql of knowledgeDocumentColumns) {
      try {
        await this.adapter.exec(sql);
      } catch {
        // column already exists
      }
    }

    try {
      await this.adapter.exec(
        `ALTER TABLE agent_tools ADD COLUMN permission_level VARCHAR(24) NOT NULL DEFAULT 'auto'`,
      );
    } catch {
      // column already exists
    }

    const skillColumns = [
      `ALTER TABLE agent_skills ADD COLUMN icon VARCHAR(16) NOT NULL DEFAULT 'Star'`,
      `ALTER TABLE agent_skills ADD COLUMN input_schema_json TEXT`,
      `ALTER TABLE agent_skills ADD COLUMN output_schema_json TEXT`,
      `ALTER TABLE agent_skills ADD COLUMN permissions_json TEXT`,
      `ALTER TABLE agent_skills ADD COLUMN example_input TEXT`,
      `ALTER TABLE agent_skills ADD COLUMN example_output TEXT`,
      `ALTER TABLE agent_skills ADD COLUMN risk_level VARCHAR(16) NOT NULL DEFAULT 'low'`,
      `ALTER TABLE agent_skills ADD COLUMN version INT NOT NULL DEFAULT 1`,
    ];
    for (const sql of skillColumns) {
      try {
        await this.adapter.exec(sql);
      } catch {
        // column already exists
      }
    }

    const toolColumns = [
      `ALTER TABLE tools ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'builtin'`,
      `ALTER TABLE tools ADD COLUMN output_schema_json TEXT`,
      `ALTER TABLE tools ADD COLUMN permissions_json TEXT`,
      `ALTER TABLE tools ADD COLUMN runtime VARCHAR(32) NOT NULL DEFAULT 'builtin'`,
      `ALTER TABLE tools ADD COLUMN risk_level VARCHAR(16) NOT NULL DEFAULT 'low'`,
      `ALTER TABLE tools ADD COLUMN code LONGTEXT`,
      `ALTER TABLE tools ADD COLUMN version INT NOT NULL DEFAULT 1`,
      `ALTER TABLE tools ADD COLUMN timeout_ms INT NOT NULL DEFAULT 30000`,
      `ALTER TABLE tools ADD COLUMN retries INT NOT NULL DEFAULT 0`,
      `ALTER TABLE tools ADD COLUMN deleted_at DATETIME(3) DEFAULT NULL`,
    ];
    for (const sql of toolColumns) {
      try {
        await this.adapter.exec(sql);
      } catch {
        // column already exists
      }
    }
  }

  private async seedBuiltinTools(): Promise<void> {
    const now = dbNow();
    const randomUUID = (await import('crypto')).randomUUID;
    const codeOutputSchema = {
      type: 'object',
      properties: {
        result: { description: '代码返回值。' },
        logs: { type: 'array', items: { type: 'string' }, description: '代码运行期间的日志。' },
        stdout: { type: 'string', description: '容器执行标准输出。' },
        stderr: { type: 'string', description: '容器执行错误输出。' },
      },
    };
    const tools: Array<{
      name: string;
      displayName: string;
      description: string;
      schema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
      category?: string;
      riskLevel?: 'low' | 'medium' | 'high';
    }> = [
      {
        name: 'current_time',
        displayName: '当前时间',
        description: '返回当前服务器时间，可用于日期、时间、时区相关任务。',
        schema: { type: 'object', properties: { timezone: { type: 'string', default: 'Asia/Shanghai' } } },
        outputSchema: { type: 'object', properties: { datetimeText: { type: 'string', description: '按指定时区格式化后的时间文本。' } } },
      },
      {
        name: 'calculator',
        displayName: '安全计算器',
        description: '执行简单数学表达式计算，仅支持数字和 + - * / % ^ ( ) . 运算符。',
        schema: { type: 'object', required: ['expression'], properties: { expression: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' }, text: { type: 'string' } } },
      },
      {
        name: 'javascript_runner',
        displayName: '受限 JS 代码执行',
        description: '在受限沙箱中运行短 JavaScript 片段，适合 Agent 做数据转换、轻量计算和调试验证。',
        schema: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: 'JavaScript 代码，最后一个表达式会作为 result 返回。' },
            input: { type: 'object', description: '传入代码的 JSON 输入，可通过 input 变量访问。' },
          },
        },
        outputSchema: codeOutputSchema,
      },
      {
        name: 'container_javascript_runner',
        displayName: '容器 JS 沙箱',
        description: '通过独立 code-runner 容器运行短 JavaScript 片段，用于更隔离的代码执行。',
        schema: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string' },
            input: { type: 'object' },
          },
        },
        outputSchema: codeOutputSchema,
      },
      {
        name: 'python_runner',
        displayName: 'Python 代码执行',
        description: '在容器中运行 Python 代码片段，支持数据处理、计算和文件操作。',
        schema: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: 'Python 代码，可通过 input 变量访问输入数据。' },
            input: { type: 'object', description: '传入代码的 JSON 输入，可通过 input 变量访问。' },
          },
        },
        outputSchema: codeOutputSchema,
      },
      {
        name: 'notion_search',
        displayName: 'Notion 搜索',
        description: '通过已配置的 Notion MCP Server 搜索页面和数据库标题。',
        schema: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', default: 5 },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  url: { type: 'string' },
                  object: { type: 'string' },
                },
              },
            },
          },
        },
      },
      {
        name: 'browser_fetch',
        displayName: '网页读取',
        description: '读取公开网页的标题和正文摘要，作为 Browser Use / Computer Use 的第一版网页工具。',
        schema: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            maxChars: { type: 'number', default: 6000 },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
      {
        name: 'tavily_search',
        displayName: 'Tavily 联网搜索',
        description: '通过 Tavily 真实搜索接口检索网页信息，适合调研、事实核验、资料收集和带来源的回答。需要配置 TAVILY_API_KEY。',
        category: 'research',
        riskLevel: 'low',
        schema: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', description: '搜索问题或关键词。' },
            searchDepth: { type: 'string', enum: ['basic', 'advanced'], default: 'basic' },
            maxResults: { type: 'number', default: 5 },
            includeAnswer: { type: 'boolean', default: true },
            includeRawContent: { type: 'boolean', default: false },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            query: { type: 'string' },
            answer: { type: 'string' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  url: { type: 'string' },
                  content: { type: 'string' },
                  score: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        name: 'weather_query',
        displayName: '真实天气查询',
        description: '通过 Open-Meteo 真实天气接口查询当前位置天气和未来几天预报。支持城市名或经纬度。',
        category: 'utility',
        riskLevel: 'low',
        schema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: '城市、地区或地点名称，例如 北京、上海、Tokyo、New York。提供 latitude/longitude 时可省略。' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            forecastDays: { type: 'number', default: 3 },
            language: { type: 'string', default: 'zh' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            location: { type: 'object' },
            timezone: { type: 'string' },
            current: { type: 'object' },
            daily: { type: 'array', items: { type: 'object' } },
            sourceUrls: { type: 'object' },
          },
        },
      },
      {
        name: 'text_stats',
        displayName: '文本统计',
        description: '统计文本的字符数、中文字符数、英文词数和行数。',
        schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { chars: { type: 'number' }, cjkChars: { type: 'number' }, englishWords: { type: 'number' }, lines: { type: 'number' } } },
      },
      {
        name: 'uuid',
        displayName: 'UUID 生成器',
        description: '生成一个随机 UUID。',
        schema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { uuid: { type: 'string' } } },
      },
      {
        name: 'platform_agent_api',
        displayName: '平台 Agent API',
        description: '让 Agent 通过受控平台 API 查询、创建、更新 Agent 与 Workflow，并把执行结果返回给用户。高风险工具，建议设置为 confirm。',
        category: 'platform',
        riskLevel: 'high',
        schema: {
          type: 'object',
          required: ['operation'],
          properties: {
            operation: {
              type: 'string',
              enum: [
                'list_agents',
                'get_agent',
                'create_agent',
                'update_agent',
                'list_workflows',
                'create_workflow',
                'bind_workflow_to_agent',
                'list_agent_tasks',
                'create_agent_task',
                'list_agent_versions',
                'create_agent_version',
                'publish_agent_version',
                'compare_agent_versions',
                'restore_agent_version',
                'rollback_agent_version',
                'save_file_to_user_library',
                'self_optimize_agent',
                'create_skill',
                'update_skill',
                'bind_skill_to_agent',
                'create_tool',
                'update_tool',
                'bind_tool_to_agent',
                'list_tools',
                'list_skills',
                'list_knowledge_bases',
              ],
            },
            agentId: { type: 'string' },
            workflowId: { type: 'string' },
            taskId: { type: 'string' },
            versionId: { type: 'string' },
            leftVersionId: { type: 'string' },
            rightVersionId: { type: 'string' },
            skillId: { type: 'string' },
            toolId: { type: 'string' },
            agent: { type: 'object' },
            workflow: { type: 'object' },
            task: { type: 'object', description: '后台任务配置，字段包含 input、mode、maxSteps。' },
            version: { type: 'object', description: '版本发布配置，字段包含 label、notes、releaseMode、trafficPercent、publicSlug、published、apiEnabled。' },
            file: { type: 'object', description: '保存到用户库的文件，字段包含 filename、content、mimeType、source。' },
            optimization: { type: 'object', description: 'Agent 自优化补丁，字段包含 goal、findings、systemPromptPatch、toolIds、skillIds、workflowIds 等。' },
            skill: { type: 'object' },
            tool: { type: 'object' },
            limit: { type: 'number', default: 20 },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string' },
            data: { type: 'object' },
            items: { type: 'array', items: { type: 'object' } },
            agent: { type: 'object' },
            workflow: { type: 'object' },
            skill: { type: 'object' },
            tool: { type: 'object' },
            version: { type: 'object' },
            task: { type: 'object' },
            error: { type: 'string' },
          },
        },
      },
    ];

    for (const tool of tools) {
      const existing = await this.adapter.prepare(
        'SELECT id FROM tools WHERE user_id IS NULL AND name = ? LIMIT 1',
      ).get(tool.name) as { id: string } | undefined;

      if (existing) {
        await this.adapter.prepare(
          `UPDATE tools
           SET display_name = ?, description = ?, category = ?, schema_json = ?, output_schema_json = ?, risk_level = ?, enabled = 1, updated_at = ?
           WHERE id = ?`,
        ).run(tool.displayName, tool.description, tool.category ?? 'builtin', JSON.stringify(tool.schema), JSON.stringify(tool.outputSchema), tool.riskLevel ?? 'low', now, existing.id);
      } else {
        await this.adapter.prepare(
          `INSERT INTO tools (id, user_id, name, display_name, description, category, schema_json, output_schema_json, implementation_type, runtime, risk_level, enabled, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'builtin', 'builtin', ?, 1, ?, ?)`,
        ).run(randomUUID(), tool.name, tool.displayName, tool.description, tool.category ?? 'builtin', JSON.stringify(tool.schema), JSON.stringify(tool.outputSchema), tool.riskLevel ?? 'low', now, now);
      }
    }
  }

  private async seedDefaultAgentSkills(): Promise<void> {
    const now = dbNow();
    const randomUUID = (await import('crypto')).randomUUID;
    const skills: Array<{ name: string; description: string; content: string; category: string; icon: string; permissions: Record<string, unknown>; exampleInput: string; exampleOutput: string; riskLevel: string }> = [
      {
        name: 'Research Planner',
        description: '将开放式研究问题拆解为检索、证据评估、结论综合和不确定性标注。',
        category: 'research',
        icon: 'Search',
        permissions: { network: true, knowledge: true, tools: false, fileRead: false, writeData: false, externalRequest: true, userConfirm: false },
        exampleInput: '调研某个新产品机会，并列出证据链。',
        exampleOutput: '研究计划、信息缺口、证据摘要、不确定性和下一步建议。',
        riskLevel: 'medium',
        content: [
          '你具备 Research Agent 能力。',
          '处理研究任务时先拆解问题、列出信息缺口，再基于可用知识库/工具给出证据链。',
          '必须区分事实、推断和建议；遇到证据不足时标注不确定性。',
        ].join('\n'),
      },
      {
        name: 'Code Operator',
        description: '让 Agent 更适合阅读代码、生成代码、调用代码执行工具并解释调试结果。',
        category: 'code',
        icon: 'Cpu',
        permissions: { network: false, knowledge: false, tools: true, fileRead: true, writeData: false, externalRequest: false, userConfirm: true },
        exampleInput: '分析这段代码的 bug，并给出可运行修复。',
        exampleOutput: '问题定位、修复代码、验证方式和边界情况。',
        riskLevel: 'high',
        content: [
          '你具备 Code Agent 能力。',
          '涉及代码任务时先说明假设，再给出可运行片段或修改建议。',
          '可以使用代码执行工具验证轻量逻辑；输出时包含输入、关键步骤、结果和边界情况。',
        ].join('\n'),
      },
      {
        name: 'Data Analyst',
        description: '面向数据分析任务，强调指标定义、数据清洗、计算验证和业务解释。',
        category: 'analysis',
        icon: 'DataAnalysis',
        permissions: { network: false, knowledge: true, tools: true, fileRead: true, writeData: false, externalRequest: false, userConfirm: false },
        exampleInput: '基于一组销售数据分析增长和异常。',
        exampleOutput: '指标口径、计算结果、异常解释和业务建议。',
        riskLevel: 'medium',
        content: [
          '你具备 Data Analysis Agent 能力。',
          '先明确指标口径和数据字段，再进行计算、对比和异常解释。',
          '如果使用工具得到中间结果，需要把结果转化为业务可理解的结论。',
        ].join('\n'),
      },
      {
        name: 'Workflow Orchestrator',
        description: '帮助 Agent 面向复杂任务进行阶段规划、工具/RAG/记忆协同和复盘。',
        category: 'workflow',
        icon: 'Share',
        permissions: { network: false, knowledge: true, tools: true, fileRead: false, writeData: false, externalRequest: false, userConfirm: false },
        exampleInput: '把一个复杂任务拆成可执行流程。',
        exampleOutput: '计划、节点、依赖、校验和复盘结构。',
        riskLevel: 'low',
        content: [
          '你具备 Workflow Orchestration 能力。',
          '复杂任务要拆成计划、执行、校验、总结四个阶段。',
          '优先复用可用工具、知识库和长期记忆；最后输出可复盘的执行轨迹。',
        ].join('\n'),
      },
    ];

    for (const skill of skills) {
      const existing = await this.adapter.prepare(
        'SELECT id FROM agent_skills WHERE user_id IS NULL AND name = ? LIMIT 1',
      ).get(skill.name) as { id: string } | undefined;

      if (existing) {
        await this.adapter.prepare(
          `UPDATE agent_skills
           SET description = ?, content = ?, category = ?, icon = ?, permissions_json = ?, example_input = ?, example_output = ?, risk_level = ?, enabled = 1, updated_at = ?
           WHERE id = ?`,
        ).run(skill.description, skill.content, skill.category, skill.icon, JSON.stringify(skill.permissions), skill.exampleInput, skill.exampleOutput, skill.riskLevel, now, existing.id);
      } else {
        await this.adapter.prepare(
          `INSERT INTO agent_skills
             (id, user_id, name, description, content, category, icon, permissions_json, example_input, example_output, risk_level, enabled, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(randomUUID(), skill.name, skill.description, skill.content, skill.category, skill.icon, JSON.stringify(skill.permissions), skill.exampleInput, skill.exampleOutput, skill.riskLevel, now, now);
      }
    }
  }

  private async generateInvitationCodesForExistingUsers(): Promise<void> {
    const { randomUUID } = await import('crypto');
    const usersWithoutCode = await this.adapter.prepare(
      'SELECT id FROM users WHERE invitation_code IS NULL OR invitation_code = ""',
    ).all() as Array<{ id: string }>;

    for (const user of usersWithoutCode) {
      let code = randomUUID().slice(0, 6).toUpperCase();
      let attempts = 0;
      let isUnique = false;

      while (!isUnique && attempts < 10) {
        code = Math.random().toString().slice(2, 8).padStart(6, '0');
        const existing = await this.adapter.prepare(
          'SELECT id FROM users WHERE invitation_code = ?',
        ).get(code) as { id: string } | undefined;
        isUnique = !existing;
        attempts++;
      }

      if (!isUnique) {
        code = randomUUID().slice(0, 6).toUpperCase();
      }

      await this.adapter.prepare(
        'UPDATE users SET invitation_code = ? WHERE id = ?',
      ).run(code, user.id);
    }
  }


  private async seedProviderConfigs(): Promise<void> {
    if (await this.adapter.prepare('SELECT name FROM bootstrap_seed_state WHERE name=?').get('provider_configs')) return;
    // Only seed if table is empty — don't override user edits
    const { count } = (await this.adapter
      .prepare('SELECT COUNT(*) as count FROM provider_configs')
      .get()) as { count: number };
    if (count > 0) {
      await this.adapter.prepare('INSERT INTO bootstrap_seed_state (name) VALUES (?)').run('provider_configs');
      return;
    }

    const now = dbNow();
    const randomUUID = (await import('crypto')).randomUUID;

    const defaults: Array<{
      id: string;
      providerName: string;
      displayName: string;
      baseUrl: string;
      models: string;
      modelPrefix: string | null;
      timeoutMs: number;
      retryCount: number;
    }> = [
      {
        id: randomUUID(),
        providerName: 'qwen',
        displayName: 'Qwen (通义千问)',
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'qwen-turbo,qwen-plus,qwen-max,qwen-vl-plus-latest,qwen-vl-max-latest,qwen-vl-ocr-latest,qwen2.5-vl-7b-instruct,qwen2.5-vl-72b-instruct,qwen2.5-14b-instruct,qwen2.5-7b-instruct,qwen3.7-max',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'glm',
        displayName: 'GLM (智谱)',
        baseUrl: process.env.GLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'glm-5,glm-5.1,glm-4.5-air',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'deepseek',
        displayName: 'DeepSeek',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'deepseek-r1-distill-qwen-7b,deepseek-v3.2,deepseek-r1,deepseek-v4-pro,deepseek-v4-flash',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'xiaomi-mimo',
        displayName: 'Xiaomi (MiMo)',
        baseUrl: process.env.XIAOMI_BASE_URL || 'https://api.xiaomi.example/v1',
        models: (process.env.XIAOMI_MODELS || 'mimo-latest'),
        modelPrefix: 'mimo',
        timeoutMs: Number(process.env.XIAOMI_TIMEOUT_MS || 25000),
        retryCount: Number(process.env.XIAOMI_RETRY_COUNT || 2),
      },
      {
        id: randomUUID(),
        providerName: 'minimax',
        displayName: 'MiniMax',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'MiniMax-M2.5',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'kimi',
        displayName: 'Kimi (月之暗面)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'kimi-k2.6',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'gui',
        displayName: 'GUI (硅基流动)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: 'gui-plus',
        modelPrefix: null,
        timeoutMs: 25000,
        retryCount: 2,
      },
      {
        id: randomUUID(),
        providerName: 'gemini',
        displayName: 'Gemini (Google)',
        baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
        models: 'gemini-3.5-flash',
        modelPrefix: null,
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 30000),
        retryCount: Number(process.env.GEMINI_RETRY_COUNT || 2),
      },
    ];

    const stmt = this.adapter.prepare(
      `INSERT INTO provider_configs (id, provider_name, display_name, base_url, models, model_prefix, auth_header, auth_prefix, timeout_ms, retry_count, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Authorization', 'Bearer', ?, ?, 1, ?, ?)`,
    );

    for (const d of defaults) {
      await stmt.run(
        d.id, d.providerName, d.displayName, d.baseUrl, d.models,
        d.modelPrefix, d.timeoutMs, d.retryCount, now, now,
      );
    }
    console.log(`[Database] Seeded ${defaults.length} default provider configs.`);
    await this.adapter.prepare('INSERT INTO bootstrap_seed_state (name) VALUES (?)').run('provider_configs');
  }





  private async seedRouterRules(): Promise<void> {
    if (await this.adapter.prepare('SELECT name FROM bootstrap_seed_state WHERE name=?').get('router_rules')) return;
    const { count } = (await this.adapter
      .prepare('SELECT COUNT(*) as count FROM router_rules')
      .get()) as { count: number };
    if (count > 0) {
      await this.adapter.prepare('INSERT INTO bootstrap_seed_state (name) VALUES (?)').run('router_rules');
      return;
    }

    const rules: Record<string, string[]> = {
      coding: ['deepseek-v4-pro', 'deepseek-v4-flash', 'qwen-plus'],
      translation: ['qwen-max', 'qwen-plus', 'glm-5'],
      creative: ['qwen-max', 'kimi-k2.6', 'MiniMax-M2.5'],
      reasoning: ['deepseek-r1', 'qwen3.7-max', 'glm-5.1'],
      vision: ['gemini-3.5-flash', 'qwen-vl-max-latest', 'qwen-vl-plus-latest'],
      summary: ['qwen-plus', 'glm-4.5-air', 'deepseek-v4-flash'],
      data: ['deepseek-v4-pro', 'qwen3.7-max', 'glm-5'],
      general: ['qwen-plus', 'deepseek-v4-flash', 'glm-4.5-air'],
    };

    const stmt = this.adapter.prepare(
      'INSERT INTO router_rules (intent, models, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP(3))',
    );
    for (const [intent, models] of Object.entries(rules)) {
      await stmt.run(intent, JSON.stringify(models));
    }
    await this.adapter.prepare('INSERT INTO bootstrap_seed_state (name) VALUES (?)').run('router_rules');
  }





}
