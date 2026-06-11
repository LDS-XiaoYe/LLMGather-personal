import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Script, createContext } from 'vm';
import { DatabaseService } from '../database/database.service';
import { McpService } from '../mcp/mcp.service';
import { CreateToolDto, UpdateToolDto } from './dto/tools.dto';

export interface ToolDefinition {
  id: string;
  userId: string | null;
  name: string;
  displayName: string;
  description: string;
  schema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  implementationType: string;
  source: 'builtin' | 'custom';
  category: string;
  runtime: string;
  riskLevel: 'low' | 'medium' | 'high';
  code?: string;
  timeoutMs: number;
  retries: number;
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
  category?: string;
  schemaJson: string;
  outputSchemaJson?: string;
  permissionsJson?: string;
  implementationType: string;
  runtime?: string;
  riskLevel?: string;
  code?: string;
  timeoutMs?: number | string;
  retries?: number | string;
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
              category, schema_json as schemaJson, output_schema_json as outputSchemaJson,
              permissions_json as permissionsJson, implementation_type as implementationType,
              runtime, risk_level as riskLevel, code, timeout_ms as timeoutMs, retries, enabled
       FROM tools
       WHERE enabled = 1 AND deleted_at IS NULL AND (user_id IS NULL OR user_id = ?)
       ORDER BY user_id IS NULL DESC, display_name ASC`,
    ).all(userId) as unknown as ToolRow[];
    return rows.map((row) => this.mapTool(row));
  }

  async getById(userId: string, toolId: string): Promise<ToolDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, display_name as displayName, description,
              category, schema_json as schemaJson, output_schema_json as outputSchemaJson,
              permissions_json as permissionsJson, implementation_type as implementationType,
              runtime, risk_level as riskLevel, code, timeout_ms as timeoutMs, retries, enabled
       FROM tools
       WHERE id = ? AND enabled = 1 AND deleted_at IS NULL AND (user_id IS NULL OR user_id = ?)
       LIMIT 1`,
    ).get(toolId, userId) as unknown as ToolRow | undefined;
    if (!row) throw new NotFoundException('工具不存在或不可用');
    return this.mapTool(row);
  }

  async getAgentTools(userId: string, agentId: string): Promise<ToolDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT t.id, t.user_id as userId, t.name, t.display_name as displayName, t.description,
              t.category, t.schema_json as schemaJson, t.output_schema_json as outputSchemaJson,
              t.permissions_json as permissionsJson, t.implementation_type as implementationType,
              t.runtime, t.risk_level as riskLevel, t.code, t.timeout_ms as timeoutMs, t.retries, t.enabled,
              at.permission_level as permissionLevel
       FROM agent_tools at
       JOIN tools t ON t.id = at.tool_id
       WHERE at.user_id = ? AND at.agent_id = ? AND t.enabled = 1 AND t.deleted_at IS NULL
       ORDER BY t.display_name ASC`,
    ).all(userId, agentId) as unknown as ToolRow[];
    return rows.map((row) => this.mapTool(row));
  }

  async create(userId: string, dto: CreateToolDto): Promise<ToolDefinition> {
    const name = this.normalizeToolName(dto.name);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO tools
        (id, user_id, name, display_name, description, category, schema_json, output_schema_json,
         permissions_json, implementation_type, runtime, risk_level, code, timeout_ms, retries, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom_code', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      name,
      dto.displayName.trim(),
      dto.description?.trim() ?? '',
      dto.category?.trim() || 'custom',
      JSON.stringify(dto.inputSchema ?? { type: 'object', properties: {} }),
      JSON.stringify(dto.outputSchema ?? { type: 'object', properties: {} }),
      JSON.stringify(dto.permissions ?? {}),
      dto.runtime ?? 'python',
      dto.riskLevel ?? 'low',
      dto.code,
      Math.max(1000, Math.min(300000, (dto.timeout ?? 30) * 1000)),
      dto.retries ?? 0,
      dto.enabled === false ? 0 : 1,
      now,
      now,
    );
    return this.getById(userId, id);
  }

  async update(userId: string, toolId: string, dto: UpdateToolDto): Promise<ToolDefinition> {
    const current = await this.getOwnedCustomTool(userId, toolId);
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE tools
       SET name = ?, display_name = ?, description = ?, category = ?, schema_json = ?, output_schema_json = ?,
           permissions_json = ?, runtime = ?, risk_level = ?, code = ?, timeout_ms = ?, retries = ?,
           enabled = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(
      dto.name ? this.normalizeToolName(dto.name) : current.name,
      dto.displayName?.trim() || current.displayName,
      dto.description?.trim() ?? current.description,
      dto.category?.trim() || current.category,
      JSON.stringify(dto.inputSchema ?? current.schema),
      JSON.stringify(dto.outputSchema ?? current.outputSchema ?? { type: 'object', properties: {} }),
      JSON.stringify(dto.permissions ?? current.permissions ?? {}),
      dto.runtime ?? current.runtime,
      dto.riskLevel ?? current.riskLevel,
      dto.code ?? current.code ?? '',
      dto.timeout ? Math.max(1000, Math.min(300000, dto.timeout * 1000)) : current.timeoutMs,
      dto.retries ?? current.retries,
      dto.enabled === false ? 0 : 1,
      now,
      toolId,
      userId,
    );
    return this.getById(userId, toolId);
  }

  async remove(userId: string, toolId: string): Promise<void> {
    await this.getOwnedCustomTool(userId, toolId);
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE tools SET enabled = 0, deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run(now, now, toolId, userId);
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_tools WHERE tool_id = ? AND user_id = ?',
    ).run(toolId, userId);
  }

  async test(userId: string, toolId: string, args: Record<string, unknown>): Promise<ToolInvocationResult> {
    return this.invoke(userId, toolId, args, {});
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
      output = tool.implementationType === 'custom_code'
        ? await this.runCustomCode(tool, args, { userId, agentId: context?.agentId, runId: context?.runId })
        : await this.runBuiltin(userId, tool.name, args);
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
        if (process.env.ENABLE_CODE_RUNNER_TOOLS !== 'true') continue;
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
              category, schema_json as schemaJson, output_schema_json as outputSchemaJson,
              permissions_json as permissionsJson, implementation_type as implementationType,
              runtime, risk_level as riskLevel, code, timeout_ms as timeoutMs, retries, enabled
       FROM tools
       WHERE enabled = 1 AND deleted_at IS NULL AND (id = ? OR name = ?) AND (user_id IS NULL OR user_id = ?)
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
      this.assertCodeRunnerEnabled();
      return this.runJavascript(args);
    }

    if (name === 'container_javascript_runner') {
      this.assertCodeRunnerEnabled();
      return this.runContainerJavascript(args);
    }

    if (name === 'python_runner' || name === 'container_python_runner') {
      this.assertCodeRunnerEnabled();
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

    if (name === 'weather_query') {
      return this.queryWeather(args);
    }

    if (name === 'platform_agent_api') {
      return this.runPlatformAgentApi(userId, args);
    }

    throw new BadRequestException(`暂不支持的内置工具: ${name}`);
  }

  private async runPlatformAgentApi(userId: string, args: Record<string, unknown>): Promise<string> {
    const operation = typeof args.operation === 'string' ? args.operation : '';
    switch (operation) {
      case 'list_agents':
        return JSON.stringify(await this.platformListAgents(userId, this.numberArg(args.limit, 20, 1, 50)), null, 2);
      case 'get_agent':
        return JSON.stringify(await this.platformGetAgent(userId, this.stringArg(args.agentId, 'agentId')), null, 2);
      case 'create_agent':
        return JSON.stringify(await this.platformCreateAgent(userId, this.recordArg(args.agent, 'agent')), null, 2);
      case 'update_agent':
        return JSON.stringify(await this.platformUpdateAgent(userId, this.stringArg(args.agentId, 'agentId'), this.recordArg(args.agent, 'agent')), null, 2);
      case 'list_workflows':
        return JSON.stringify(await this.platformListWorkflows(userId, this.numberArg(args.limit, 20, 1, 50)), null, 2);
      case 'create_workflow':
        return JSON.stringify(await this.platformCreateWorkflow(userId, this.recordArg(args.workflow, 'workflow')), null, 2);
      case 'bind_workflow_to_agent':
        return JSON.stringify(await this.platformBindWorkflow(userId, this.stringArg(args.agentId, 'agentId'), this.stringArg(args.workflowId, 'workflowId')), null, 2);
      case 'create_skill':
        return JSON.stringify(await this.platformCreateSkill(userId, this.recordArg(args.skill, 'skill')), null, 2);
      case 'update_skill':
        return JSON.stringify(await this.platformUpdateSkill(userId, this.stringArg(args.skillId, 'skillId'), this.recordArg(args.skill, 'skill')), null, 2);
      case 'bind_skill_to_agent':
        return JSON.stringify(await this.platformBindSkill(userId, this.stringArg(args.agentId, 'agentId'), this.stringArg(args.skillId, 'skillId')), null, 2);
      case 'create_tool':
        return JSON.stringify(await this.platformCreateTool(userId, this.recordArg(args.tool, 'tool')), null, 2);
      case 'update_tool':
        return JSON.stringify(await this.platformUpdateTool(userId, this.stringArg(args.toolId, 'toolId'), this.recordArg(args.tool, 'tool')), null, 2);
      case 'bind_tool_to_agent':
        return JSON.stringify(await this.platformBindTool(userId, this.stringArg(args.agentId, 'agentId'), this.stringArg(args.toolId, 'toolId')), null, 2);
      case 'list_tools':
        return JSON.stringify((await this.listForUser(userId)).map((tool) => ({
          id: tool.id,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          source: tool.source,
          category: tool.category,
          riskLevel: tool.riskLevel,
        })).slice(0, this.numberArg(args.limit, 50, 1, 100)), null, 2);
      case 'list_skills':
        return JSON.stringify(await this.platformListSkills(userId, this.numberArg(args.limit, 50, 1, 100)), null, 2);
      case 'list_knowledge_bases':
        return JSON.stringify(await this.platformListKnowledgeBases(userId, this.numberArg(args.limit, 50, 1, 100)), null, 2);
      default:
        throw new BadRequestException('platform_agent_api operation 不支持或为空');
    }
  }

  private async queryWeather(args: Record<string, unknown>): Promise<string> {
    const forecastDays = this.numberArg(args.forecastDays, 3, 1, 7);
    const language = typeof args.language === 'string' && args.language.trim() ? args.language.trim().slice(0, 8) : 'zh';
    const locationText = typeof args.location === 'string' ? args.location.trim() : '';
    let latitude = Number(args.latitude);
    let longitude = Number(args.longitude);
    let location: Record<string, unknown> = {};

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (!locationText) throw new BadRequestException('请提供 location 或 latitude/longitude');
      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('name', locationText);
      geoUrl.searchParams.set('count', '1');
      geoUrl.searchParams.set('language', language);
      geoUrl.searchParams.set('format', 'json');
      const geo = await this.fetchJson(geoUrl);
      const first = Array.isArray((geo as { results?: unknown[] }).results) ? (geo as { results: Array<Record<string, unknown>> }).results[0] : undefined;
      if (!first) throw new BadRequestException(`未找到地点: ${locationText}`);
      latitude = Number(first.latitude);
      longitude = Number(first.longitude);
      location = {
        name: first.name,
        country: first.country,
        admin1: first.admin1,
        latitude,
        longitude,
        timezone: first.timezone,
      };
    } else {
      location = { name: locationText || `${latitude},${longitude}`, latitude, longitude };
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(latitude));
    forecastUrl.searchParams.set('longitude', String(longitude));
    forecastUrl.searchParams.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'rain',
      'showers',
      'snowfall',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','));
    forecastUrl.searchParams.set('daily', [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ].join(','));
    forecastUrl.searchParams.set('forecast_days', String(forecastDays));
    forecastUrl.searchParams.set('timezone', 'auto');
    const forecast = await this.fetchJson(forecastUrl) as Record<string, unknown>;
    const current = (forecast.current && typeof forecast.current === 'object') ? forecast.current as Record<string, unknown> : {};
    const daily = (forecast.daily && typeof forecast.daily === 'object') ? forecast.daily as Record<string, unknown[]> : {};
    const dailyForecast = Array.isArray(daily.time) ? daily.time.map((time, index) => ({
      date: time,
      weatherCode: Array.isArray(daily.weather_code) ? daily.weather_code[index] : undefined,
      condition: this.weatherCodeText(Number(Array.isArray(daily.weather_code) ? daily.weather_code[index] : NaN)),
      temperatureMax: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[index] : undefined,
      temperatureMin: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[index] : undefined,
      precipitationProbabilityMax: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[index] : undefined,
    })) : [];

    return JSON.stringify({
      provider: 'Open-Meteo',
      location,
      timezone: forecast.timezone,
      current: {
        ...current,
        condition: this.weatherCodeText(Number(current.weather_code)),
      },
      daily: dailyForecast,
      sourceUrls: {
        geocoding: locationText ? 'https://geocoding-api.open-meteo.com/v1/search' : undefined,
        forecast: 'https://api.open-meteo.com/v1/forecast',
      },
    }, null, 2);
  }

  private async fetchJson(url: URL): Promise<unknown> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LLMGather-WeatherTool/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    if (!response.ok) throw new BadRequestException(`天气接口请求失败: ${response.status} ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadRequestException('天气接口返回了无效 JSON');
    }
  }

  private weatherCodeText(code: number): string {
    const map: Record<number, string> = {
      0: '晴朗',
      1: '大部晴朗',
      2: '局部多云',
      3: '阴天',
      45: '雾',
      48: '雾凇',
      51: '小毛毛雨',
      53: '中等毛毛雨',
      55: '强毛毛雨',
      56: '冻毛毛雨',
      57: '强冻毛毛雨',
      61: '小雨',
      63: '中雨',
      65: '大雨',
      66: '冻雨',
      67: '强冻雨',
      71: '小雪',
      73: '中雪',
      75: '大雪',
      77: '雪粒',
      80: '小阵雨',
      81: '中等阵雨',
      82: '强阵雨',
      85: '小阵雪',
      86: '强阵雪',
      95: '雷暴',
      96: '雷暴伴小冰雹',
      99: '雷暴伴强冰雹',
    };
    return map[code] ?? '未知天气';
  }

  private async platformListAgents(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, name, description, model, status, created_at as createdAt, updated_at as updatedAt
       FROM agents
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT ?`,
    ).all(userId, limit) as Array<Record<string, unknown>>;
    return rows;
  }

  private async platformGetAgent(userId: string, agentId: string): Promise<Record<string, unknown>> {
    const agent = await this.databaseService.connection.prepare(
      `SELECT id, name, description, model, system_prompt as systemPrompt, temperature, max_tokens as maxTokens,
              memory_enabled as memoryEnabled, status, created_at as createdAt, updated_at as updatedAt
       FROM agents
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(agentId, userId) as Record<string, unknown> | undefined;
    if (!agent) throw new NotFoundException('Agent 不存在');
    const [toolIds, skillIds, knowledgeBaseIds, workflowIds] = await Promise.all([
      this.platformBindingIds('agent_tools', 'tool_id', userId, agentId),
      this.platformBindingIds('agent_skill_bindings', 'skill_id', userId, agentId),
      this.platformBindingIds('agent_knowledge_bases', 'kb_id', userId, agentId),
      this.platformBindingIds('agent_workflows', 'workflow_id', userId, agentId),
    ]);
    return { ...agent, toolIds, skillIds, knowledgeBaseIds, workflowIds };
  }

  private async platformCreateAgent(userId: string, agent: Record<string, unknown>): Promise<Record<string, unknown>> {
    const name = this.trimmed(agent.name, '新建 Agent').slice(0, 80);
    const model = this.trimmed(agent.model, '');
    if (!model) throw new BadRequestException('agent.model 不能为空');
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agents
        (id, user_id, name, description, model, system_prompt, temperature, max_tokens, memory_enabled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      name,
      this.trimmed(agent.description, '').slice(0, 500),
      model.slice(0, 128),
      this.trimmed(agent.systemPrompt, '').slice(0, 12000),
      this.numberArg(agent.temperature, 0.7, 0, 2),
      this.numberArg(agent.maxTokens, 1024, 1, 32000),
      agent.memoryEnabled === false ? 0 : 1,
      agent.status === 'archived' ? 'archived' : 'active',
      now,
      now,
    );
    await this.platformSetAgentBindings(userId, id, agent);
    return this.platformGetAgent(userId, id);
  }

  private async platformUpdateAgent(userId: string, agentId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const current = await this.platformGetAgent(userId, agentId);
    const next = {
      name: typeof patch.name === 'string' ? patch.name.trim().slice(0, 80) : String(current.name ?? ''),
      description: typeof patch.description === 'string' ? patch.description.trim().slice(0, 500) : String(current.description ?? ''),
      model: typeof patch.model === 'string' ? patch.model.trim().slice(0, 128) : String(current.model ?? ''),
      systemPrompt: typeof patch.systemPrompt === 'string' ? patch.systemPrompt.trim().slice(0, 12000) : String(current.systemPrompt ?? ''),
      temperature: patch.temperature === undefined ? Number(current.temperature ?? 0.7) : this.numberArg(patch.temperature, 0.7, 0, 2),
      maxTokens: patch.maxTokens === undefined ? Number(current.maxTokens ?? 1024) : this.numberArg(patch.maxTokens, 1024, 1, 32000),
      memoryEnabled: patch.memoryEnabled === undefined ? Number(current.memoryEnabled ?? 1) === 1 : patch.memoryEnabled !== false,
      status: patch.status === undefined ? String(current.status || 'active') : (patch.status === 'archived' ? 'archived' : 'active'),
    };
    if (!next.name || !next.model) throw new BadRequestException('Agent name/model 不能为空');
    await this.databaseService.connection.prepare(
      `UPDATE agents
       SET name = ?, description = ?, model = ?, system_prompt = ?, temperature = ?, max_tokens = ?, memory_enabled = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).run(next.name, next.description, next.model, next.systemPrompt, next.temperature, next.maxTokens, next.memoryEnabled ? 1 : 0, next.status, this.databaseService.now(), agentId, userId);
    await this.platformSetAgentBindings(userId, agentId, patch);
    return this.platformGetAgent(userId, agentId);
  }

  private async platformListWorkflows(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    return await this.databaseService.connection.prepare(
      `SELECT id, name, description, status, created_at as createdAt, updated_at as updatedAt
       FROM workflows
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT ?`,
    ).all(userId, limit) as Array<Record<string, unknown>>;
  }

  private async platformCreateWorkflow(userId: string, workflow: Record<string, unknown>): Promise<Record<string, unknown>> {
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.slice(0, 50) : [];
    if (nodes.length === 0) throw new BadRequestException('workflow.nodes 不能为空');
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO workflows (id, user_id, name, description, definition_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      id,
      userId,
      this.trimmed(workflow.name, 'Agent 生成 Workflow').slice(0, 128),
      this.trimmed(workflow.description, '').slice(0, 1000),
      JSON.stringify({ nodes }),
      now,
      now,
    );
    const created = await this.databaseService.connection.prepare(
      `SELECT id, name, description, definition_json as definitionJson, status, created_at as createdAt, updated_at as updatedAt
       FROM workflows WHERE id = ? AND user_id = ?`,
    ).get(id, userId) as Record<string, unknown>;
    return { ...created, nodes };
  }

  private async platformBindWorkflow(userId: string, agentId: string, workflowId: string): Promise<Record<string, unknown>> {
    await this.platformGetAgent(userId, agentId);
    const workflow = await this.databaseService.connection.prepare(
      `SELECT id FROM workflows WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND status = 'active'`,
    ).get(workflowId, userId);
    if (!workflow) throw new NotFoundException('Workflow 不存在');
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_workflows WHERE agent_id = ? AND user_id = ?',
    ).run(agentId, userId);
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_workflows (agent_id, workflow_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(agentId, workflowId, userId, this.databaseService.now());
    return { agentId, workflowId, bound: true };
  }

  private async platformCreateSkill(userId: string, skill: Record<string, unknown>): Promise<Record<string, unknown>> {
    const name = this.trimmed(skill.name, '').slice(0, 80);
    const content = this.trimmed(skill.content, '').slice(0, 12000);
    if (!name || !content) throw new BadRequestException('skill.name 和 skill.content 不能为空');
    const id = randomUUID();
    const now = this.databaseService.now();
    const riskLevel = this.riskArg(skill.riskLevel, 'low');
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_skills
        (id, user_id, name, description, content, category, icon, input_schema_json, output_schema_json,
         permissions_json, example_input, example_output, risk_level, version, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      id,
      userId,
      name,
      this.trimmed(skill.description, '').slice(0, 500),
      content,
      this.trimmed(skill.category, 'custom').slice(0, 64),
      this.trimmed(skill.icon, 'Star').slice(0, 16),
      JSON.stringify(this.objectOrDefault(skill.inputSchema, { type: 'object', properties: { input: { type: 'string' } } })),
      JSON.stringify(this.objectOrDefault(skill.outputSchema, { type: 'object', properties: { output: { type: 'string' } } })),
      JSON.stringify(this.objectOrDefault(skill.permissions, this.defaultSkillPermissions(riskLevel))),
      this.trimmed(skill.exampleInput, '').slice(0, 4000),
      this.trimmed(skill.exampleOutput, '').slice(0, 4000),
      riskLevel,
      skill.enabled === false ? 0 : 1,
      now,
      now,
    );
    return this.platformGetSkill(userId, id);
  }

  private async platformUpdateSkill(userId: string, skillId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const current = await this.platformGetSkill(userId, skillId);
    if (!current.userId) throw new ForbiddenException('平台内置 Skill 不允许直接编辑');
    const riskLevel = this.riskArg(patch.riskLevel, String(current.riskLevel || 'low'));
    await this.databaseService.connection.prepare(
      `UPDATE agent_skills
       SET name = ?, description = ?, content = ?, category = ?, icon = ?, input_schema_json = ?,
           output_schema_json = ?, permissions_json = ?, example_input = ?, example_output = ?,
           risk_level = ?, enabled = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      typeof patch.name === 'string' ? patch.name.trim().slice(0, 80) : String(current.name),
      typeof patch.description === 'string' ? patch.description.trim().slice(0, 500) : String(current.description ?? ''),
      typeof patch.content === 'string' ? patch.content.trim().slice(0, 12000) : String(current.content),
      typeof patch.category === 'string' ? patch.category.trim().slice(0, 64) : String(current.category || 'custom'),
      typeof patch.icon === 'string' ? patch.icon.trim().slice(0, 16) : String(current.icon || 'Star'),
      JSON.stringify(this.objectOrDefault(patch.inputSchema, current.inputSchema as Record<string, unknown>)),
      JSON.stringify(this.objectOrDefault(patch.outputSchema, current.outputSchema as Record<string, unknown>)),
      JSON.stringify(this.objectOrDefault(patch.permissions, current.permissions as Record<string, unknown>)),
      typeof patch.exampleInput === 'string' ? patch.exampleInput.trim().slice(0, 4000) : String(current.exampleInput ?? ''),
      typeof patch.exampleOutput === 'string' ? patch.exampleOutput.trim().slice(0, 4000) : String(current.exampleOutput ?? ''),
      riskLevel,
      patch.enabled === undefined ? (current.enabled === false ? 0 : 1) : (patch.enabled === false ? 0 : 1),
      this.databaseService.now(),
      skillId,
      userId,
    );
    return this.platformGetSkill(userId, skillId);
  }

  private async platformBindSkill(userId: string, agentId: string, skillId: string): Promise<Record<string, unknown>> {
    await this.platformGetAgent(userId, agentId);
    await this.platformGetSkill(userId, skillId);
    await this.databaseService.connection.prepare(
      `INSERT IGNORE INTO agent_skill_bindings (agent_id, skill_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(agentId, skillId, userId, this.databaseService.now());
    return { agentId, skillId, bound: true };
  }

  private async platformCreateTool(userId: string, tool: Record<string, unknown>): Promise<Record<string, unknown>> {
    const created = await this.create(userId, {
      name: this.trimmed(tool.name, ''),
      displayName: this.trimmed(tool.displayName, this.trimmed(tool.name, '自定义工具')),
      description: this.trimmed(tool.description, ''),
      category: this.trimmed(tool.category, 'custom'),
      runtime: this.runtimeArg(tool.runtime),
      riskLevel: this.riskArg(tool.riskLevel, 'medium'),
      inputSchema: this.objectOrDefault(tool.inputSchema, { type: 'object', properties: {} }),
      outputSchema: this.objectOrDefault(tool.outputSchema, { type: 'object', properties: {} }),
      code: this.trimmed(tool.code, ''),
      permissions: this.objectOrDefault(tool.permissions, {}),
      timeout: this.numberArg(tool.timeout, 30, 1, 300),
      retries: this.numberArg(tool.retries, 0, 0, 3),
      enabled: tool.enabled === false ? false : true,
    });
    return { ...created };
  }

  private async platformUpdateTool(userId: string, toolId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const updated = await this.update(userId, toolId, {
      name: typeof patch.name === 'string' ? patch.name : undefined,
      displayName: typeof patch.displayName === 'string' ? patch.displayName : undefined,
      description: typeof patch.description === 'string' ? patch.description : undefined,
      category: typeof patch.category === 'string' ? patch.category : undefined,
      runtime: patch.runtime === undefined ? undefined : this.runtimeArg(patch.runtime),
      riskLevel: patch.riskLevel === undefined ? undefined : this.riskArg(patch.riskLevel, 'medium'),
      inputSchema: this.optionalRecord(patch.inputSchema),
      outputSchema: this.optionalRecord(patch.outputSchema),
      code: typeof patch.code === 'string' ? patch.code : undefined,
      permissions: this.optionalRecord(patch.permissions),
      timeout: patch.timeout === undefined ? undefined : this.numberArg(patch.timeout, 30, 1, 300),
      retries: patch.retries === undefined ? undefined : this.numberArg(patch.retries, 0, 0, 3),
      enabled: patch.enabled === undefined ? undefined : patch.enabled !== false,
    });
    return { ...updated };
  }

  private async platformBindTool(userId: string, agentId: string, toolId: string): Promise<Record<string, unknown>> {
    await this.platformGetAgent(userId, agentId);
    await this.getById(userId, toolId);
    await this.databaseService.connection.prepare(
      `INSERT IGNORE INTO agent_tools (agent_id, tool_id, user_id, permission_level, created_at)
       VALUES (?, ?, ?, 'confirm', ?)`,
    ).run(agentId, toolId, userId, this.databaseService.now());
    return { agentId, toolId, bound: true, permissionLevel: 'confirm' };
  }

  private async platformGetSkill(userId: string, skillId: string): Promise<Record<string, unknown>> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, content, category, icon,
              input_schema_json as inputSchemaJson, output_schema_json as outputSchemaJson,
              permissions_json as permissionsJson, example_input as exampleInput,
              example_output as exampleOutput, risk_level as riskLevel, version, enabled,
              created_at as createdAt, updated_at as updatedAt
       FROM agent_skills
       WHERE id = ? AND enabled = 1 AND (user_id IS NULL OR user_id = ?)
       LIMIT 1`,
    ).get(skillId, userId) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException('Skill 不存在');
    return {
      id: row.id,
      userId: row.userId || null,
      name: row.name,
      description: row.description,
      content: row.content,
      category: row.category,
      icon: row.icon,
      inputSchema: this.parseRecord(row.inputSchemaJson),
      outputSchema: this.parseRecord(row.outputSchemaJson),
      permissions: this.parseRecord(row.permissionsJson),
      exampleInput: row.exampleInput,
      exampleOutput: row.exampleOutput,
      riskLevel: row.riskLevel,
      version: Number(row.version ?? 1),
      enabled: Number(row.enabled ?? 1) === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async platformListSkills(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    return await this.databaseService.connection.prepare(
      `SELECT id, name, description, category, risk_level as riskLevel, user_id as userId
       FROM agent_skills
       WHERE enabled = 1 AND (user_id IS NULL OR user_id = ?)
       ORDER BY user_id IS NULL DESC, name ASC
       LIMIT ?`,
    ).all(userId, limit) as Array<Record<string, unknown>>;
  }

  private async platformListKnowledgeBases(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    return await this.databaseService.connection.prepare(
      `SELECT id, name, description, COALESCE(provider, 'native') as provider, external_id as externalId, created_at as createdAt, updated_at as updatedAt
       FROM knowledge_bases
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT ?`,
    ).all(userId, limit) as Array<Record<string, unknown>>;
  }

  private async platformSetAgentBindings(userId: string, agentId: string, source: Record<string, unknown>): Promise<void> {
    if (Array.isArray(source.toolIds)) {
      await this.setAgentTools(userId, agentId, source.toolIds.map(String), {});
    }
    if (Array.isArray(source.skillIds)) {
      await this.replaceSimpleBindings(userId, agentId, 'agent_skill_bindings', 'skill_id', source.skillIds.map(String));
    }
    if (Array.isArray(source.knowledgeBaseIds)) {
      await this.replaceSimpleBindings(userId, agentId, 'agent_knowledge_bases', 'kb_id', source.knowledgeBaseIds.map(String));
    }
    if (Array.isArray(source.workflowIds)) {
      await this.replaceSimpleBindings(userId, agentId, 'agent_workflows', 'workflow_id', source.workflowIds.map(String));
    }
  }

  private async replaceSimpleBindings(userId: string, agentId: string, table: string, column: string, ids: string[]): Promise<void> {
    await this.databaseService.connection.prepare(
      `DELETE FROM ${table} WHERE user_id = ? AND agent_id = ?`,
    ).run(userId, agentId);
    const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 30);
    for (const id of uniqueIds) {
      await this.databaseService.connection.prepare(
        `INSERT INTO ${table} (agent_id, ${column}, user_id, created_at) VALUES (?, ?, ?, ?)`,
      ).run(agentId, id, userId, this.databaseService.now());
    }
  }

  private async platformBindingIds(table: string, column: string, userId: string, agentId: string): Promise<string[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT ${column} as id FROM ${table} WHERE user_id = ? AND agent_id = ?`,
    ).all(userId, agentId) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  }

  private recordArg(value: unknown, name: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${name} 必须是对象`);
    }
    return value as Record<string, unknown>;
  }

  private stringArg(value: unknown, name: string): string {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) throw new BadRequestException(`${name} 不能为空`);
    return text;
  }

  private numberArg(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value ?? fallback);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
  }

  private trimmed(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value.trim() : fallback;
  }

  private optionalRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  }

  private objectOrDefault(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    return this.optionalRecord(value) ?? fallback;
  }

  private parseRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(value || '{}')) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private riskArg(value: unknown, fallback: string): 'low' | 'medium' | 'high' {
    const risk = typeof value === 'string' ? value : fallback;
    return ['low', 'medium', 'high'].includes(risk) ? risk as 'low' | 'medium' | 'high' : 'medium';
  }

  private runtimeArg(value: unknown): 'javascript' | 'typescript' | 'python' {
    return ['javascript', 'typescript', 'python'].includes(String(value)) ? String(value) as 'javascript' | 'typescript' | 'python' : 'javascript';
  }

  private defaultSkillPermissions(riskLevel: 'low' | 'medium' | 'high'): Record<string, unknown> {
    return {
      network: riskLevel !== 'low',
      knowledge: true,
      tools: riskLevel !== 'low',
      fileRead: false,
      writeData: riskLevel === 'high',
      externalRequest: riskLevel === 'high',
      userConfirm: riskLevel === 'high',
    };
  }

  private async getOwnedCustomTool(userId: string, toolId: string): Promise<ToolDefinition> {
    const tool = await this.getById(userId, toolId);
    if (!tool.userId || tool.userId !== userId || tool.implementationType !== 'custom_code') {
      throw new ForbiddenException('只能编辑或删除自己的自定义工具');
    }
    return tool;
  }

  private normalizeToolName(name: string): string {
    const normalized = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(normalized)) {
      throw new BadRequestException('工具英文标识需以字母开头，只能包含小写字母、数字和下划线');
    }
    return normalized;
  }

  private async runCustomCode(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    context: { userId: string; agentId?: string; runId?: string },
  ): Promise<string> {
    const code = tool.code?.trim() ?? '';
    if (!code) throw new BadRequestException('自定义工具代码为空');
    const endpoint = process.env.CODE_RUNNER_URL || 'http://code-runner:8787/run';
    const payload = {
      language: tool.runtime || 'python',
      code: this.wrapCustomToolCode(tool.runtime, code),
      input: {
        payload: args,
        context: {
          userId: context.userId,
          agentId: context.agentId ?? '',
          runId: context.runId ?? '',
          toolName: tool.name,
        },
      },
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.max(1000, Math.min(tool.timeoutMs || 30000, 300000))),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new BadRequestException(`自定义工具执行失败: ${text.slice(0, 800)}`);
    }
    return text;
  }

  private wrapCustomToolCode(runtime: string, code: string): string {
    if (runtime === 'python') {
      return [
        code,
        '',
        'if "run" in globals():',
        '    result = run(input.get("payload", input), input.get("context", {}))',
      ].join('\n');
    }
    return [
      code,
      '',
      'const __toolPayload = input && input.payload ? input.payload : input;',
      'const __toolContext = input && input.context ? input.context : {};',
      'const __toolResult = typeof run === "function" ? run(__toolPayload, __toolContext) : undefined;',
      '__toolResult;',
    ].join('\n');
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
    const safeUrl = await this.assertSafeFetchUrl(url);
    const maxChars = typeof args.maxChars === 'number' ? Math.max(500, Math.min(12000, args.maxChars)) : 6000;
    const response = await fetch(safeUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.7151.120 Safari/537.36' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      const nextUrl = new URL(response.headers.get('location') || '', safeUrl);
      await this.assertSafeFetchUrl(nextUrl.toString());
      throw new BadRequestException('网页读取不跟随重定向，请直接使用最终 URL');
    }
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
    return JSON.stringify({ url: safeUrl.toString(), title, text }, null, 2);
  }

  private assertCodeRunnerEnabled(): void {
    if (process.env.ENABLE_CODE_RUNNER_TOOLS !== 'true') {
      throw new BadRequestException('代码执行工具默认禁用，请由管理员显式开启 ENABLE_CODE_RUNNER_TOOLS=true');
    }
  }

  private async assertSafeFetchUrl(rawUrl: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('URL 格式无效');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('URL 必须以 http:// 或 https:// 开头');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('URL 不允许包含认证信息');
    }
    const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
    if (![80, 443].includes(port)) {
      throw new BadRequestException('URL 只允许访问 80 或 443 端口');
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) {
      throw new BadRequestException('不允许访问 localhost');
    }
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
    if (addresses.length === 0) {
      throw new BadRequestException('URL 主机无法解析');
    }
    for (const item of addresses) {
      if (this.isBlockedAddress(item.address)) {
        throw new BadRequestException('不允许访问内网、本机或链路本地地址');
      }
    }
    return parsed;
  }

  private isBlockedAddress(address: string): boolean {
    const version = isIP(address);
    if (version === 4) {
      const parts = address.split('.').map(Number);
      const [a, b] = parts;
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
      );
    }
    if (version === 6) {
      const normalized = address.toLowerCase();
      return (
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:') ||
        normalized.startsWith('::ffff:127.') ||
        normalized.startsWith('::ffff:10.') ||
        normalized.startsWith('::ffff:192.168.') ||
        normalized.startsWith('::ffff:169.254.')
      );
    }
    return true;
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
    let outputSchema: Record<string, unknown> = {};
    try {
      outputSchema = JSON.parse(row.outputSchemaJson || '{}') as Record<string, unknown>;
    } catch {}
    let permissions: Record<string, unknown> = {};
    try {
      permissions = JSON.parse(row.permissionsJson || '{}') as Record<string, unknown>;
    } catch {}
    const riskLevel = ['low', 'medium', 'high'].includes(row.riskLevel || '') ? row.riskLevel as ToolDefinition['riskLevel'] : 'low';
    return {
      id: row.id,
      userId: row.userId || null,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      schema,
      outputSchema,
      permissions,
      implementationType: row.implementationType,
      source: row.userId ? 'custom' : 'builtin',
      category: row.category || (row.userId ? 'custom' : 'builtin'),
      runtime: row.runtime || (row.userId ? 'python' : 'builtin'),
      riskLevel,
      code: row.userId ? row.code || '' : undefined,
      timeoutMs: Number(row.timeoutMs ?? 30000),
      retries: Number(row.retries ?? 0),
      enabled: Number(row.enabled) === 1,
      permissionLevel: ['auto', 'confirm', 'disabled'].includes(row.permissionLevel || '') ? row.permissionLevel as ToolDefinition['permissionLevel'] : 'auto',
    };
  }
}
