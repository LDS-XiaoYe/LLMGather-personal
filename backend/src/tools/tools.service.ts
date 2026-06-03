import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Script, createContext } from 'vm';
import { DatabaseService } from '../database/database.service';
import { McpService } from '../mcp/mcp.service';

export interface ToolDefinition {
  id: string;
  userId: string | null;
  name: string;
  displayName: string;
  description: string;
  schema: Record<string, unknown>;
  implementationType: string;
  enabled: boolean;
  permissionLevel?: 'auto' | 'confirm' | 'disabled';
}

export interface ToolInvocationResult {
  id: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  status: 'succeeded' | 'failed';
  error: string;
  latencyMs: number;
}

type ToolRow = {
  id: string;
  userId: string | null;
  name: string;
  displayName: string;
  description: string;
  schemaJson: string;
  implementationType: string;
  enabled: number | string;
  permissionLevel?: string;
};

@Injectable()
export class ToolsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mcpService: McpService,
  ) {}

  async listForUser(userId: string): Promise<ToolDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, display_name as displayName, description,
              schema_json as schemaJson, implementation_type as implementationType, enabled
       FROM tools
       WHERE enabled = 1 AND (user_id IS NULL OR user_id = ?)
       ORDER BY user_id IS NULL DESC, display_name ASC`,
    ).all(userId) as unknown as ToolRow[];
    return rows.map((row) => this.mapTool(row));
  }

  async getById(userId: string, toolId: string): Promise<ToolDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, display_name as displayName, description,
              schema_json as schemaJson, implementation_type as implementationType, enabled
       FROM tools
       WHERE id = ? AND enabled = 1 AND (user_id IS NULL OR user_id = ?)
       LIMIT 1`,
    ).get(toolId, userId) as unknown as ToolRow | undefined;
    if (!row) throw new NotFoundException('工具不存在或不可用');
    return this.mapTool(row);
  }

  async getAgentTools(userId: string, agentId: string): Promise<ToolDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT t.id, t.user_id as userId, t.name, t.display_name as displayName, t.description,
              t.schema_json as schemaJson, t.implementation_type as implementationType, t.enabled,
              at.permission_level as permissionLevel
       FROM agent_tools at
       JOIN tools t ON t.id = at.tool_id
       WHERE at.user_id = ? AND at.agent_id = ? AND t.enabled = 1
       ORDER BY t.display_name ASC`,
    ).all(userId, agentId) as unknown as ToolRow[];
    return rows.map((row) => this.mapTool(row));
  }

  async setAgentTools(
    userId: string,
    agentId: string,
    toolIds: string[],
    permissions: Record<string, string> = {},
  ): Promise<void> {
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_tools WHERE user_id = ? AND agent_id = ?',
    ).run(userId, agentId);

    const uniqueIds = Array.from(new Set(toolIds.filter(Boolean)));
    for (const toolId of uniqueIds) {
      await this.getById(userId, toolId);
      const level = ['auto', 'confirm', 'disabled'].includes(permissions[toolId]) ? permissions[toolId] : 'auto';
      await this.databaseService.connection.prepare(
        'INSERT INTO agent_tools (agent_id, tool_id, user_id, permission_level, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(agentId, toolId, userId, level, this.databaseService.now());
    }
  }

  async invoke(
    userId: string,
    toolIdOrName: string,
    args: Record<string, unknown>,
    context?: { agentId?: string; runId?: string },
  ): Promise<ToolInvocationResult> {
    const tool = await this.resolveTool(userId, toolIdOrName);
    const startedAt = Date.now();
    const invocationId = randomUUID();
    let output = '';
    let error = '';
    let status: 'succeeded' | 'failed' = 'succeeded';

    try {
      output = await this.runBuiltin(userId, tool.name, args);
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - startedAt;
    await this.databaseService.connection.prepare(
      `INSERT INTO tool_invocations
        (id, tool_id, agent_id, run_id, user_id, tool_name, input, output, status, error, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      invocationId,
      tool.id,
      context?.agentId ?? '',
      context?.runId ?? '',
      userId,
      tool.name,
      JSON.stringify(args),
      output,
      status,
      error,
      latencyMs,
      this.databaseService.now(),
    );

    return {
      id: invocationId,
      toolId: tool.id,
      toolName: tool.name,
      input: args,
      output,
      status,
      error,
      latencyMs,
    };
  }

  async autoInvokeForInput(
    userId: string,
    agentId: string,
    runId: string,
    input: string,
  ): Promise<ToolInvocationResult[]> {
    const tools = await this.getAgentTools(userId, agentId);
    const results: ToolInvocationResult[] = [];
    const lower = input.toLowerCase();

    for (const tool of tools) {
      if (tool.permissionLevel === 'disabled') continue;
      if (tool.name === 'current_time' && /时间|日期|今天|现在|current\s*time|date/i.test(input)) {
        results.push(await this.invoke(userId, tool.id, { timezone: 'Asia/Shanghai' }, { agentId, runId }));
      }

      if (tool.name === 'uuid' && /uuid|唯一id|唯一标识/i.test(input)) {
        results.push(await this.invoke(userId, tool.id, {}, { agentId, runId }));
      }

      if (tool.name === 'text_stats' && /字数|字符|词数|统计|text\s*stats/i.test(input)) {
        results.push(await this.invoke(userId, tool.id, { text: input }, { agentId, runId }));
      }

      if (tool.name === 'calculator' && (/计算|算一下|calculate/.test(input) || lower.includes('math'))) {
        const expression = this.extractExpression(input);
        if (expression) {
          results.push(await this.invoke(userId, tool.id, { expression }, { agentId, runId }));
        }
      }

      if (tool.name === 'javascript_runner' && /代码|执行.*js|javascript|run\s*code|code\s*run/i.test(input)) {
        const code = this.extractCodeBlock(input) || this.extractInlineCodeRequest(input);
        if (code) {
          results.push(await this.invoke(userId, tool.id, { code }, { agentId, runId }));
        }
      }
    }

    return results;
  }

  private async resolveTool(userId: string, toolIdOrName: string): Promise<ToolDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, display_name as displayName, description,
              schema_json as schemaJson, implementation_type as implementationType, enabled
       FROM tools
       WHERE enabled = 1 AND (id = ? OR name = ?) AND (user_id IS NULL OR user_id = ?)
       ORDER BY user_id IS NULL DESC
       LIMIT 1`,
    ).get(toolIdOrName, toolIdOrName, userId) as unknown as ToolRow | undefined;
    if (!row) throw new NotFoundException('工具不存在或不可用');
    return this.mapTool(row);
  }

  private async runBuiltin(userId: string, name: string, args: Record<string, unknown>): Promise<string> {
    if (name === 'current_time') {
      const timezone = typeof args.timezone === 'string' ? args.timezone : 'Asia/Shanghai';
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(new Date());
    }

    if (name === 'uuid') {
      return randomUUID();
    }

    if (name === 'text_stats') {
      const text = typeof args.text === 'string' ? args.text : '';
      const cjk = [...text].filter((ch) => /[\u3400-\u9fff]/.test(ch)).length;
      const words = (text.match(/[A-Za-z0-9_]+/g) ?? []).length;
      const lines = text ? text.split(/\r?\n/).length : 0;
      return JSON.stringify({ chars: [...text].length, cjkChars: cjk, englishWords: words, lines }, null, 2);
    }

    if (name === 'calculator') {
      const expression = typeof args.expression === 'string' ? args.expression.trim() : '';
      if (!expression || expression.length > 200) {
        throw new BadRequestException('计算表达式为空或过长');
      }
      if (!/^[0-9+\-*/%.^()\s]+$/.test(expression)) {
        throw new BadRequestException('表达式包含不支持的字符');
      }
      const normalized = expression.replace(/\^/g, '**');
      const value = Function(`"use strict"; return (${normalized});`)() as unknown;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException('计算结果无效');
      }
      return String(value);
    }

    if (name === 'javascript_runner') {
      return this.runJavascript(args);
    }

    if (name === 'container_javascript_runner') {
      return this.runContainerJavascript(args);
    }

    if (name === 'python_runner' || name === 'container_python_runner') {
      return this.runContainerPython(args);
    }

    if (name === 'notion_search') {
      const server = await this.mcpService.getFirstEnabledNotion(userId);
      if (!server) throw new BadRequestException('请先配置并启用 Notion MCP Server');
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) throw new BadRequestException('Notion 搜索 query 不能为空');
      const limit = typeof args.limit === 'number' ? args.limit : 5;
      const results = await this.mcpService.searchNotion(server, query, limit);
      return JSON.stringify(results, null, 2);
    }

    if (name === 'browser_fetch') {
      return this.fetchWebPage(args);
    }

    throw new BadRequestException(`暂不支持的内置工具: ${name}`);
  }

  private runJavascript(args: Record<string, unknown>): string {
    const code = typeof args.code === 'string' ? args.code.trim() : '';
    if (!code || code.length > 4000) {
      throw new BadRequestException('代码为空或超过 4000 字符');
    }

    const logs: string[] = [];
    const sandbox = createContext({
      input: args.input ?? {},
      Math,
      JSON,
      Number,
      String,
      Boolean,
      Array,
      Object,
      Date,
      RegExp,
      console: {
        log: (...items: unknown[]) => logs.push(items.map((item) => this.stringifyValue(item)).join(' ')),
      },
    });
    const wrapped = `"use strict";\n${code}`;
    const script = new Script(wrapped);
    const result = script.runInContext(sandbox, { timeout: 1000 });
    return JSON.stringify({ result, logs }, null, 2);
  }

  private async runContainerCode(args: Record<string, unknown>, language: string = 'javascript'): Promise<string> {
    const code = typeof args.code === 'string' ? args.code.trim() : '';
    if (!code || code.length > 10000) {
      throw new BadRequestException('代码为空或超过 10000 字符');
    }
    const endpoint = process.env.CODE_RUNNER_URL || 'http://code-runner:8787/run';
    const timeout = language === 'python' ? 10000 : 5000;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code, 
        input: args.input ?? {},
        language 
      }),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new BadRequestException(`容器代码执行失败: ${text.slice(0, 500)}`);
    }
    return text;
  }

  private async runContainerJavascript(args: Record<string, unknown>): Promise<string> {
    return this.runContainerCode(args, 'javascript');
  }

  private async runContainerPython(args: Record<string, unknown>): Promise<string> {
    return this.runContainerCode(args, 'python');
  }

  private async fetchWebPage(args: Record<string, unknown>): Promise<string> {
    const url = typeof args.url === 'string' ? args.url.trim() : '';
    if (!/^https?:\/\//i.test(url)) throw new BadRequestException('URL 必须以 http:// 或 https:// 开头');
    const maxChars = typeof args.maxChars === 'number' ? Math.max(500, Math.min(12000, args.maxChars)) : 6000;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LLMGather-AgentBrowser/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await response.text();
    if (!response.ok) throw new BadRequestException(`网页读取失败: ${response.status}`);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? url;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
    return JSON.stringify({ url, title, text }, null, 2);
  }

  private extractExpression(input: string): string {
    const matches = input.match(/[0-9][0-9+\-*/%.^()\s]{2,}[0-9)]/g);
    return matches?.[0]?.trim() ?? '';
  }

  private extractCodeBlock(input: string): string {
    const match = input.match(/```(?:javascript|js|ts|code)?\s*([\s\S]*?)```/i);
    return match?.[1]?.trim() ?? '';
  }

  private extractInlineCodeRequest(input: string): string {
    const marker = input.match(/(?:执行|运行|run)\s*(?:这段|以下)?\s*(?:javascript|js|代码|code)[:：]\s*([\s\S]+)/i);
    return marker?.[1]?.trim() ?? '';
  }

  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private mapTool(row: ToolRow): ToolDefinition {
    let schema: Record<string, unknown> = {};
    try {
      schema = JSON.parse(row.schemaJson || '{}') as Record<string, unknown>;
    } catch {}
    return {
      id: row.id,
      userId: row.userId || null,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      schema,
      implementationType: row.implementationType,
      enabled: Number(row.enabled) === 1,
      permissionLevel: ['auto', 'confirm', 'disabled'].includes(row.permissionLevel || '') ? row.permissionLevel as ToolDefinition['permissionLevel'] : 'auto',
    };
  }
}
