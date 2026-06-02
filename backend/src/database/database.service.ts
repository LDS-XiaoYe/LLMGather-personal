import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IDatabaseAdapter } from './database.adapter.interface';
import { MysqlDatabaseAdapter } from './adapters/mysql.adapter';

/**
 * 返回当前时间戳字符串（MySQL DATETIME(3) 兼容）
 */
export function dbNow(): string {
  const d = new Date();
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

  constructor() {}

  async onModuleInit(): Promise<void> {
    console.log('[Database] Initializing: type = mysql');
    await this.initMysql();
    await this.createTables();
    await this.migrateColumnsIfNeeded();
    await this.seedBuiltinTools();
    await this.seedDefaultAgentSkills();
    await this.seedProviderConfigs();
    await this.seedSystemSettings();
    await this.seedRouterRules();
    console.log('[Database] Tables & seed data ready.');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
    }
  }

  get connection(): IDatabaseAdapter {
    return this.adapter;
  }

  /** 返回当前时间戳字符串（MySQL DATETIME(3) 兼容） */
  now(): string {
    return dbNow();
  }

  /* ------------------------------------------------------------------ */
  /*  MySQL 初始化                                                       */
  /* ------------------------------------------------------------------ */
  private async initMysql(): Promise<void> {
    console.log(`[Database] MySQL connecting to ${process.env.MYSQL_HOST || '127.0.0.1'}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'llmgather'}`);
    const adapter = new MysqlDatabaseAdapter({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'llmgather',
    });
    await adapter.init();
    this.adapter = adapter;
  }

  /* ------------------------------------------------------------------ */
  /*  建表（双引擎兼容）                                                  */
  /* ------------------------------------------------------------------ */
  private async createTables(): Promise<void> {
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
        invitation_code VARCHAR(6) UNIQUE,
        invited_by VARCHAR(36),
        role VARCHAR(16) NOT NULL DEFAULT 'user',
        password_hash ${txt}, salt ${txt},
        credits ${real}, total_spent ${real},
        created_at ${ts}
      )${fk};`);

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
        cost DECIMAL(14,6) NOT NULL, created_at ${ts}
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
        query_hash VARCHAR(64) NOT NULL,
        query_text TEXT NOT NULL,
        model VARCHAR(128) NOT NULL,
        response TEXT NOT NULL,
        tokens_saved ${int} DEFAULT 0,
        cost_saved DECIMAL(14,6) NOT NULL DEFAULT 0,
        hit_count ${int} DEFAULT 1,
        created_at ${ts},
        last_hit_at ${ts},
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
        INDEX idx_agent_runs_user_created (user_id, created_at),
        INDEX idx_agent_runs_status (status)
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
        schema_json TEXT NOT NULL,
        implementation_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
        enabled INT NOT NULL DEFAULT 1,
        created_at ${ts},
        updated_at ${ts},
        UNIQUE KEY uniq_tools_user_name (user_id, name),
        INDEX idx_tools_enabled (enabled)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS agent_tools (
        agent_id VARCHAR(36) NOT NULL,
        tool_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at ${ts},
        PRIMARY KEY (agent_id, tool_id),
        INDEX idx_agent_tools_user (user_id)
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
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_kb_user (user_id)
      )${fk};`);

    await this.adapter.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id ${pk},
        kb_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(191) NOT NULL,
        content LONGTEXT NOT NULL,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_kb_docs_kb (kb_id),
        INDEX idx_kb_docs_user (user_id)
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
        snapshot_json TEXT NOT NULL,
        created_at ${ts},
        UNIQUE KEY uniq_agent_versions_number (agent_id, version_number),
        INDEX idx_agent_versions_agent (agent_id),
        INDEX idx_agent_versions_user (user_id)
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
      CREATE TABLE IF NOT EXISTS memories (
        id ${pk},
        user_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) DEFAULT NULL,
        namespace VARCHAR(64) NOT NULL DEFAULT 'default',
        memory_type VARCHAR(32) NOT NULL DEFAULT 'fact',
        content TEXT NOT NULL,
        importance INT NOT NULL DEFAULT 3,
        metadata TEXT,
        created_at ${ts},
        updated_at ${ts},
        deleted_at DATETIME(3) DEFAULT NULL,
        INDEX idx_memories_user_agent (user_id, agent_id),
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

    // 统一字符集为 utf8mb4，避免 collation 不兼容错误
    const tables = ['users', 'conversations', 'conversation_messages', 'billing_ledger', 'api_keys', 'provider_api_keys', 'provider_configs', 'agents', 'agent_runs', 'agent_run_steps', 'agent_evaluations', 'agent_skills', 'agent_skill_bindings', 'agent_teams', 'agent_team_runs', 'agent_versions', 'agent_test_suites', 'agent_test_cases', 'agent_test_runs', 'mcp_servers', 'tools', 'agent_tools', 'tool_invocations', 'knowledge_bases', 'knowledge_documents', 'knowledge_chunks', 'agent_knowledge_bases', 'memories', 'workflows', 'workflow_runs', 'workflow_run_steps'];
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
  }

  private async seedBuiltinTools(): Promise<void> {
    const now = dbNow();
    const randomUUID = (await import('crypto')).randomUUID;
    const tools: Array<{
      name: string;
      displayName: string;
      description: string;
      schema: Record<string, unknown>;
    }> = [
      {
        name: 'current_time',
        displayName: '当前时间',
        description: '返回当前服务器时间，可用于日期、时间、时区相关任务。',
        schema: { type: 'object', properties: { timezone: { type: 'string', default: 'Asia/Shanghai' } } },
      },
      {
        name: 'calculator',
        displayName: '安全计算器',
        description: '执行简单数学表达式计算，仅支持数字和 + - * / % ^ ( ) . 运算符。',
        schema: { type: 'object', required: ['expression'], properties: { expression: { type: 'string' } } },
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
      },
      {
        name: 'text_stats',
        displayName: '文本统计',
        description: '统计文本的字符数、中文字符数、英文词数和行数。',
        schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
      },
      {
        name: 'uuid',
        displayName: 'UUID 生成器',
        description: '生成一个随机 UUID。',
        schema: { type: 'object', properties: {} },
      },
    ];

    for (const tool of tools) {
      const existing = await this.adapter.prepare(
        'SELECT id FROM tools WHERE user_id IS NULL AND name = ? LIMIT 1',
      ).get(tool.name) as { id: string } | undefined;

      if (existing) {
        await this.adapter.prepare(
          `UPDATE tools
           SET display_name = ?, description = ?, schema_json = ?, enabled = 1, updated_at = ?
           WHERE id = ?`,
        ).run(tool.displayName, tool.description, JSON.stringify(tool.schema), now, existing.id);
      } else {
        await this.adapter.prepare(
          `INSERT INTO tools (id, user_id, name, display_name, description, schema_json, implementation_type, enabled, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, 'builtin', 1, ?, ?)`,
        ).run(randomUUID(), tool.name, tool.displayName, tool.description, JSON.stringify(tool.schema), now, now);
      }
    }
  }

  private async seedDefaultAgentSkills(): Promise<void> {
    const now = dbNow();
    const randomUUID = (await import('crypto')).randomUUID;
    const skills: Array<{ name: string; description: string; content: string; category: string }> = [
      {
        name: 'Research Planner',
        description: '将开放式研究问题拆解为检索、证据评估、结论综合和不确定性标注。',
        category: 'research',
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
           SET description = ?, content = ?, category = ?, enabled = 1, updated_at = ?
           WHERE id = ?`,
        ).run(skill.description, skill.content, skill.category, now, existing.id);
      } else {
        await this.adapter.prepare(
          `INSERT INTO agent_skills (id, user_id, name, description, content, category, enabled, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(randomUUID(), skill.name, skill.description, skill.content, skill.category, now, now);
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
    // Only seed if table is empty — don't override user edits
    const { count } = (await this.adapter
      .prepare('SELECT COUNT(*) as count FROM provider_configs')
      .get()) as { count: number };
    if (count > 0) return;

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
        models: 'qwen-turbo,qwen-plus,qwen-max,qwen-vl-plus-latest,qwen-vl-max-latest,qwen-vl-ocr-latest,qwen2.5-vl-7b-instruct,qwen2.5-vl-72b-instruct,qwen2.5-14b-instruct,qwen2.5-7b-instruct,qwen3.6-plus',
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
  }

  private async seedSystemSettings(): Promise<void> {
    const modelTags: Record<string, string[]> = {
      'qwen-turbo': ['language'],
      'qwen-plus': ['language'],
      'qwen-max': ['language'],
      'qwen-vl-plus-latest': ['language', 'vision'],
      'qwen-vl-max-latest': ['language', 'vision'],
      'qwen-vl-ocr-latest': ['language', 'vision'],
      'qwen2.5-vl-7b-instruct': ['language', 'vision'],
      'qwen2.5-vl-72b-instruct': ['language', 'vision'],
      'qwen2.5-14b-instruct': ['language'],
      'qwen2.5-7b-instruct': ['language'],
      'qwen3.6-plus': ['language', 'vision'],
      'glm-5': ['language'],
      'glm-5.1': ['language'],
      'glm-4.5-air': ['language'],
      'deepseek-r1-distill-qwen-7b': ['language'],
      'deepseek-v3.2': ['language'],
      'deepseek-r1': ['language'],
      'deepseek-v4-pro': ['language'],
      'deepseek-v4-flash': ['language'],
      'MiniMax-M2.5': ['language'],
      'kimi-k2.6': ['language', 'vision'],
      'gui-plus': ['language', 'vision'],
      'mimo-latest': ['language'],
      'mimo-v2.5-tts': ['audio'],
      'mimo-v2.5-tts-voicedesign': ['audio'],
      'mimo-v2.5-tts-voiceclone': ['audio'],
    };

    const settings: Array<[string, string, string]> = [
      ['page_models_chat', '*', '聊天页面可用模型（* 表示全部，或逗号分隔模型 ID）'],
      ['page_models_battle', '*', 'Battle 页面可用模型'],
      ['page_models_group', '*', '群组讨论参与模型（* 表示全部，或逗号分隔模型 ID）'],
      ['page_models_vision', 'qwen-vl-plus-latest,qwen-vl-max-latest,qwen-vl-ocr-latest,qwen2.5-vl-7b-instruct,qwen2.5-vl-72b-instruct,qwen3.6-plus,kimi-k2.6,gui-plus', '视觉理解页面可用模型'],
      ['page_models_tts', 'mimo-v2.5-tts,mimo-v2.5-tts-voicedesign,mimo-v2.5-tts-voiceclone', '语音生成页面可用模型'],
      ['model_tags', JSON.stringify(modelTags), '模型能力标签（JSON）：language=语言, vision=视觉, audio=音频'],
      // Runtime configuration keys (can be edited via管理后台)
      ['api_key_cooldown_ms', '30000', 'Provider API key 冷却时间（毫秒）'],
      ['default_temperature', '0.7', '全局默认 temperature（0-2）'],
      ['frontend_request_timeout_ms', '30000', '前端请求超时时间（毫秒）'],
      ['max_image_upload_size_bytes', '5242880', '最大图片上传大小（字节）'],
      ['max_json_body_size', '2097152', 'JSON 请求体大小上限（字节），默认为 2MB'],
      ['model_tier_mapping', JSON.stringify({
        tier_budget: ['qwen-turbo','qwen2.5-7b-instruct','deepseek-r1-distill-qwen-7b','mimo-latest'],
        tier_mainstream: ['qwen-plus','qwen2.5-14b-instruct','deepseek-v3.2','deepseek-v4-flash','glm-4.5-air','MiniMax-M2.5','gui-plus'],
        tier_flagship: ['qwen-max','qwen3.6-plus','glm-5','glm-5.1','deepseek-r1','deepseek-v4-pro','kimi-k2.6'],
        tier_super_flagship: [] as string[],
        tier_ultra: [] as string[],
        tier_vision: ['qwen-vl-plus-latest','qwen-vl-max-latest','qwen-vl-ocr-latest','qwen2.5-vl-7b-instruct','qwen2.5-vl-72b-instruct'],
        tier_audio: ['mimo-v2.5-tts','mimo-v2.5-tts-voicedesign','mimo-v2.5-tts-voiceclone']
      }), '模型到计费档位的映射（JSON）'],
      ['rate_limit_login', '10', '登录接口单位 ttl 的最大请求数（默认 10）'],
      ['rate_limit_register', '5', '注册接口单位 ttl 的最大请求数（默认 5）'],
      ['rate_limit_relay', '60', 'Relay 接口单位 ttl 的最大请求数（默认 60）'],
      ['tts_default_format', 'wav', 'TTS 默认音频格式'],
      ['tts_default_voice', '冰糖', 'TTS 默认发音人'],
      ['invitation_credits', '10', '邀请注册奖励额度（元）'],
      ['tier_prices', JSON.stringify({
        tier_budget: { prompt: 0.001, completion: 0.002 },
        tier_mainstream: { prompt: 0.002, completion: 0.008 },
        tier_flagship: { prompt: 0.004, completion: 0.012 },
        tier_super_flagship: { prompt: 0.010, completion: 0.030 },
        tier_ultra: { prompt: 0.055, completion: 0.219 },
        tier_vision: { prompt: 0.005, completion: 0.015 },
        tier_audio: { prompt: 0.002, completion: 0.006 },
      }), '各档位价格（元/千token，JSON）'],
      ['default_prices', JSON.stringify({ prompt: 0.002, completion: 0.006 }), '默认价格（未分配档位的模型使用，JSON）'],
    ];

    const stmt = this.adapter.prepare(
      'INSERT IGNORE INTO system_settings (`key`, value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP(3))',
    );
    for (const [key, value, desc] of settings) {
      await stmt.run(key, value, desc);
    }
  }

  private async seedRouterRules(): Promise<void> {
    const { count } = (await this.adapter
      .prepare('SELECT COUNT(*) as count FROM router_rules')
      .get()) as { count: number };
    if (count > 0) return;

    const rules: Record<string, string[]> = {
      coding: ['deepseek-v4-pro', 'deepseek-v4-flash', 'qwen-plus'],
      translation: ['qwen-max', 'qwen-plus', 'glm-5'],
      creative: ['qwen-max', 'kimi-k2.6', 'MiniMax-M2.5'],
      reasoning: ['deepseek-r1', 'qwen3.6-plus', 'glm-5.1'],
      vision: ['qwen-vl-max-latest', 'qwen-vl-plus-latest'],
      summary: ['qwen-plus', 'glm-4.5-air', 'deepseek-v4-flash'],
      data: ['deepseek-v4-pro', 'qwen3.6-plus', 'glm-5'],
      general: ['qwen-plus', 'deepseek-v4-flash', 'glm-4.5-air'],
    };

    const stmt = this.adapter.prepare(
      'INSERT INTO router_rules (intent, models, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP(3))',
    );
    for (const [intent, models] of Object.entries(rules)) {
      await stmt.run(intent, JSON.stringify(models));
    }
  }
}
