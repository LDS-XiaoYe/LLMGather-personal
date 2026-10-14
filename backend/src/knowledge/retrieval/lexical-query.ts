const stop = new Set(('how what why when where which who do does did is are was were a an the i me my we you your for to of in on can could would should please and or vs versus ' +
  '如何 怎么 怎样 什么 为什么 请问 请 我 我们 你 的 了 是 吗 呢 可以 能 能否 是否 一个 一下 进行 关于').split(/\s+/));
export interface LexicalQuery { terms: string[]; entities: string[]; booleanQuery: string; entityPattern?: string }
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function exactTermPattern(term: string): string {
  return /^[\p{Script=Han}]+$/u.test(term) ? escapeRegex(term) : `(^|[^a-z0-9_])${escapeRegex(term)}($|[^a-z0-9_+#])`;
}
export function analyzeLexicalQuery(query: string): LexicalQuery {
  const text = normalize(query.trim());
  const ascii = text.match(/[a-z0-9_]+(?:[.+#-][a-z0-9_+#]+)*[+#]*/g) || [];
  // Short Latin identifiers need an exact route: ngram stopwords can erase AI/SQL.
  const uniqueEntities = [...new Set(ascii.filter(t => !stop.has(t) && (/[0-9+#._-]/.test(t) || t.length <= 3)))];
  const entities = uniqueEntities.length > 48 ? [...uniqueEntities.slice(0, 24), ...uniqueEntities.slice(-24)] : uniqueEntities;
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  const chinese = [...segmenter.segment(text)].filter(t => t.isWordLike && /^[\p{Script=Han}]+$/u.test(t.segment)).map(t => t.segment);
  // Entities receive the budget first, even when they occur at the end of a long query.
  const terms = [...new Set([...entities, ...chinese, ...ascii])].filter(t => !stop.has(t) && (t.length >= 2 || entities.includes(t))).slice(0, 48);
  return { terms, entities, booleanQuery: terms.map(t => `"${t}"`).join(' '),
    entityPattern: entities.length ? entities.map(exactTermPattern).join('|') : undefined };
}
export function rankLexicalRows<T extends { id: string; kbId: string; documentId: string; title: string; content: string; fulltextScore?: number }>(rows: T[], analysis: LexicalQuery) {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = row.kbId + ':' + row.id, previous = unique.get(key);
    if (!previous || Number(row.fulltextScore || 0) > Number(previous.fulltextScore || 0)) unique.set(key, row);
  }
  return [...unique.values()].flatMap(row => {
    const body = normalize(row.content), title = normalize(row.title);
    const matches = (term: string, text: string) => new RegExp(exactTermPattern(term), 'u').test(text);
    // Exact entity OR allows comparisons (C++ vs C#), without matching E1040 for E104.
    if (analysis.entities.length && !analysis.entities.some(term => matches(term, body + ' ' + title))) return [];
    const weighted = (text: string) => analysis.terms.reduce((sum, term) => sum + (matches(term, text) ? (analysis.entities.includes(term) ? 3 : 1) : 0), 0);
    const bodyScore = weighted(body), titleScore = weighted(title);
    if (!bodyScore && !titleScore) return [];
    const fulltext = Math.max(0, Number(row.fulltextScore) || 0);
    const lexicalScore = bodyScore * 4 + titleScore * 0.4 + 0.3 * fulltext / (1 + fulltext);
    return [{ ...row, score: lexicalScore, lexicalScore, scoreType: 'lexical' as const, sources: ['lexical' as const] }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((row, index) => ({ ...row, ranks: { lexical: index + 1 } }));
}
