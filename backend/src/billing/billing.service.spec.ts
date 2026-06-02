import { Test } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';

describe('BillingService', () => {
  let service: BillingService;
  let dbPrepareMock: jest.Mock;
  let dbGetMock: jest.Mock;

  beforeEach(async () => {
    dbGetMock = jest.fn();
    dbPrepareMock = jest.fn().mockReturnValue({
      get: dbGetMock,
      run: jest.fn().mockResolvedValue(undefined),
      all: jest.fn().mockResolvedValue([]),
    });

    const mockDatabaseService = {
      connection: {
        prepare: dbPrepareMock,
      },
      now: () => new Date().toISOString(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('estimatePromptTokens (via reserveForStream)', () => {
    it('should estimate tokens for plain ASCII content', () => {
      const request = {
        model: 'test',
        messages: [{ role: 'user' as const, content: 'Hello world, this is a test message.' }],
      };

      const usage = service.reserveForStream('u1', request);

      expect(usage.prompt_tokens).toBeGreaterThan(0);
      // ~42 ASCII chars / 4 ≈ 11
      expect(usage.prompt_tokens).toBeLessThanOrEqual(15);
      expect(usage.completion_tokens).toBeGreaterThan(0);
      expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
    });

    it('should estimate tokens for CJK content', () => {
      const request = {
        model: 'test',
        messages: [{ role: 'user' as const, content: '你好世界这是一条测试消息' }],
      };

      // 11 CJK chars
      const usage = service.reserveForStream('u1', request);

      expect(usage.prompt_tokens).toBeGreaterThan(0);
      // ~11 CJK chars / 1.5 ≈ 8
      expect(usage.prompt_tokens).toBeLessThanOrEqual(12);
    });

    it('should handle mixed CJK + ASCII content', () => {
      const request = {
        model: 'test',
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant. 你是一个有用的助手。' },
          { role: 'user' as const, content: 'What is AI? 什么是人工智能？' },
        ],
      };

      // system: ~26 ASCII + 10 CJK; user: ~11 ASCII + 9 CJK
      // ~37 ASCII / 4 ≈ 10; ~19 CJK / 1.5 ≈ 13; total ≈ 23
      const usage = service.reserveForStream('u1', request);
      expect(usage.prompt_tokens).toBeGreaterThanOrEqual(18);
      expect(usage.prompt_tokens).toBeLessThanOrEqual(30);
    });

    it('should return at least 1 token', () => {
      const request = {
        model: 'test',
        messages: [{ role: 'user' as const, content: '' }],
      };

      const usage = service.reserveForStream('u1', request);

      expect(usage.prompt_tokens).toBe(1);
    });
  });

  describe('chargeForCompletion', () => {
    it('should throw if user not found', async () => {
      // calculateCost queries billing_rules twice first
      dbGetMock
        .mockResolvedValueOnce(undefined) // billing_rules prompt → fallback
        .mockResolvedValueOnce(undefined) // billing_rules completion → fallback
        .mockResolvedValueOnce(undefined); // user not found in charge()

      await expect(
        service.chargeForCompletion('u1', {
          model: 'test',
          messages: [{ role: 'user' as const, content: 'hello' }],
        }),
      ).rejects.toThrow('用户不存在');
    });

    it('should throw if balance insufficient', async () => {
      // calculateCost queries billing_rules twice (prompt + completion), each catching errors
      dbGetMock
        .mockResolvedValueOnce(undefined) // billing_rules prompt price → falls back
        .mockResolvedValueOnce(undefined) // billing_rules completion price → falls back
        .mockResolvedValueOnce({          // user query in charge()
          id: 'u1',
          credits: 0.001,
          totalSpent: 0,
        });

      await expect(
        service.chargeForCompletion('u1', {
          model: 'test',
          messages: [{ role: 'user' as const, content: 'hello' }],
        }),
      ).rejects.toThrow('余额不足');
    });
  });
});
