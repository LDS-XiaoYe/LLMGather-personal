import type { KnowledgeBase, KnowledgeSearchResult } from '../knowledge.service';
import type { RetrievalMode, RetrievalProvider } from './native-retrieval.service';
import { fuseKnowledgeResults } from './retrieval-results';
import { ForbiddenException } from '@nestjs/common';

/** Adapter around the existing dataset API; no Qdrant migration is applied to RAGFlow. */
export class RagflowRetrievalProvider implements RetrievalProvider {
  constructor(
    private readonly bases: KnowledgeBase[],
    private readonly retrieve: (base: KnowledgeBase, query: string, limit: number, mode: RetrievalMode) => Promise<KnowledgeSearchResult[]>,
  ) {}
  async search(
    user: string,
    kbIds: string[],
    query: string,
    limit: number,
    mode: RetrievalMode,
  ): Promise<KnowledgeSearchResult[]> {
    const groups: KnowledgeSearchResult[][] = [];
    for (const id of kbIds) {
      const base = this.bases.find((kb) => kb.id === id && kb.userId === user && kb.provider === 'ragflow');
      if (!base) throw new ForbiddenException('Unauthorized RAGFlow knowledge base');
      groups.push(await this.retrieve(base, query, limit, mode));
    }
    return groups.length === 1 ? groups[0].slice(0, limit) : fuseKnowledgeResults(groups, limit);
  }
}
