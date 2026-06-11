/**
 * ApiKeyPool — API key load balancing with circuit breaker state.
 *
 * Node.js executes the synchronous mutations below on a single event loop, so
 * each selection/state transition is atomic within one process. Providers call
 * markSuccess/mark*Failure after each upstream attempt to drive the circuit
 * breaker and metrics.
 */
export type ApiKeyPoolStrategy = 'round_robin' | 'random' | 'weighted_round_robin';
export type ApiKeyStatus = 'available' | 'circuit_open' | 'half_open' | 'disabled';
export type ApiKeyFailureReason =
  | 'rate_limit'
  | 'balance_exhausted'
  | 'auth_failed'
  | 'retryable_failure'
  | 'network'
  | 'manual'
  | 'unknown';

export interface ApiKeyPoolInput {
  key: string;
  id?: string | null;
  name?: string | null;
  keyPrefix?: string | null;
  source?: 'db' | 'env';
  weight?: number;
  disabled?: boolean;
}

export interface ApiKeyPoolOptions {
  strategy?: ApiKeyPoolStrategy;
  cooldownMs?: number;
  circuitBreakerMs?: number;
  failureThreshold?: number;
  halfOpenProbeCount?: number;
  halfOpenSuccessThreshold?: number;
  defaultWeight?: number;
}

export interface ApiKeyPoolDescriptor {
  id: string | null;
  name: string;
  keyPrefix: string;
  source: 'db' | 'env';
}

export interface ApiKeyPoolMetrics extends ApiKeyPoolDescriptor {
  status: ApiKeyStatus;
  weight: number;
  usageCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureRate: number;
  consecutiveFailures: number;
  circuitBreakerCount: number;
  halfOpenProbeInFlight: number;
  halfOpenSuccesses: number;
  circuitOpenUntil: number;
  lastUsedAt: number;
  lastStatusChangeAt: number;
  lastError: string;
  lastFailureReason: ApiKeyFailureReason | '';
}

export interface ApiKeyPoolSnapshot {
  strategy: ApiKeyPoolStrategy;
  size: number;
  availableCount: number;
  halfOpenCount: number;
  circuitOpenCount: number;
  disabledCount: number;
  keys: ApiKeyPoolMetrics[];
}

export class ApiKeyPool {
  private readonly entries: PoolEntry[] = [];
  private readonly options: Required<ApiKeyPoolOptions>;
  private nextIndex = 0;

  constructor(keys: Array<string | ApiKeyPoolInput>, cooldownOrOptions: number | ApiKeyPoolOptions = 30_000) {
    this.options = this.normalizeOptions(cooldownOrOptions);
    for (const item of keys) {
      this.addKey(item);
    }
    if (this.entries.length === 0) {
      throw new Error('ApiKeyPool requires at least one non-empty key');
    }
  }

  getKey(strategy: ApiKeyPoolStrategy = this.options.strategy): string {
    const entry = this.selectEntry(strategy);
    if (!entry) throw new Error('ApiKeyPool has no usable keys');
    this.recordSelected(entry);
    return entry.key;
  }

  getRandomKey(): string {
    return this.getKey('random');
  }

