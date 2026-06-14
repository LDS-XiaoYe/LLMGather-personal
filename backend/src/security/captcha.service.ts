import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

const CAPTCHA_TTL_SECONDS = 5 * 60;

@Injectable()
export class CaptchaService {
  constructor(private readonly redisService: RedisService) {}

  async create(): Promise<{ captchaId: string; image: string; expiresIn: number }> {
    const captchaId = randomUUID();
    const code = this.randomCode();
    await this.redisService.setJson(`security:captcha:${captchaId}`, { code, createdAt: Date.now() }, CAPTCHA_TTL_SECONDS);
    return { captchaId, image: this.svgDataUrl(code), expiresIn: CAPTCHA_TTL_SECONDS };
  }

  async verify(captchaId: string, captchaCode: string): Promise<boolean> {
    if (!captchaId || !captchaCode) throw new BadRequestException('请输入图形验证码');
    const key = `security:captcha:${captchaId}`;
    const record = await this.redisService.getJson<{ code?: string }>(key);
    if (!record?.code) return false;
    const ok = record.code.toLowerCase() === captchaCode.trim().toLowerCase();
    if (ok) await this.redisService.del(key);
    return ok;
  }

  private randomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private svgDataUrl(code: string): string {
    const noise = Array.from({ length: 7 }, (_, idx) => {
      const y = 18 + Math.floor(Math.random() * 34);
      return `<line x1="${idx * 24}" y1="${y}" x2="${160 - idx * 11}" y2="${60 - y / 2}" stroke="#94a3b8" stroke-width="1" opacity="0.45"/>`;
    }).join('');
    const text = code.split('').map((char, idx) => {
      const rotate = Math.floor(Math.random() * 24) - 12;
      return `<text x="${22 + idx * 24}" y="${38 + (idx % 2) * 4}" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a" transform="rotate(${rotate} ${22 + idx * 24} 36)">${char}</text>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="56" viewBox="0 0 160 56"><rect width="160" height="56" rx="8" fill="#f8fafc"/><path d="M0 42 C30 18, 60 60, 96 26 S138 12, 160 30" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.65"/>${noise}${text}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  }
}
