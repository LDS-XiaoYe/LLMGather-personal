import { ApiKeyPool } from './api-key-pool';

describe('ApiKeyPool', () => {
  describe('constructor', () => {
    it('should throw when given an empty array', () => {
      expect(() => new ApiKeyPool([])).toThrow('ApiKeyPool requires at least one non-empty key');
    });

    it('should throw when given only empty/whitespace strings', () => {
      expect(() => new ApiKeyPool(['', '  ', '\t'])).toThrow('ApiKeyPool requires at least one non-empty key');
    });

    it('should deduplicate identical keys', () => {
      const pool = new ApiKeyPool(['A', 'A', 'B', 'B', 'B']);
      expect(pool.size()).toBe(2);
    });

    it('should trim whitespace from keys', () => {
      const pool = new ApiKeyPool(['  sk-abc  ', '\tsk-xyz\n']);
      expect(pool.size()).toBe(2);
      expect(pool.getKey()).toBe('sk-abc');
    });
  });

  describe('getKey — round-robin', () => {
    it('should return keys in round-robin order', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      // 6 calls should produce A,B,C,A,B,C
      expect(pool.getKey()).toBe('A');
      expect(pool.getKey()).toBe('B');
      expect(pool.getKey()).toBe('C');
      expect(pool.getKey()).toBe('A');
      expect(pool.getKey()).toBe('B');
      expect(pool.getKey()).toBe('C');
    });

    it('should work with a single key (backward compatibility)', () => {
      const pool = new ApiKeyPool(['only-key']);
      expect(pool.getKey()).toBe('only-key');
      expect(pool.getKey()).toBe('only-key');
      expect(pool.getKey()).toBe('only-key');
    });
  });

  describe('getKey — cooldown', () => {
    it('should skip a key in cooldown and return the next available', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      pool.markRateLimited('A'); // A enters 30s cooldown
      expect(pool.getKey()).toBe('B'); // should skip A
      expect(pool.getKey()).toBe('C');
      expect(pool.getKey()).toBe('B'); // A still cooling, B/C rotate
    });

    it('should remove all cooled keys from the usable pool', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      pool.markRateLimited('A');
      pool.markRateLimited('B');
      pool.markRateLimited('C');
      expect(pool.availableCount()).toBe(0);
      expect(() => pool.getKey()).toThrow('ApiKeyPool has no usable keys');
    });
  });

  describe('markRateLimited', () => {
    it('should set cooldownUntil to now + cooldownMs', () => {
      const before = Date.now();
      const pool = new ApiKeyPool(['A']);
      pool.markRateLimited('A');
      const entries = pool._debugEntries();
      expect(entries[0].cooldownUntil).toBeGreaterThanOrEqual(before + 30_000);
      expect(entries[0].cooldownUntil).toBeLessThanOrEqual(Date.now() + 30_000 + 100);
    });

    it('should be a no-op for unknown keys', () => {
      const pool = new ApiKeyPool(['A']);
      expect(() => pool.markRateLimited('NONEXISTENT')).not.toThrow();
      expect(pool.availableCount()).toBe(1);
    });
  });

  describe('markRetryableFailure', () => {
    it('should advance nextIndex without setting cooldown', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      const before = pool._debugNextIndex(); // 0
      pool.markRetryableFailure('A');
      expect(pool._debugNextIndex()).toBe(1); // advanced past A
      // A should still be available (no cooldown set)
      expect(pool.availableCount()).toBe(3);
      // getKey should now start at B
      expect(pool.getKey()).toBe('B');
    });

    it('should be a no-op for unknown keys', () => {
      const pool = new ApiKeyPool(['A', 'B']);
      expect(() => pool.markRetryableFailure('NONEXISTENT')).not.toThrow();
      expect(pool._debugNextIndex()).toBe(0);
      expect(pool.getKey()).toBe('A');
    });
  });

  describe('circuit breaker states', () => {
    it('should circuit-break a balance-exhausted key and keep using the remaining keys', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      pool.markBalanceExhausted('A');
      expect(pool.availableCount()).toBe(2);
      expect(pool.getMetrics().keys.find((item) => item.keyPrefix === '***')?.status).toBeDefined();
      expect(pool.getKey()).toBe('B');
      expect(pool.getKey()).toBe('C');
      expect(pool.getKey()).toBe('B');
    });

    it('should throw when all keys are circuit-open', () => {
      const pool = new ApiKeyPool(['A', 'B']);
      pool.markBalanceExhausted('A');
      pool.markBalanceExhausted('B');
      expect(pool.availableCount()).toBe(0);
      expect(() => pool.getKey()).toThrow('ApiKeyPool has no usable keys');
    });

    it('should enter half-open after cooldown and recover after successful probes', () => {
      jest.useFakeTimers().setSystemTime(1000);
      const pool = new ApiKeyPool(['sk-A111', 'sk-B222'], { circuitBreakerMs: 1000, halfOpenProbeCount: 1, halfOpenSuccessThreshold: 1 });
      pool.markRateLimited('sk-A111');
      expect(pool.getMetrics().keys.find((item) => item.keyPrefix === '***A111')?.status).toBe('circuit_open');
      jest.setSystemTime(2100);
      expect(pool.getKey()).toBe('sk-B222');
      expect(pool.getKey()).toBe('sk-A111');
      expect(pool.getMetrics().keys.find((item) => item.keyPrefix === '***A111')?.status).toBe('half_open');
      pool.markSuccess('sk-A111');
      const metric = pool.getMetrics().keys.find((item) => item.keyPrefix === '***A111')!;
      expect(metric.status).toBe('available');
      expect(metric.successCount).toBe(1);
      jest.useRealTimers();
    });

    it('should reopen circuit when a half-open probe fails', () => {
      jest.useFakeTimers().setSystemTime(1000);
      const pool = new ApiKeyPool(['A'], { circuitBreakerMs: 1000, halfOpenProbeCount: 1 });
      pool.markRateLimited('A');
      jest.setSystemTime(2100);
      expect(pool.getKey()).toBe('A');
      pool.markRetryableFailure('A');
      const metric = pool.getMetrics().keys[0];
      expect(metric.status).toBe('circuit_open');
      expect(metric.circuitBreakerCount).toBe(2);
      jest.useRealTimers();
    });
  });

  describe('hasAvailableKey', () => {
    it('should return false when all keys are in cooldown', () => {
      const pool = new ApiKeyPool(['A', 'B']);
      pool.markRateLimited('A');
      pool.markRateLimited('B');
      expect(pool.hasAvailableKey()).toBe(false);
    });

    it('should return true when at least one key is available', () => {
      const pool = new ApiKeyPool(['A', 'B']);
      pool.markRateLimited('A');
      expect(pool.hasAvailableKey()).toBe(true);
    });
  });

  describe('availableCount', () => {
    it('should reflect the number of non-cooled-down keys', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      expect(pool.availableCount()).toBe(3);
      pool.markRateLimited('A');
      expect(pool.availableCount()).toBe(2);
      pool.markRateLimited('B');
      expect(pool.availableCount()).toBe(1);
      pool.markRateLimited('C');
      expect(pool.availableCount()).toBe(0);
    });
  });

  describe('size', () => {
    it('should report the number of unique keys', () => {
      expect(new ApiKeyPool(['A']).size()).toBe(1);
      expect(new ApiKeyPool(['A', 'B']).size()).toBe(2);
      expect(new ApiKeyPool(['A', 'A', 'B']).size()).toBe(2);
    });
  });

  describe('custom cooldown duration', () => {
    it('should use the configured cooldownMs', () => {
      const pool = new ApiKeyPool(['A'], 10_000);
      const before = Date.now();
      pool.markRateLimited('A');
      const entries = pool._debugEntries();
      expect(entries[0].cooldownUntil).toBeGreaterThanOrEqual(before + 10_000);
      expect(entries[0].cooldownUntil).toBeLessThanOrEqual(Date.now() + 10_000 + 100);
    });
  });

  describe('selection strategies and metrics', () => {
    it('should support weighted round-robin', () => {
      const pool = new ApiKeyPool([
        { key: 'A', weight: 2 },
        { key: 'B', weight: 1 },
      ], { strategy: 'weighted_round_robin' });
      const picks = [pool.getKey(), pool.getKey(), pool.getKey()];
      expect(picks.filter((key) => key === 'A')).toHaveLength(2);
      expect(picks.filter((key) => key === 'B')).toHaveLength(1);
    });

    it('should dynamically add, remove, disable and enable keys', () => {
      const pool = new ApiKeyPool(['A']);
      expect(pool.addKey('B')).toBe(true);
      expect(pool.size()).toBe(2);
      pool.disableKey('A');
      expect(pool.getKey()).toBe('B');
      pool.enableKey('A');
      expect(pool.availableCount()).toBe(2);
      expect(pool.removeKey('B')).toBe(true);
      expect(pool.size()).toBe(1);
    });

    it('should expose usage, success/failure rates, circuit count and last error', () => {
      const pool = new ApiKeyPool(['A'], { failureThreshold: 2 });
      expect(pool.getKey()).toBe('A');
      pool.markSuccess('A');
      expect(pool.getKey()).toBe('A');
      pool.markRetryableFailure('A', 'upstream 500');
      pool.markRetryableFailure('A', 'upstream 502');
      const metric = pool.getMetrics().keys[0];
      expect(metric.usageCount).toBe(2);
      expect(metric.successCount).toBe(1);
      expect(metric.failureCount).toBe(2);
      expect(metric.successRate).toBeCloseTo(1 / 3, 3);
      expect(metric.failureRate).toBeCloseTo(2 / 3, 3);
      expect(metric.circuitBreakerCount).toBe(1);
      expect(metric.lastError).toBe('upstream 502');
    });
  });
});
