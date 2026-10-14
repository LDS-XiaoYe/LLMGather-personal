import { migrateKnowledgeLexical } from './knowledge-lexical';
describe('knowledge ngram index migration', () => {
  it('replaces the plain parser once and adds the title index', async () => {
    const exec = jest.fn(async (_sql: string) => undefined);
    const db = { exec, prepare: (sql: string) => ({ get: async () => ({ 'Create Table': sql.endsWith('knowledge_chunks') ?
      'FULLTEXT KEY `ft_kb_chunks_content` (`content`)' : 'CREATE TABLE knowledge_documents' }) }) };
    await migrateKnowledgeLexical(db as never);
    expect(exec.mock.calls.map(c => String(c[0]))).toEqual([
      'ALTER TABLE knowledge_chunks DROP INDEX ft_kb_chunks_content',
      'ALTER TABLE knowledge_chunks ADD FULLTEXT INDEX ft_kb_chunks_content (content) WITH PARSER ngram',
      'ALTER TABLE knowledge_documents ADD FULLTEXT INDEX ft_kb_docs_title_ngram (title) WITH PARSER ngram',
    ]);
  });
  it('leaves ngram indexes intact on later startups', async () => {
    const exec = jest.fn();
    const db = { exec, prepare: (sql: string) => ({ get: async () => ({ 'Create Table': sql.endsWith('knowledge_chunks') ?
      'FULLTEXT KEY `ft_kb_chunks_content` (`content`) /*!50100 WITH PARSER `ngram` */' :
      'FULLTEXT KEY `ft_kb_docs_title_ngram` (`title`) /*!50100 WITH PARSER `ngram` */' }) }) };
    await migrateKnowledgeLexical(db as never); expect(exec).not.toHaveBeenCalled();
  });
});
