/** Rank fusion is independent of provider score scales. Deduplication uses stable IDs. */
export function reciprocalRankFusion<T extends { id: string }>(
  groups: T[][],
  limit: number,
  key: (item: T) => string = (item) => item.id,
): Array<T & { score: number }> {
  const fused = new Map<string, { item: T; score: number }>();
  for (const group of groups) {
    const seen = new Set<string>();
    group.forEach((item, index) => {
      const id = key(item);
      if (seen.has(id)) return;
      seen.add(id);
      const entry = fused.get(id) || { item, score: 0 };
      entry.score += 1 / (60 + index + 1);
      fused.set(id, entry);
    });
  }
  return [...fused.entries()]
    .sort(([idA, a], [idB, b]) => b.score - a.score || idA.localeCompare(idB))
    .slice(0, limit)
    .map(([, value]) => ({ ...value.item, score: value.score }));
}
