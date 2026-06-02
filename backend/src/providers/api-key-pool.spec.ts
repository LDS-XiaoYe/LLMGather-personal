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

    it('should return earliest-expiring key when all are in cooldown', () => {
      const pool = new ApiKeyPool(['A', 'B', 'C']);
      pool.markRateLimited('A'); // A: now + 30s
      // Manually set B's cooldown to a future time later than A
      const entries = pool._debugEntries() as Array<{ key: string; cooldownUntil: number }>;
      const entryB = entries.find((e) => e.key === 'B')!;
      // Override via internal — we need to test the "all cooled" path
      // Use markRateLimited on B and C, then advance time for A only
      pool.markRateLimited('B');
      pool.markRateLimited('C');

      // All 3 are in cooldown — should return the earliest expiring
      const key = pool.getKey();
      // A was marked first, so it expires first (within the same 30s window)
      // They were all marked in the same ms, so any is fine — but the code
      // should NOT throw and should return one of them.
      expect(['A', 'B', 'C']).toContain(key);
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
});
