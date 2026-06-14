import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

const CHALLENGE_TTL_SECONDS = 5 * 60;

@Injectable()
export class ChallengeService {
  constructor(private readonly redisService: RedisService) {}

  async create(ip: string, userAgent: string): Promise<{ challengeId: string; expiresIn: number }> {
    const challengeId = randomUUID();
    await this.redisService.setJson(`security:challenge:${challengeId}`, {
      ip,
      userAgent,
      createdAt: Date.now(),
    }, CHALLENGE_TTL_SECONDS);
    return { challengeId, expiresIn: CHALLENGE_TTL_SECONDS };
  }

  async assertValid(challengeId: string): Promise<{ valid: boolean; reason?: string }> {
    if (!challengeId) return { valid: false, reason: 'challengeId 缺失' };
    const used = await this.redisService.getJson<Record<string, unknown>>(`security:challenge:used:${challengeId}`);
    if (used) return { valid: false, reason: 'challenge 已使用' };
    const challenge = await this.redisService.getJson<Record<string, unknown>>(`security:challenge:${challengeId}`);
    if (!challenge) return { valid: false, reason: 'challenge 不存在或已过期' };
    return { valid: true };
  }

  async markUsed(challengeId: string): Promise<void> {
    if (!challengeId) throw new BadRequestException('challengeId 缺失');
    await this.redisService.del(`security:challenge:${challengeId}`);
    await this.redisService.setJson(`security:challenge:used:${challengeId}`, { usedAt: Date.now() }, CHALLENGE_TTL_SECONDS);
  }
}
