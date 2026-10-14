export type RetrievalMode = 'keyword' | 'vector' | 'hybrid';
export interface RetrievalOptions {
  mode?: RetrievalMode;
  failurePolicy?: 'strict' | 'degrade';
  /** Raw cosine gate, explicitly configured by the caller; never an RRF threshold. */
  minDenseScore?: number;
  /** Internal candidate budget, prevents nested 4x expansion. */
  candidates?: number;
}
export interface RetrievalMeta {
  requestedMode: RetrievalMode;
  effectiveMode: RetrievalMode | 'mixed';
  degraded: boolean;
  warnings: { kbId?: string; stage: 'keyword' | 'vector' | 'external'; code: string }[];
  queryTerms?: string[];
  minDenseScore?: number;
}
export interface RetrievalScores {
  scoreType?: 'lexical' | 'cosine' | 'rrf' | 'external';
  lexicalScore?: number;
  denseScore?: number;
  externalScore?: number;
  fusionScore?: number;
  ranks?: { lexical?: number; dense?: number; external?: number };
  sources?: ('lexical' | 'dense' | 'external')[];
}
