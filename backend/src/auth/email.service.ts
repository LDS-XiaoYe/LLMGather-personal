import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Email features disabled.');
      return;
    }

    this.config = {
      host,
      port,
      secure: port === 465,
      user,
      pass,
      fromName: process.env.SMTP_FROM_NAME || 'LLM Gather',
      fromAddress: process.env.SMTP_FROM_ADDRESS || user,
    };

    this.transporter = createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    this.logger.log(`SMTP configured: ${this.config.host}:${this.config.port}`);
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('邮件服务未配置，无法发送验证码');
    }

    const subject = '邮箱验证码 - 注册';
    const html = `
      <div style="max-width:480px;margin:0 auto;padding:32px;font-family:sans-serif;">
        <h2 style="color:#333;text-align:center;">邮箱验证</h2>
        <p style="color:#555;font-size:15px;">您正在注册账号，验证码为：</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#409EFF;">${code}</span>
        </div>
        <p style="color:#999;font-size:13px;">验证码有效期为 5 分钟，请尽快使用。如非本人操作，请忽略此邮件。</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
      to: email,
      subject,
      html,
    });

    this.logger.log(`Verification code sent to ${email}`);
  }
}
