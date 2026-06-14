import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private ready = false;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = createClient({ url });
    this.client.on('error', (error: unknown) => {
      this.ready = false;
      this.logger.error(`Redis 连接错误: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.client.on('ready', () => {
      this.ready = true;
      this.logger.log('Redis 已连接');
    });
    try {
      await this.client.connect();
      this.ready = true;
    } catch (error) {
      this.ready = false;
      this.logger.error(`Redis 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }

  getClient(): RedisClientType {
    if (!this.client || !this.ready || !this.client.isOpen) {
      throw new ServiceUnavailableException('Redis 不可用，安全验证暂时无法完成');
    }
    return this.client;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.getClient().set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getClient().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async del(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const client = this.getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, ttlSeconds);
    return count;
  }
}
