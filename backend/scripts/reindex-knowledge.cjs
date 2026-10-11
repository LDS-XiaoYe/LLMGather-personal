require('dotenv').config();
require('reflect-metadata');
const { DatabaseService } = require('../dist/database/database.service');
const { ProviderApiKeyStore } = require('../dist/providers/provider-api-key.store');
const { EmbeddingService } = require('../dist/knowledge/retrieval/embedding.service');
const { QdrantService } = require('../dist/knowledge/retrieval/qdrant.service');
const { KnowledgeIndexService } = require('../dist/knowledge/retrieval/knowledge-index.service');
async function main() {
  const [user, kb] = process.argv.slice(2);
  if (!user) throw Error('Usage: node scripts/reindex-knowledge.cjs USER_ID [KB_ID]');
  const db = new DatabaseService(); await db.onModuleInit();
  try {
    const providers = new ProviderApiKeyStore(db); await providers.onModuleInit();
    const indexes = new KnowledgeIndexService(db, new EmbeddingService(providers), new QdrantService());
    const bases = kb ? [{ id: kb }] : await db.connection.prepare("SELECT id FROM knowledge_bases WHERE user_id=? AND provider='native' AND deleted_at IS NULL").all(user);
    for (const base of bases) {
      const result = await indexes.migrate(user, base.id);
      console.log(JSON.stringify({ knowledgeBaseId: base.id, ...result }));
    }
  } finally { await db.onModuleDestroy(); }
}
main().catch(()=>{console.error('Knowledge reindex failed; inspect persisted index status and retry');process.exitCode=1;});
