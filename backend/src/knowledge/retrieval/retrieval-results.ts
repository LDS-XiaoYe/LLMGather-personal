import type { KnowledgeSearchResult } from '../knowledge.service';

/** Preserve raw scores/provenance while fusing incompatible ranked lists. */
export function fuseKnowledgeResults(groups: KnowledgeSearchResult[][], limit: number, weights: number[] = []): KnowledgeSearchResult[] {
  const entries = new Map<string, KnowledgeSearchResult>();
  groups.forEach((group, source) => {
    const seen = new Set<string>();
    group.forEach((item, index) => {
      const key = item.kbId + ':' + item.id;
      if (seen.has(key)) return;
      seen.add(key);
      const before = entries.get(key);
      const score = (before?.fusionScore || 0) + (weights[source] ?? 1) / (60 + index + 1);
      entries.set(key, {
        ...before, ...item, score, fusionScore: score, scoreType: 'rrf',
        denseScore: item.denseScore ?? before?.denseScore,
        lexicalScore: item.lexicalScore ?? before?.lexicalScore,
        externalScore: item.externalScore ?? before?.externalScore,
        ranks: { ...before?.ranks, ...item.ranks },
        sources: [...new Set([...(before?.sources || []), ...(item.sources || [])])],
      });
    });
  });
  return [...entries.values()].sort((a, b) => b.score - a.score ||
    (a.ranks?.dense ?? Infinity) - (b.ranks?.dense ?? Infinity) ||
    (a.ranks?.lexical ?? Infinity) - (b.ranks?.lexical ?? Infinity) || a.id.localeCompare(b.id)).slice(0, limit);
}

export function diversifyKnowledgeResults(rows: KnowledgeSearchResult[], limit: number): KnowledgeSearchResult[] {
  const counts = new Map<string, number>();
  return rows.filter(row => {
    const key = row.kbId + ':' + (row.documentId || row.id);
    const count = counts.get(key) || 0;
    if (count >= 3) return false;
    counts.set(key, count + 1);
    return true;
  }).slice(0, limit);
}

export function mayDegrade(error: unknown): boolean {
  const status = (error as { getStatus?: () => number; status?: number })?.getStatus?.() ?? (error as { status?: number })?.status;
  // User authorization/invalid input failures must never turn into successful retrieval.
  return !status || status === 409 || status === 429 || status >= 500;
}
