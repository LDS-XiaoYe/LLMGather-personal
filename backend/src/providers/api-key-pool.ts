/**
 * ApiKeyPool — thread-safe round-robin key distribution with 429 cooldown.
 *
 * Each provider feeds this pool with one or more API keys (deduplicated).
 * `getKey()` returns the next usable key, rotating deterministically via
 * `nextIndex`. Keys can be temporarily cooled down (429) or marked exhausted
 * for the current process (e.g. provider account balance is insufficient).
 * When all non-exhausted keys are in cooldown the earliest-expiring one is
 * returned as a fallback.
 *
 * Node's single-threaded event loop makes the mutable `nextIndex` and per-key
 * `cooldownUntil` safe without locks.
 */
export class ApiKeyPool {
  private readonly entries: PoolEntry[];
  private readonly cooldownMs: number;
  private nextIndex = 0;

  constructor(keys: string[], cooldownMs = 30_000) {
    this.cooldownMs = cooldownMs;
    const seen = new Set<string>();
    this.entries = [];
    for (const k of keys) {
      const trimmed = (k ?? '').trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      this.entries.push({ key: trimmed, cooldownUntil: 0, exhausted: false });
    }
    if (this.entries.length === 0) {
      throw new Error('ApiKeyPool requires at least one non-empty key');
    }
  }

  /** Return the next key that should be used, rotating round-robin. */
  getKey(): string {
    const n = this.entries.length;
    const now = Date.now();

    // Linear scan from nextIndex — pick the first non-cooled-down key.
    for (let i = 0; i < n; i++) {
      const idx = (this.nextIndex + i) % n;
      if (!this.entries[idx].exhausted && this.entries[idx].cooldownUntil <= now) {
        this.nextIndex = (idx + 1) % n;
        return this.entries[idx].key;
      }
    }

    // All keys are in cooldown — return the one that expires soonest.
    let earliestIdx = -1;
    let earliestExpiry = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (this.entries[i].exhausted) continue;
      if (this.entries[i].cooldownUntil < earliestExpiry) {
        earliestExpiry = this.entries[i].cooldownUntil;
        earliestIdx = i;
      }
    }
    if (earliestIdx === -1) {
      throw new Error('ApiKeyPool has no usable keys');
    }
    this.nextIndex = (earliestIdx + 1) % n;
    return this.entries[earliestIdx].key;
  }

  /** Return a random non-cooled-down key. Falls back to round-robin if all cooled. */
  getRandomKey(): string {
    const now = Date.now();
    const available = this.entries.filter((e) => !e.exhausted && e.cooldownUntil <= now);
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)].key;
    }
    // All in cooldown — fall back to round-robin
    return this.getKey();
  }

  /** Put a key into cooldown (e.g. after 429).  No-op if key not found. */
  markRateLimited(key: string): void {
    const entry = this.entries.find((e) => e.key === key);
    if (entry) {
      entry.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  /**
   * Signal that a key had a retryable failure (5xx / network error).
   * Does NOT set cooldown — just advances nextIndex so the next call to
   * `getKey()` prefers a different key.
   */
  markRetryableFailure(key: string): void {
    const idx = this.entries.findIndex((e) => e.key === key);
    if (idx >= 0) {
      this.nextIndex = (idx + 1) % this.entries.length;
    }
  }

  /** Mark a key as unusable for this process, e.g. provider balance exhausted. */
  markBalanceExhausted(key: string): void {
    const entry = this.entries.find((e) => e.key === key);
    if (entry) {
      entry.exhausted = true;
      this.markRetryableFailure(key);
    }
  }

  /** Whether at least one key is not in cooldown. */
  hasAvailableKey(): boolean {
    const now = Date.now();
    return this.entries.some((e) => !e.exhausted && e.cooldownUntil <= now);
  }

  /** Number of keys that are currently not in cooldown. */
  availableCount(): number {
    const now = Date.now();
    return this.entries.reduce(
      (count, e) => count + (!e.exhausted && e.cooldownUntil <= now ? 1 : 0),
      0,
    );
  }

  /** Number of keys that have not been marked balance-exhausted. */
  usableCount(): number {
    return this.entries.reduce((count, e) => count + (e.exhausted ? 0 : 1), 0);
  }

  /** Total number of unique keys in the pool. */
  size(): number {
    return this.entries.length;
  }

  /* ──────── debugging / testing ──────── */

  /**
   * @internal Expose cooldown timestamps for tests.
   * Returns a snapshot of `{ key, cooldownUntil }`.
   */
  _debugEntries(): ReadonlyArray<{ key: string; cooldownUntil: number; exhausted: boolean }> {
    return this.entries.map((e) => ({ ...e }));
  }

  /**
   * @internal Expose the current nextIndex for tests.
   */
  _debugNextIndex(): number {
    return this.nextIndex;
  }
}

interface PoolEntry {
  key: string;
  cooldownUntil: number; // epoch ms, 0 = available
  exhausted: boolean;
}
