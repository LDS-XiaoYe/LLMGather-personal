import { seal, unseal, traceText } from './persistence-codec';
describe('checkpoint codec', () => {
  beforeAll(() => {
    process.env.CHECKPOINT_ENCRYPTION_KEY = 'unit-test-key-only-at-least-32-characters';
  });
  it('encrypts snapshots and detects tampering', () => {
    const sealed = seal({ key: 'secret', count: 3 });
    expect(sealed).not.toContain('secret');
    expect(unseal(sealed)).toEqual({ key: 'secret', count: 3 });
    const bytes = Buffer.from(sealed, 'base64');
    bytes[30] ^= 1;
    expect(() => unseal(bytes.toString('base64'))).toThrow();
  });
  it('redacts API keys and credentials in business traces', () => {
    const result = traceText('token=abc password=xyz sk-abcdefghijklmnop');
    expect(result).not.toContain('abc');
    expect(result).not.toContain('xyz');
    expect(result).not.toContain('sk-');
  });
});
