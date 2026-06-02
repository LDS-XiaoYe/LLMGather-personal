import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { pbkdf2Sync, randomBytes, randomUUID } from 'crypto';
import { AuthUser, StoredUser } from './auth.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  private readonly defaultCredits = Number(process.env.DEFAULT_USER_CREDITS || 20);

  constructor(private readonly databaseService: DatabaseService) {}

  async getInvitationCredits(): Promise<number> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT value FROM system_settings WHERE `key` = ?',
    ).get('invitation_credits') as { value: string } | undefined;
    return row ? Number(row.value) : 10;
  }

  async setInvitationCredits(value: number): Promise<void> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();
    const existing = await db.prepare(
      'SELECT id FROM system_settings WHERE `key` = ?',
    ).get('invitation_credits') as { id: string } | undefined;

    if (existing) {
      await db.prepare(
        'UPDATE system_settings SET value = ?, description = ?, updated_at = ? WHERE `key` = ?',
      ).run(String(value), '邀请奖励余额', now, 'invitation_credits');
    } else {
      await db.prepare(
        'INSERT INTO system_settings (`key`, value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ).run('invitation_credits', String(value), '邀请奖励余额', now, now);
    }
  }

  private generateInvitationCode(): string {
    return Math.random().toString().slice(2, 8).padStart(6, '0');
  }

  private async generateUniqueInvitationCode(): Promise<string> {
    const db = this.databaseService.connection;
    let code: string;
    let attempts = 0;
    do {
      code = this.generateInvitationCode();
      const existing = await db
        .prepare('SELECT id FROM users WHERE invitation_code = ?')
        .get(code) as { id: string } | undefined;
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    if (attempts >= 10) {
      code = randomUUID().slice(0, 6).toUpperCase();
    }
    return code;
  }

  async createUser(usernameRaw: string, password: string, email: string, invitedBy?: string): Promise<AuthUser> {
    const username = usernameRaw.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const db = this.databaseService.connection;

    const existing = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username) as { id: string } | undefined;
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    const existingEmail = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail) as { id: string } | undefined;
    if (existingEmail) {
      throw new ConflictException('该邮箱已被注册');
    }

    const { total: userCount } = await db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number };
    const adminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const isAdmin = (userCount === 0) || (adminUsername && username === adminUsername);
    const role = isAdmin ? 'admin' : 'user';

    const salt = randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const invitationCode = await this.generateUniqueInvitationCode();

    let credits = this.defaultCredits;
    if (invitedBy) {
      const inviter = await this.getById(invitedBy);
      if (inviter) {
        await this.awardInvitationCredits(invitedBy);
      }
    }

    const user: StoredUser = {
      id: randomUUID(),
      username,
      email: normalizedEmail,
      role,
      passwordHash,
      salt,
      credits,
      totalSpent: 0,
      createdAt: this.databaseService.now(),
    };

    await db.prepare(
      'INSERT INTO users (id, username, email, role, password_hash, salt, credits, total_spent, created_at, invitation_code, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      user.id,
      user.username,
      user.email,
      user.role,
      user.passwordHash,
      user.salt,
      user.credits,
      user.totalSpent,
      user.createdAt,
      invitationCode,
      invitedBy || null,
    );

    return this.toPublicUser(user);
  }

  async validateUser(usernameRaw: string, password: string): Promise<StoredUser | null> {
    const username = usernameRaw.trim().toLowerCase();
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT id, username, email, role, password_hash as passwordHash, salt, credits, total_spent as totalSpent, created_at as createdAt FROM users WHERE username = ?',
    ).get(username) as unknown as StoredUser | undefined;

    if (!row) return null;
    return this.hashPassword(password, row.salt) === row.passwordHash ? row : null;
  }

  async getById(userId: string): Promise<StoredUser> {
    const db = this.databaseService.connection;
    const user = await db.prepare(
      'SELECT id, username, email, role, password_hash as passwordHash, salt, credits, total_spent as totalSpent, created_at as createdAt FROM users WHERE id = ?',
    ).get(userId) as unknown as StoredUser | undefined;

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async getPublicById(userId: string): Promise<AuthUser> {
    return this.toPublicUser(await this.getById(userId));
  }

  async getInvitationCodeByUserId(userId: string): Promise<string | null> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT invitation_code as invitationCode FROM users WHERE id = ?',
    ).get(userId) as { invitationCode: string | null } | undefined;

    if (row?.invitationCode) {
      return row.invitationCode;
    }

    const code = await this.generateUniqueInvitationCode();
    await db.prepare('UPDATE users SET invitation_code = ? WHERE id = ?').run(code, userId);
    return code;
  }

  async getUserIdByInvitationCode(code: string): Promise<string | null> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT id FROM users WHERE invitation_code = ?',
    ).get(code) as { id: string } | undefined;
    return row?.id || null;
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.getById(userId);
    const salt = randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(newPassword, salt);
    await this.databaseService.connection
      .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
      .run(passwordHash, salt, userId);
  }

  async topUpCredits(userId: string, amount: number): Promise<AuthUser> {
    const user = await this.getById(userId);
    user.credits = Number((Number(user.credits) + amount).toFixed(6));

    await this.databaseService.connection
      .prepare('UPDATE users SET credits = ? WHERE id = ?')
      .run(user.credits, userId);

    return this.toPublicUser(user);
  }

  private async awardInvitationCredits(userId: string): Promise<void> {
    const user = await this.getById(userId);
    const invitationCredits = await this.getInvitationCredits();
    user.credits = Number((Number(user.credits) + invitationCredits).toFixed(6));

    await this.databaseService.connection
      .prepare('UPDATE users SET credits = ? WHERE id = ?')
      .run(user.credits, userId);
  }

  private hashPassword(password: string, salt: string): string {
    return pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  private toPublicUser(user: StoredUser): AuthUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email || null,
      role: user.role || 'user',
      credits: Number(user.credits),
      totalSpent: Number(user.totalSpent),
      createdAt: user.createdAt,
    };
  }
}