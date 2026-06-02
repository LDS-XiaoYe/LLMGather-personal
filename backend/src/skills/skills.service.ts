import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateSkillDto } from './dto/skill.dto';

export interface SkillDefinition {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  content: string;
  category: string;
  enabled: boolean;
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
  enabled: number | string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SkillsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listForUser(userId: string): Promise<SkillDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, content, category, enabled,
              created_at as createdAt, updated_at as updatedAt
       FROM agent_skills
       WHERE enabled = 1 AND (user_id IS NULL OR user_id = ?)
       ORDER BY user_id IS NULL DESC, category ASC, name ASC`,
    ).all(userId) as unknown as SkillRow[];
    return rows.map((row) => this.mapSkill(row));
  }

  async create(userId: string, dto: CreateSkillDto): Promise<SkillDefinition> {
    const id = randomUUID();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_skills
        (id, user_id, name, description, content, category, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      userId,
      dto.name.trim(),
      dto.description?.trim() ?? '',
      dto.content.trim(),
      dto.category?.trim() || 'custom',
      now,
      now,
    );
    return this.getById(userId, id);
  }

  async getById(userId: string, skillId: string): Promise<SkillDefinition> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, content, category, enabled,
              created_at as createdAt, updated_at as updatedAt
       FROM agent_skills
       WHERE id = ? AND enabled = 1 AND (user_id IS NULL OR user_id = ?)
       LIMIT 1`,
    ).get(skillId, userId) as unknown as SkillRow | undefined;
    if (!row) throw new NotFoundException('Skill 不存在或不可用');
    return this.mapSkill(row);
  }

  async getAgentSkills(userId: string, agentId: string): Promise<SkillDefinition[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT s.id, s.user_id as userId, s.name, s.description, s.content, s.category, s.enabled,
              s.created_at as createdAt, s.updated_at as updatedAt
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

  private mapSkill(row: SkillRow): SkillDefinition {
    return {
      id: row.id,
      userId: row.userId || null,
      name: row.name,
      description: row.description,
      content: row.content,
      category: row.category || 'custom',
      enabled: Number(row.enabled) === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
