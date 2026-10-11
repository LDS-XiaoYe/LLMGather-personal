import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key(): Buffer {
  const value = process.env.CHECKPOINT_ENCRYPTION_KEY || '';
  if (value.length < 32) throw new Error('CHECKPOINT_ENCRYPTION_KEY must contain at least 32 characters');
  return createHash('sha256').update(value).digest();
}
/** Includes workflow definitions, checkpoints and execution results; never plain JSON in SQL. */
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function unseal<T>(value: string): T {
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as T;
}
export function traceText(value: string): string {
  return value
    .replace(/(sk-[\w-]{16,})/g, '[REDACTED]')
    .replace(/(authorization["']?\s*[:=]\s*["']?)(?:Bearer|Basic)\s+[^\r\n,"']+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|authorization|token|password|secret)["']?\s*[:=]\s*)(["'])(.*?)\2/gi, '$1"[REDACTED]"')
    .replace(/((?:api[_-]?key|authorization|token|password|secret)["']?\s*[:=]\s*)["']?[^\s,;\n"}]+/gi, '$1[REDACTED]')
    .slice(0, 16000);
}
