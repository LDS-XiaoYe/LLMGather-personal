/** Convert the Agent log envelope to readable text, never HTML. */
export function formatModelRuntimeLogs(value: unknown): string {
  let body = value;
  // Also accept older endpoints which serialized their log envelope twice.
  for (let depth = 0; depth < 3; depth++) {
    if (body && typeof body === 'object' && 'logs' in body) {
      body = (body as { logs: unknown }).logs;
      continue;
    }
    if (typeof body !== 'string') break;
    const trimmed = body.trim();
    if (!trimmed.startsWith('"') && !trimmed.startsWith('{')) break;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === 'string' || (parsed && typeof parsed === 'object' && 'logs' in parsed)) body = parsed;
      else break;
    } catch { break; }
  }
  if (body === null || body === undefined) return '';
  const raw = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  // Decode genuine Unicode escapes, but preserve double-escaped literal text.
  // Do not replace arbitrary \n / \t: Windows paths may contain those sequences.
  const decoded = raw.replace(/(\\*)\\u([0-9a-f]{4})/gi, (match, slashes: string, hex: string) =>
    slashes.length % 2 ? match : slashes + String.fromCharCode(parseInt(hex, 16)));
  const text = decoded
    // OSC (terminal title/hyperlink), CSI (color/cursor), and simple ESC codes.
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trimEnd();
  // Pretty-print complete JSON records; ordinary logs and stack indentation
  // remain unchanged. Malformed/partial records are still displayed verbatim.
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return line;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : line;
    } catch { return line; }
  }).join('\n');
}
