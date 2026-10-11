import type { KnowledgeBase, KnowledgeSearchResult } from '../knowledge.service';
import type { RetrievalMode, RetrievalProvider } from './native-retrieval.service';
import { reciprocalRankFusion } from './rrf';

/** Adapter around the existing dataset API; no Qdrant migration is applied to RAGFlow. */
export class RagflowRetrievalProvider implements RetrievalProvider {
  constructor(
    private readonly bases: KnowledgeBase[],
    private readonly retrieve: (base: KnowledgeBase, query: string, limit: number) => Promise<KnowledgeSearchResult[]>,
  ) {}
  async search(
    user: string,
    kbIds: string[],
    query: string,
    limit: number,
    _mode: RetrievalMode,
  ): Promise<KnowledgeSearchResult[]> {
    const groups: KnowledgeSearchResult[][] = [];
    for (const id of kbIds) {
      const base = this.bases.find((kb) => kb.id === id && kb.userId === user && kb.provider === 'ragflow');
      if (!base) throw new Error('Unauthorized RAGFlow knowledge base');
      groups.push(await this.retrieve(base, query, limit));
    }
    return reciprocalRankFusion(groups, limit, (item) => item.kbId + ':' + item.id);
  }
}
