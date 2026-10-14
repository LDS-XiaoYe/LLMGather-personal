import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { NativeMemoryProvider } from './providers/native-memory.provider';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ModelServicesModule } from '../model-services/model-services.module';
import { MemoryIndexService } from './memory-index.service';

@Module({
  imports: [AuthModule, KnowledgeModule, ModelServicesModule],
  controllers: [MemoryController],
  providers: [MemoryService, NativeMemoryProvider, MemoryIndexService],
  exports: [MemoryService],
})
export class MemoryModule {}
