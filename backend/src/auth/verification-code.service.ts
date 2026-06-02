import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { EmailService } from './email.service';

const CODE_EXPIRY_MINUTES = 5;
const CODE_SEND_INTERVAL_SECONDS = 60;

@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  /** 生成6位数字验证码 */
  private generateCode(): string {
    return Math.random().toString().slice(2, 8).padStart(6, '0');
  }

  /** 发送验证码到邮箱 */
  async sendCode(email: string): Promise<void> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();

    // Check if email is already registered
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?',
    ).get(email) as { id: string } | undefined;
    if (existingUser) {
      throw new ConflictException('该邮箱已被注册');
    }

    // Check rate limit: at most one code per minute
    const recentCode = await db.prepare(
      `SELECT id FROM email_verification_codes
       WHERE email = ? AND type = 'register' AND used_at IS NULL AND created_at > DATE_SUB(?, INTERVAL ${CODE_SEND_INTERVAL_SECONDS} SECOND)`,
    ).get(email, now) as { id: string } | undefined;
    if (recentCode) {
      throw new BadRequestException(`发送过于频繁，请 ${CODE_SEND_INTERVAL_SECONDS} 秒后重试`);
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
    const expiresAtStr = this.formatDateTime(expiresAt);

    await db.prepare(
      'INSERT INTO email_verification_codes (id, email, code, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(randomUUID(), email, code, 'register', expiresAtStr, now);

    if (!this.emailService.isConfigured) {
      // Dev mode: print code to console instead of sending email
      console.log(`[DEV] Verification code for ${email}: ${code}`);
      return;
    }

    await this.emailService.sendVerificationCode(email, code);
  }

  /** 校验验证码 */
  async verifyCode(email: string, code: string): Promise<boolean> {
    const db = this.databaseService.connection;
    const now = this.databaseService.now();

    const record = await db.prepare(
      `SELECT id, expires_at FROM email_verification_codes
       WHERE email = ? AND code = ? AND type = 'register' AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    ).get(email, code) as { id: string; expires_at: string } | undefined;

    if (!record) {
      return false;
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return false;
    }

    // Mark as used
    await db.prepare(
      'UPDATE email_verification_codes SET used_at = ? WHERE id = ?',
    ).run(now, record.id);

    return true;
  }

  private formatDateTime(d: Date): string {
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0') + '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
  }
}
