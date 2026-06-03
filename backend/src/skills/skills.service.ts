import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateSkillDto, TestSkillDto, UpdateSkillDto } from './dto/skill.dto';

export interface SkillDefinition {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  content: string;
  category: string;
  icon: string;
  source: 'builtin' | 'custom';
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: Record<string, unknown>;
  exampleInput: string;
  exampleOutput: string;
  riskLevel: 'low' | 'medium' | 'high';
  version: number;
  enabled: boolean;
  bindingCount: number;
  createdAt: string;
  updatedAt: string;
}

type SkillRow = {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  content: string;
  category: string;
  icon?: string;
  inputSchemaJson?: string;
  outputSchemaJson?: string;
  permissionsJson?: string;
  exampleInput?: string;
  exampleOutput?: string;
  riskLevel?: string;
  version?: number | string;
  enabled: number | string;
  bindingCount?: number | string;
  createdAt: string;
  updatedAt: string;
};

export interface SkillTestResult {
  skillId: string;
  output: string;
  latencyMs: number;
  error: string;
  logs: Array<{ type: string; message: string; createdAt: string }>;
  toolCalls: Array<Record<string, unknown>>;
  knowledgeAccessed: boolean;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

@Injectable()
export class SkillsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listForUser(userId: string): Promise<SkillDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT s.id, s.user_id as userId, s.name, s.description, s.content, s.category,
              s.icon, s.input_schema_json as inputSchemaJson, s.output_schema_json as outputSchemaJson,
              s.permissions_json as permissionsJson, s.example_input as exampleInput,
              s.example_output as exampleOutput, s.risk_level as riskLevel, s.version,
              s.enabled, s.created_at as createdAt, s.updated_at as updatedAt,
              (SELECT COUNT(*) FROM agent_skill_bindings b WHERE b.skill_id = s.id AND b.user_id = ?) as bindingCount
       FROM agent_skills s
       WHERE (s.user_id IS NULL OR s.user_id = ?)
       ORDER BY s.user_id IS NULL DESC, s.category ASC, s.name ASC`,
    ).all(userId, userId) as unknown as SkillRow[];
    return rows.map((row) => this.mapSkill(row));
  }

  async create(userId: string, dto: CreateSkillDto): Promise<SkillDefinition> {
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_skills
        (id, user_id, name, description, content, category, icon, input_schema_json, output_schema_json,
         permissions_json, example_input, example_output, risk_level, version, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      id,
      userId,
      dto.name.trim(),
      dto.description?.trim() ?? '',
      dto.content.trim(),
      dto.category?.trim() || 'custom',
      dto.icon?.trim() || 'Star',
      JSON.stringify(dto.inputSchema ?? { type: 'object', properties: { input: { type: 'string' } } }),
      JSON.stringify(dto.outputSchema ?? { type: 'object', properties: { output: { type: 'string' } } }),
      JSON.stringify(dto.permissions ?? this.defaultPermissions(dto.riskLevel ?? 'low')),
      dto.exampleInput?.trim() ?? '',
      dto.exampleOutput?.trim() ?? '',
      dto.riskLevel ?? 'low',
      dto.enabled === false ? 0 : 1,
      now,
      now,
    );
    return this.getById(userId, id);
  }

  async getById(userId: string, skillId: string): Promise<SkillDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT s.id, s.user_id as userId, s.name, s.description, s.content, s.category,
              s.icon, s.input_schema_json as inputSchemaJson, s.output_schema_json as outputSchemaJson,
              s.permissions_json as permissionsJson, s.example_input as exampleInput,
              s.example_output as exampleOutput, s.risk_level as riskLevel, s.version,
              s.enabled, s.created_at as createdAt, s.updated_at as updatedAt,
              (SELECT COUNT(*) FROM agent_skill_bindings b WHERE b.skill_id = s.id AND b.user_id = ?) as bindingCount
       FROM agent_skills s
       WHERE s.id = ? AND (s.user_id IS NULL OR s.user_id = ?)
       LIMIT 1`,
    ).get(userId, skillId, userId) as unknown as SkillRow | undefined;
    if (!row) throw new NotFoundException('Skill 不存在或不可用');
    return this.mapSkill(row);
  }

  async getAgentSkills(userId: string, agentId: string): Promise<SkillDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT s.id, s.user_id as userId, s.name, s.description, s.content, s.category,
              s.icon, s.input_schema_json as inputSchemaJson, s.output_schema_json as outputSchemaJson,
              s.permissions_json as permissionsJson, s.example_input as exampleInput,
              s.example_output as exampleOutput, s.risk_level as riskLevel, s.version,
              s.enabled, s.created_at as createdAt, s.updated_at as updatedAt, 0 as bindingCount
       FROM agent_skill_bindings b
       JOIN agent_skills s ON s.id = b.skill_id
       WHERE b.user_id = ? AND b.agent_id = ? AND s.enabled = 1
       ORDER BY s.category ASC, s.name ASC`,
    ).all(userId, agentId) as unknown as SkillRow[];
    return rows.map((row) => this.mapSkill(row));
  }

  async setAgentSkills(userId: string, agentId: string, skillIds: string[]): Promise<void> {
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_skill_bindings WHERE user_id = ? AND agent_id = ?',
    ).run(userId, agentId);

    const uniqueIds = Array.from(new Set(skillIds.filter(Boolean)));
    for (const skillId of uniqueIds) {
      await this.getById(userId, skillId);
      await this.databaseService.connection.prepare(
        'INSERT INTO agent_skill_bindings (agent_id, skill_id, user_id, created_at) VALUES (?, ?, ?, ?)',
      ).run(agentId, skillId, userId, this.databaseService.now());
    }
  }

  async bindAgentSkill(userId: string, agentId: string, skillId: string): Promise<void> {
    await this.getById(userId, skillId);
    await this.databaseService.connection.prepare(
      `INSERT IGNORE INTO agent_skill_bindings (agent_id, skill_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(agentId, skillId, userId, this.databaseService.now());
  }

  async update(userId: string, skillId: string, dto: UpdateSkillDto): Promise<SkillDefinition> {
    const current = await this.getById(userId, skillId);
    if (!current.userId) throw new ForbiddenException('平台内置 Skill 不允许直接编辑，请先复制为自定义 Skill');
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `UPDATE agent_skills
       SET name = ?, description = ?, content = ?, category = ?, icon = ?, input_schema_json = ?,
           output_schema_json = ?, permissions_json = ?, example_input = ?, example_output = ?,
           risk_level = ?, enabled = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      dto.name?.trim() || current.name,
      dto.description?.trim() ?? current.description,
      dto.content?.trim() || current.content,
      dto.category?.trim() || current.category,
      dto.icon?.trim() || current.icon,
      JSON.stringify(dto.inputSchema ?? current.inputSchema),
      JSON.stringify(dto.outputSchema ?? current.outputSchema),
      JSON.stringify(dto.permissions ?? current.permissions),
      dto.exampleInput?.trim() ?? current.exampleInput,
      dto.exampleOutput?.trim() ?? current.exampleOutput,
      dto.riskLevel ?? current.riskLevel,
      dto.enabled === false ? 0 : 1,
      now,
      skillId,
      userId,
    );
    return this.getById(userId, skillId);
  }

  async remove(userId: string, skillId: string): Promise<void> {
    const current = await this.getById(userId, skillId);
    if (!current.userId) throw new ForbiddenException('平台内置 Skill 不允许删除');
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_skill_bindings WHERE skill_id = ? AND user_id = ?',
    ).run(skillId, userId);
    await this.databaseService.connection.prepare(
      'DELETE FROM agent_skills WHERE id = ? AND user_id = ?',
    ).run(skillId, userId);
  }

  async copyToCustom(userId: string, skillId: string): Promise<SkillDefinition> {
    const source = await this.getById(userId, skillId);
    return this.create(userId, {
      name: `${source.name} Copy`.slice(0, 80),
      description: source.description,
      content: source.content,
      category: source.category,
      icon: source.icon,
      inputSchema: source.inputSchema,
      outputSchema: source.outputSchema,
      permissions: source.permissions,
      exampleInput: source.exampleInput,
      exampleOutput: source.exampleOutput,
      riskLevel: source.riskLevel,
      enabled: source.enabled,
    });
  }

  async listBoundAgents(userId: string, skillId: string): Promise<Array<{ id: string; name: string }>> {
    await this.getById(userId, skillId);
    return this.databaseService.connection.prepare(
      `SELECT a.id, a.name
       FROM agent_skill_bindings b
       JOIN agents a ON a.id = b.agent_id
       WHERE b.user_id = ? AND b.skill_id = ? AND a.deleted_at IS NULL
       ORDER BY a.updated_at DESC`,
    ).all(userId, skillId) as unknown as Array<{ id: string; name: string }>;
  }

  async runSkill(userId: string, skillId: string, dto: TestSkillDto): Promise<SkillTestResult> {
    const started = Date.now();
    const skill = await this.getById(userId, skillId);
    if (!skill.enabled) throw new BadRequestException('Skill 已禁用');
    const output = [
      `Skill: ${skill.name}`,
      `输入: ${dto.input}`,
      '',
      '执行策略:',
      skill.content,
      '',
      '输出预览:',
      this.interpolateSkillOutput(skill, dto.input),
    ].join('\n');
    const permissions = skill.permissions;
    return {
      skillId,
      output,
      latencyMs: Date.now() - started,
      error: '',
      logs: [
        { type: 'skill_loaded', message: `${skill.name} v${skill.version}`, createdAt: this.databaseService.now() },
        { type: 'permission_check', message: `risk=${skill.riskLevel}`, createdAt: this.databaseService.now() },
        { type: 'skill_completed', message: 'Skill dry-run completed', createdAt: this.databaseService.now() },
      ],
      toolCalls: permissions.tools ? [{ name: 'declared_tool_access', status: 'not_invoked_in_preview' }] : [],
      knowledgeAccessed: Boolean(permissions.knowledge),
      tokenUsage: { promptTokens: Math.ceil((skill.content.length + dto.input.length) / 4), completionTokens: Math.ceil(output.length / 6), totalTokens: Math.ceil((skill.content.length + dto.input.length) / 4) + Math.ceil(output.length / 6) },
    };
  }

  private mapSkill(row: SkillRow): SkillDefinition {
    const riskLevel = ['low', 'medium', 'high'].includes(row.riskLevel || '') ? row.riskLevel as SkillDefinition['riskLevel'] : 'low';
    return {
      id: row.id,
      userId: row.userId || null,
      name: row.name,
      description: row.description,
      content: row.content,
      category: row.category || 'custom',
      icon: row.icon || 'Star',
      source: row.userId ? 'custom' : 'builtin',
      inputSchema: this.parseJson(row.inputSchemaJson, { type: 'object', properties: { input: { type: 'string' } } }),
      outputSchema: this.parseJson(row.outputSchemaJson, { type: 'object', properties: { output: { type: 'string' } } }),
      permissions: this.parseJson(row.permissionsJson, this.defaultPermissions(riskLevel)),
      exampleInput: row.exampleInput || '',
      exampleOutput: row.exampleOutput || '',
      riskLevel,
      version: Number(row.version || 1),
      enabled: Number(row.enabled) === 1,
      bindingCount: Number(row.bindingCount || 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseJson<T>(value: string | undefined, fallback: T): T {
    try {
      return value ? JSON.parse(value) as T : fallback;
    } catch {
      return fallback;
    }
  }

  private defaultPermissions(riskLevel: 'low' | 'medium' | 'high'): Record<string, unknown> {
    return {
      network: riskLevel !== 'low',
      knowledge: false,
      tools: riskLevel === 'high',
      fileRead: false,
      writeData: false,
      externalRequest: riskLevel === 'high',
      userConfirm: riskLevel === 'high',
    };
  }

  private interpolateSkillOutput(skill: SkillDefinition, input: string): string {
    if (skill.exampleOutput) {
      return skill.exampleOutput.replaceAll('{{input}}', input);
    }
    return `已根据「${skill.name}」处理输入，并生成结构化建议。`;
  }
}
