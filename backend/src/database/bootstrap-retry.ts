/** Log only machine codes: driver messages can contain credentials, SQL and values. */
export function bootstrapErrorCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'BOOTSTRAP_FAILED';
}

export function bootstrapInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`[Database] Invalid ${name}; expected integer ${min}..${max}`);
  }
  return value;
}

const transientCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN',
  'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ER_SERVER_SHUTDOWN']);

export async function retryMysqlConnection<T>(
  connect: () => Promise<T>, attempts: number, delayMs: number,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await connect(); }
    catch (error) {
      const code = bootstrapErrorCode(error);
      console.error(`[Database] connection attempt ${attempt}/${attempts} failed (${code})`);
      if (attempt === attempts || !transientCodes.has(code)) {
        throw new Error(`[Database] MySQL connection failed (${code}); check connection configuration and database health`);
      }
      await sleep(delayMs);
    }
  }
  throw new Error('[Database] Invalid connection retry count');
}