  markSuccess(key: string): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    entry.metrics.successCount += 1;
    entry.metrics.lastError = '';
    entry.metrics.lastFailureReason = '';
    entry.consecutiveFailures = 0;
    if (entry.status === 'half_open') {
      entry.halfOpenProbeInFlight = Math.max(0, entry.halfOpenProbeInFlight - 1);
      entry.halfOpenSuccesses += 1;
      if (entry.halfOpenSuccesses >= this.options.halfOpenSuccessThreshold) {
        this.setStatus(entry, 'available');
        entry.circuitOpenUntil = 0;
        entry.halfOpenProbeInFlight = 0;
        entry.halfOpenSuccesses = 0;
      }
    } else if (entry.status === 'circuit_open' && entry.circuitOpenUntil <= Date.now()) {
      this.setStatus(entry, 'available');
      entry.circuitOpenUntil = 0;
    }
  }

  markRateLimited(key: string, error = 'rate limited'): void {
    this.openCircuit(key, 'rate_limit', error);
  }

  markBalanceExhausted(key: string, error = 'balance exhausted'): void {
    this.openCircuit(key, 'balance_exhausted', error);
  }

  markAuthenticationFailure(key: string, error = 'authentication failed'): void {
    this.openCircuit(key, 'auth_failed', error);
  }

  markRetryableFailure(key: string, error = 'retryable failure'): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    this.recordFailure(entry, 'retryable_failure', error);
    this.advancePast(entry);
    if (entry.status === 'half_open' || entry.consecutiveFailures >= this.options.failureThreshold) {
      this.openCircuitEntry(entry, 'retryable_failure', error);
    }
  }

  markNetworkFailure(key: string, error = 'network failure'): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    this.recordFailure(entry, 'network', error);
    this.advancePast(entry);
    if (entry.status === 'half_open' || entry.consecutiveFailures >= this.options.failureThreshold) {
      this.openCircuitEntry(entry, 'network', error);
    }
  }

  disableKey(key: string, error = 'disabled manually'): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    entry.metrics.lastError = error;
    entry.metrics.lastFailureReason = 'manual';
    this.setStatus(entry, 'disabled');
    this.advancePast(entry);
  }

  enableKey(key: string): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    entry.consecutiveFailures = 0;
    entry.circuitOpenUntil = 0;
    entry.halfOpenProbeInFlight = 0;
    entry.halfOpenSuccesses = 0;
    entry.metrics.lastError = '';
    entry.metrics.lastFailureReason = '';
    this.setStatus(entry, 'available');
  }

  addKey(item: string | ApiKeyPoolInput): boolean {
    const normalized = this.normalizeInput(item);
    if (!normalized) return false;
    if (this.entries.some((entry) => entry.key === normalized.key)) return false;
    const now = Date.now();
    this.entries.push({
      ...normalized,
      status: normalized.disabled ? 'disabled' : 'available',
      circuitOpenUntil: 0,
      consecutiveFailures: 0,
      halfOpenProbeInFlight: 0,
      halfOpenSuccesses: 0,
      currentWeight: 0,
      metrics: {
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        circuitBreakerCount: 0,
        lastUsedAt: 0,
        lastStatusChangeAt: now,
        lastError: '',
        lastFailureReason: '',
      },
    });
    return true;
  }

  removeKey(key: string): boolean {
    const idx = this.entries.findIndex((entry) => entry.key === key);
    if (idx < 0) return false;
    this.entries.splice(idx, 1);
    this.nextIndex = this.entries.length ? this.nextIndex % this.entries.length : 0;
    return true;
  }

  describeKey(key: string): ApiKeyPoolDescriptor {
    const entry = this.findEntry(key);
    return entry?.descriptor ?? {
      id: null,
      name: '未知 Key',
      keyPrefix: maskKey(key),
      source: 'env',
    };
  }

  getMetrics(): ApiKeyPoolSnapshot {
    this.refreshStates();
    return {
      strategy: this.options.strategy,
      size: this.size(),
      availableCount: this.availableCount(),
      halfOpenCount: this.countByStatus('half_open'),
      circuitOpenCount: this.countByStatus('circuit_open'),
      disabledCount: this.countByStatus('disabled'),
      keys: this.entries.map((entry) => this.metricsFor(entry)),
    };
  }

  hasAvailableKey(): boolean {
    return this.selectableEntries().length > 0;
  }

  availableCount(): number {
    return this.selectableEntries().length;
  }

  usableCount(): number {
    this.refreshStates();
    return this.entries.reduce((count, entry) => count + (entry.status === 'disabled' ? 0 : 1), 0);
  }

  size(): number {
    return this.entries.length;
  }

  _debugEntries(): ReadonlyArray<ApiKeyPoolMetrics & { key: string; cooldownUntil: number; exhausted: boolean }> {
    this.refreshStates();
    return this.entries.map((entry) => ({
      key: entry.key,
      cooldownUntil: entry.circuitOpenUntil,
      exhausted: entry.status === 'disabled' || entry.status === 'circuit_open',
      ...this.metricsFor(entry),
    }));
  }

  _debugNextIndex(): number {
    return this.nextIndex;
  }

  private selectEntry(strategy: ApiKeyPoolStrategy): PoolEntry | null {
    const candidates = this.selectableEntries();
    if (candidates.length === 0) return null;
    if (strategy === 'random') {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (strategy === 'weighted_round_robin') {
      return this.selectWeightedRoundRobin(candidates);
    }
    return this.selectRoundRobin(candidates);
  }

  private selectRoundRobin(candidates: PoolEntry[]): PoolEntry {
    const n = this.entries.length;
    for (let i = 0; i < n; i += 1) {
      const idx = (this.nextIndex + i) % n;
      const entry = this.entries[idx];
      if (candidates.includes(entry)) {
        this.nextIndex = (idx + 1) % n;
        return entry;
      }
    }
    return candidates[0];
  }

  private selectWeightedRoundRobin(candidates: PoolEntry[]): PoolEntry {
    let totalWeight = 0;
    let best = candidates[0];
    for (const entry of candidates) {
      const weight = Math.max(1, entry.weight);
      totalWeight += weight;
      entry.currentWeight += weight;
      if (entry.currentWeight > best.currentWeight) best = entry;
    }
    best.currentWeight -= totalWeight;
    this.advancePast(best);
    return best;
  }

  private selectableEntries(): PoolEntry[] {
    this.refreshStates();
    return this.entries.filter((entry) => {
      if (entry.status === 'available') return true;
      if (entry.status === 'half_open') {
        return entry.halfOpenProbeInFlight < this.options.halfOpenProbeCount;
      }
      return false;
    });
  }

  private recordSelected(entry: PoolEntry): void {
    entry.metrics.usageCount += 1;
    entry.metrics.lastUsedAt = Date.now();
    if (entry.status === 'half_open') {
      entry.halfOpenProbeInFlight += 1;
    }
  }

  private openCircuit(key: string, reason: ApiKeyFailureReason, error: string): void {
    const entry = this.findEntry(key);
    if (!entry) return;
    this.recordFailure(entry, reason, error);
    this.openCircuitEntry(entry, reason, error);
  }

  private openCircuitEntry(entry: PoolEntry, reason: ApiKeyFailureReason, error: string): void {
    entry.circuitOpenUntil = Date.now() + this.options.circuitBreakerMs;
    entry.consecutiveFailures = 0;
    entry.halfOpenProbeInFlight = 0;
    entry.halfOpenSuccesses = 0;
    entry.metrics.circuitBreakerCount += 1;
    entry.metrics.lastError = error;
    entry.metrics.lastFailureReason = reason;
    this.setStatus(entry, 'circuit_open');
    this.advancePast(entry);
  }

  private recordFailure(entry: PoolEntry, reason: ApiKeyFailureReason, error: string): void {
    entry.metrics.failureCount += 1;
    entry.metrics.lastError = error;
    entry.metrics.lastFailureReason = reason;
    entry.consecutiveFailures += 1;
    if (entry.status === 'half_open') {
      entry.halfOpenProbeInFlight = Math.max(0, entry.halfOpenProbeInFlight - 1);
    }
  }

  private refreshStates(): void {
    const now = Date.now();
    for (const entry of this.entries) {
      if (entry.status === 'circuit_open' && entry.circuitOpenUntil <= now) {
        entry.halfOpenProbeInFlight = 0;
        entry.halfOpenSuccesses = 0;
        this.setStatus(entry, 'half_open');
      }
    }
  }

  private setStatus(entry: PoolEntry, status: ApiKeyStatus): void {
    if (entry.status !== status) {
      entry.status = status;
      entry.metrics.lastStatusChangeAt = Date.now();
    }
  }

  private advancePast(entry: PoolEntry): void {
    const idx = this.entries.indexOf(entry);
    if (idx >= 0 && this.entries.length > 0) {
      this.nextIndex = (idx + 1) % this.entries.length;
    }
  }

  private findEntry(key: string): PoolEntry | undefined {
    return this.entries.find((entry) => entry.key === key);
  }

  private countByStatus(status: ApiKeyStatus): number {
    this.refreshStates();
    return this.entries.filter((entry) => entry.status === status).length;
  }

  private metricsFor(entry: PoolEntry): ApiKeyPoolMetrics {
    const attempts = entry.metrics.successCount + entry.metrics.failureCount;
    return {
      ...entry.descriptor,
      status: entry.status,
      weight: entry.weight,
      usageCount: entry.metrics.usageCount,
      successCount: entry.metrics.successCount,
      failureCount: entry.metrics.failureCount,
      successRate: attempts ? Number((entry.metrics.successCount / attempts).toFixed(4)) : 0,
      failureRate: attempts ? Number((entry.metrics.failureCount / attempts).toFixed(4)) : 0,
      consecutiveFailures: entry.consecutiveFailures,
      circuitBreakerCount: entry.metrics.circuitBreakerCount,
      halfOpenProbeInFlight: entry.halfOpenProbeInFlight,
      halfOpenSuccesses: entry.halfOpenSuccesses,
      circuitOpenUntil: entry.circuitOpenUntil,
      lastUsedAt: entry.metrics.lastUsedAt,
      lastStatusChangeAt: entry.metrics.lastStatusChangeAt,
      lastError: entry.metrics.lastError,
      lastFailureReason: entry.metrics.lastFailureReason,
    };
  }

  private normalizeInput(item: string | ApiKeyPoolInput): NormalizedInput | null {
    const rawKey = typeof item === 'string' ? item : item.key;
    const key = (rawKey ?? '').trim();
    if (!key) return null;
    const source = typeof item === 'string' ? 'env' : item.source ?? 'db';
    const descriptor = typeof item === 'string'
      ? { id: null, name: '环境变量 Key', keyPrefix: maskKey(key), source: 'env' as const }
      : {
          id: item.id ?? null,
          name: item.name || (source === 'env' ? '环境变量 Key' : 'Provider Key'),
          keyPrefix: item.keyPrefix || maskKey(key),
          source,
        };
    return {
      key,
      descriptor,
      weight: Math.max(1, Number(typeof item === 'string' ? this.options.defaultWeight : item.weight ?? this.options.defaultWeight) || 1),
      disabled: typeof item === 'string' ? false : item.disabled === true,
    };
  }

  private normalizeOptions(cooldownOrOptions: number | ApiKeyPoolOptions): Required<ApiKeyPoolOptions> {
    const raw = typeof cooldownOrOptions === 'number'
      ? { cooldownMs: cooldownOrOptions, circuitBreakerMs: cooldownOrOptions }
      : cooldownOrOptions;
    const circuitBreakerMs = Number(raw.circuitBreakerMs ?? raw.cooldownMs ?? 30_000);
    return {
      strategy: raw.strategy ?? 'round_robin',
      cooldownMs: Number(raw.cooldownMs ?? circuitBreakerMs),
      circuitBreakerMs: Number.isFinite(circuitBreakerMs) && circuitBreakerMs > 0 ? circuitBreakerMs : 30_000,
      failureThreshold: Math.max(1, Number(raw.failureThreshold ?? 3) || 3),
      halfOpenProbeCount: Math.max(1, Number(raw.halfOpenProbeCount ?? 1) || 1),
      halfOpenSuccessThreshold: Math.max(1, Number(raw.halfOpenSuccessThreshold ?? raw.halfOpenProbeCount ?? 1) || 1),
      defaultWeight: Math.max(1, Number(raw.defaultWeight ?? 1) || 1),
    };
  }
}

interface NormalizedInput {
  key: string;
  descriptor: ApiKeyPoolDescriptor;
  weight: number;
  disabled: boolean;
}

interface PoolEntry extends NormalizedInput {
  status: ApiKeyStatus;
  circuitOpenUntil: number;
  consecutiveFailures: number;
  halfOpenProbeInFlight: number;
  halfOpenSuccesses: number;
  currentWeight: number;
  metrics: {
    usageCount: number;
    successCount: number;
    failureCount: number;
    circuitBreakerCount: number;
    lastUsedAt: number;
    lastStatusChangeAt: number;
    lastError: string;
    lastFailureReason: ApiKeyFailureReason | '';
  };
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return '***';
  return `***${key.slice(-4)}`;
}
