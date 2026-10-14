// Keep trace additions below MySQL TEXT's byte limit, leaving space for step metadata.
// Redact values before serialization: redacting serialized JSON can break its syntax.
export function captureAgentTraceSnapshot(value: Record<string, any>, redact: (text: string) => string): Record<string, any> {
  const visit = (item: any, key = ''): any => {
    if (typeof item === 'string') return /^(api[_-]?key|token|secret|password|passwd|cookie|authorization)$/i.test(key) ? '[已脱敏]' : redact(item);
    if (Array.isArray(item)) return item.map(child => visit(child));
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([name, child]) => [name, visit(child, name)]));
    return item;
  };
  const snapshot = visit(value);
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') <= 32000) return snapshot;
  return {
    schemaVersion: snapshot.schemaVersion,
    model: String(snapshot.model || '').slice(0, 256),
    temperature: snapshot.temperature,
    max_tokens: snapshot.max_tokens,
    parameters: snapshot.parameters,
    omitted: '内容超过记录上限，未保存完整配置或请求消息',
  };
}
