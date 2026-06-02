import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateMcpServerDto } from './dto/mcp.dto';

export interface McpServer {
  id: string;
  userId: string;
  name: string;
  serverType: 'notion';
  config: Record<string, unknown>;
  enabled: boolean;
  lastStatus: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

type McpServerRow = {
  id: string;
  userId: string;
  name: string;
  serverType: 'notion';
  configJson: string;
  enabled: number | string;
  lastStatus: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class McpService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(userId: string): Promise<McpServer[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, server_type as serverType, config_json as configJson,
              enabled, last_status as lastStatus, last_error as lastError,
              created_at as createdAt, updated_at as updatedAt
       FROM mcp_servers
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
    ).all(userId) as unknown as McpServerRow[];
    return rows.map((row) => this.mapServer(row, true));
  }

  async create(userId: string, dto: CreateMcpServerDto): Promise<McpServer> {
    if (dto.serverType !== 'notion') throw new BadRequestException('当前仅支持 Notion MCP Server');
    this.assertNotionConfig(dto.config);
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO mcp_servers
        (id, user_id, name, server_type, config_json, enabled, last_status, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unknown', '', ?, ?)`,
    ).run(
      id,
      userId,
      dto.name.trim(),
      dto.serverType,
      JSON.stringify(dto.config),
      dto.enabled === false ? 0 : 1,
      now,
      now,
    );
    return this.get(userId, id);
  }

  async get(userId: string, serverId: string): Promise<McpServer> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, server_type as serverType, config_json as configJson,
              enabled, last_status as lastStatus, last_error as lastError,
              created_at as createdAt, updated_at as updatedAt
       FROM mcp_servers
       WHERE id = ? AND user_id = ?`,
    ).get(serverId, userId) as unknown as McpServerRow | undefined;
    if (!row) throw new NotFoundException('MCP Server 不存在');
    return this.mapServer(row, true);
  }

  async getFirstEnabledNotion(userId: string): Promise<McpServer | null> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, server_type as serverType, config_json as configJson,
              enabled, last_status as lastStatus, last_error as lastError,
              created_at as createdAt, updated_at as updatedAt
       FROM mcp_servers
       WHERE user_id = ? AND server_type = 'notion' AND enabled = 1
       ORDER BY updated_at DESC
       LIMIT 1`,
    ).get(userId) as unknown as McpServerRow | undefined;
    return row ? this.mapServer(row, false) : null;
  }

  async test(userId: string, serverId: string, query = 'test'): Promise<Record<string, unknown>> {
    const server = await this.get(userId, serverId);
    if (server.serverType !== 'notion') throw new BadRequestException('当前仅支持 Notion 测试');
    try {
      const results = await this.searchNotion(server, query, 3);
      await this.updateStatus(server.id, 'ok', '');
      return { ok: true, results };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateStatus(server.id, 'failed', message);
      return { ok: false, error: message };
    }
  }

  async searchNotion(server: McpServer, query: string, limit = 5): Promise<Array<Record<string, unknown>>> {
    const token = String(server.config.token || '');
    if (!token) throw new BadRequestException('Notion token 未配置');
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': String(server.config.version || '2022-06-28'),
      },
      body: JSON.stringify({
        query,
        page_size: Math.max(1, Math.min(10, limit)),
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(`Notion 请求失败: ${response.status} ${JSON.stringify(payload).slice(0, 300)}`);
    }
    const results = Array.isArray(payload.results) ? payload.results as Array<Record<string, unknown>> : [];
    return results.map((item) => ({
      id: item.id,
      object: item.object,
      url: item.url,
      title: this.extractNotionTitle(item),
    }));
  }

  private async updateStatus(id: string, status: string, error: string): Promise<void> {
    await this.databaseService.connection.prepare(
      `UPDATE mcp_servers SET last_status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
    ).run(status, error, this.databaseService.now(), id);
  }

  private assertNotionConfig(config: Record<string, unknown>): void {
    if (typeof config.token !== 'string' || !config.token.trim()) {
      throw new BadRequestException('Notion MCP 需要 token');
    }
  }

  private extractNotionTitle(item: Record<string, unknown>): string {
    const properties = item.properties as Record<string, unknown> | undefined;
    if (!properties) return String(item.id || 'Untitled');
    for (const value of Object.values(properties)) {
      const prop = value as { title?: Array<{ plain_text?: string }>; name?: string };
      if (Array.isArray(prop.title) && prop.title[0]?.plain_text) return prop.title[0].plain_text;
      if (typeof prop.name === 'string') return prop.name;
    }
    return String(item.id || 'Untitled');
  }

  private mapServer(row: McpServerRow, mask = true): McpServer {
    const config = this.parseConfig(row.configJson);
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      serverType: row.serverType,
      config: mask ? this.maskConfig(config) : config,
      enabled: Number(row.enabled) === 1,
      lastStatus: row.lastStatus || 'unknown',
      lastError: row.lastError || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseConfig(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    return {
      ...config,
      token: typeof config.token === 'string' ? `${config.token.slice(0, 8)}...` : undefined,
    };
  }
}
