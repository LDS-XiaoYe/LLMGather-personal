import { Marked } from 'marked';

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function buildSessionTitle(input: string): string {
  const text = input.trim();
  if (!text) return '新对话';
  return text.length <= 22 ? text : `${text.slice(0, 22)}...`;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickTwoRandomModels<T extends { id: string }>(models: T[]): [string, string] | null {
  if (models.length < 2) return null;
  const i1 = Math.floor(Math.random() * models.length);
  let i2 = Math.floor(Math.random() * models.length);
  while (i2 === i1) { i2 = Math.floor(Math.random() * models.length); }
  return [models[i1].id, models[i2].id];
}

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = d.getTime() + 8 * 3600000;
  const nd = new Date(offset);
  return `${nd.getUTCFullYear()}-${pad(nd.getUTCMonth() + 1)}-${pad(nd.getUTCDate())} ${pad(nd.getUTCHours())}:${pad(nd.getUTCMinutes())}:${pad(nd.getUTCSeconds())}`;
}

export function getStoredValue(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

export function setStoredValue(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch {}
}

const mdRenderer = new Marked({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  return mdRenderer.parse(text) as string;
}
