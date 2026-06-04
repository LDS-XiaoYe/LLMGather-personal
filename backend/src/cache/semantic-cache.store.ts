/**
 * Lightweight semantic cache store using Jaccard similarity + Levenshtein distance.
 * Zero external dependencies — pure TypeScript.
 */

export interface CacheEntry {
  id: string;
  queryHash: string;
  queryText: string;
  model: string;
  response: string;
  tokensSaved: number;
  costSaved: number;
  hitCount: number;
  createdAt: string;
  lastHitAt: string;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'down',
  'it', 'its', 'this', 'that', 'these', 'those', '我', '你', '他', '她',
  '它', '们', '的', '了', '在', '是', '有', '和', '就', '不', '人', '都',
  '一', '一个', '上', '也', '很', '到', '说', '要', '去', '会', '着',
  '没有', '看', '好', '自己', '这', '那', '吗', '呢', '吧', '啊',
]);

function normalize(text: string | null | undefined): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\w一-鿿\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

/** Jaccard similarity between two sets */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Composite similarity score */
export function similarityScore(query1: string | null | undefined, query2: string | null | undefined): number {
  const tokens1 = normalize(query1);
  const tokens2 = normalize(query2);

  const jaccard = jaccardSimilarity(tokens1, tokens2);

  // Normalize strings for edit distance comparison
  const n1 = normalize(query1).join(' ');
  const n2 = normalize(query2).join(' ');
  const maxLen = Math.max(n1.length, n2.length, 1);
  const editSim = 1 - levenshtein(n1, n2) / maxLen;

  // Weighted combination: 60% Jaccard + 40% normalized edit
  return jaccard * 0.6 + editSim * 0.4;
}

/** Simple hash for DB lookup */
export function queryHash(text: string | null | undefined): string {
  let hash = 0;
  const norm = normalize(text).join(' ');
  for (let i = 0; i < norm.length; i++) {
    const ch = norm.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const SIMILARITY_THRESHOLD = 0.85;
