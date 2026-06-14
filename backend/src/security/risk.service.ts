import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CaptchaService } from './captcha.service';
import { ChallengeService } from './challenge.service';
import { BehaviorPayload, RiskCheckInput, RiskCheckResult } from './security.types';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly challengeService: ChallengeService,
    private readonly captchaService: CaptchaService,
  ) {}

  async check(ip: string, userAgent: string, input: RiskCheckInput, consumeChallenge = false): Promise<RiskCheckResult> {
    const behavior = input.behaviorPayload ?? {};
    const reasons: string[] = [];
    let riskScore = 0;

    await this.redisService.incrWithTtl(`security:rate:ip:${ip}`, 60);
    const rateCount = await this.redisService.incrWithTtl(`security:rate:ip:${ip}:auth`, 60);
    const failedCount = Number(await this.redisService.getClient().get(`security:login:fail:ip:${ip}`) ?? 0);

    const challenge = await this.challengeService.assertValid(input.challengeId);
    if (!challenge.valid) {
      riskScore += 50;
      reasons.push(challenge.reason || 'challenge 异常');
    }
    if (this.num(behavior.duration) < 800) { riskScore += 30; reasons.push('页面停留时间过短'); }
    if (this.num(behavior.mouseMoveCount) < 3) { riskScore += 20; reasons.push('鼠标行为不足'); }
    if (this.num(behavior.clickCount) === 0) { riskScore += 10; reasons.push('无点击行为'); }
    if (this.num(behavior.keydownCount) === 0) { riskScore += 10; reasons.push('无键盘输入行为'); }
    if (behavior.webdriver === true) { riskScore += 40; reasons.push('检测到 webdriver'); }
    if (failedCount >= 5) { riskScore += 30; reasons.push('同 IP 失败次数过多'); }
    if (rateCount > 30) { riskScore += 30; reasons.push('同 IP 请求频率过高'); }
    if (!userAgent || this.isSuspiciousUserAgent(userAgent)) { riskScore += 20; reasons.push('User-Agent 异常'); }

    if (riskScore >= 100) {
      this.logger.warn(`高风险请求被拒绝 ip=${ip} score=${riskScore} reasons=${reasons.join(',')}`);
      throw new ForbiddenException({ message: '请求风险过高，请稍后再试', riskScore, captchaRequired: true, rejected: true });
    }

    if (riskScore >= 60) {
      if (!input.captchaId || !input.captchaCode) {
        return { allowed: false, captchaRequired: true, rejected: false, riskScore, reasons };
      }
      const captchaOk = await this.captchaService.verify(input.captchaId, input.captchaCode);
      if (!captchaOk) {
        await this.recordFailure(ip);
        throw new UnauthorizedException({ message: '图形验证码错误或已过期', riskScore, captchaRequired: true });
      }
    }

    if (!challenge.valid) {
      throw new UnauthorizedException({ message: challenge.reason || 'challenge 无效', riskScore, captchaRequired: riskScore >= 60 });
    }
    if (consumeChallenge) await this.challengeService.markUsed(input.challengeId);
    return { allowed: true, captchaRequired: false, rejected: false, riskScore, reasons };
  }

  async recordFailure(ip: string): Promise<void> {
    await this.redisService.incrWithTtl(`security:login:fail:ip:${ip}`, 10 * 60);
  }

  async clearFailures(ip: string): Promise<void> {
    await this.redisService.del(`security:login:fail:ip:${ip}`);
  }

  private num(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isSuspiciousUserAgent(value: string): boolean {
    const ua = value.toLowerCase();
    return ua.length < 12 || /curl|wget|python-requests|httpclient|bot|spider|scrapy/.test(ua);
  }
}
