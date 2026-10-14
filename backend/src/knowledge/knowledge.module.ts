import { ProvidersModule } from '../providers/providers.module';
import { EmbeddingService } from './retrieval/embedding.service';
import { QdrantService } from './retrieval/qdrant.service';
import { KnowledgeIndexService } from './retrieval/knowledge-index.service';
import { NativeRetrievalService } from './retrieval/native-retrieval.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { ModelServicesModule } from '../model-services/model-services.module';

@Module({
  imports: [AuthModule, ProvidersModule, ModelServicesModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EmbeddingService, QdrantService, KnowledgeIndexService, NativeRetrievalService],
  exports: [KnowledgeService, EmbeddingService, QdrantService],
})
export class KnowledgeModule {}
