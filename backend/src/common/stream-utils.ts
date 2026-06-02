export function extractContentDelta(rawChunk: string): string {
  const events = rawChunk.split(/\r?\n\r?\n/);
  let text = '';

  for (const event of events) {
    const lines = event.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    for (const line of lines) {
      const data = line.slice('data:'.length).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        text += json.choices?.[0]?.delta?.content ?? '';
      } catch {
        continue;
      }
    }
  }

  return text;
}
