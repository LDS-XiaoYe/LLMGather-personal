import type { IDatabaseAdapter } from '../database.adapter.interface';

/** Replace the parser at bootstrap; retry also repairs an interrupted DROP/ADD. */
export async function migrateKnowledgeLexical(db: IDatabaseAdapter): Promise<void> {
  for (const [table, index, column] of [
    ['knowledge_chunks', 'ft_kb_chunks_content', 'content'],
    ['knowledge_documents', 'ft_kb_docs_title_ngram', 'title'],
  ]) {
    const row = await db.prepare(`SHOW CREATE TABLE ${table}`).get();
    const definition = String(row?.['Create Table'] || '');
    if (!definition) throw new Error('Knowledge lexical schema inspection failed');
    const line = definition.split('\n').find(line => line.includes('KEY `' + index + '`'));
    if (line?.includes('PARSER `ngram`')) continue;
    if (line && (!line.includes('FULLTEXT') || !line.includes('(`' + column + '`)')))
      throw new Error('Knowledge lexical index definition mismatch');
    // MySQL 8 can retain the old parser when DROP/ADD reuse one index name in one ALTER.
    if (line) await db.exec(`ALTER TABLE ${table} DROP INDEX ${index}`);
    await db.exec(`ALTER TABLE ${table} ADD FULLTEXT INDEX ${index} (${column}) WITH PARSER ngram`);
  }
}
