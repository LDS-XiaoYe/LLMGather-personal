import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { LangGraphMemoryProvider } from './providers/langgraph-memory.provider';
import { NativeMemoryProvider } from './providers/native-memory.provider';

@Module({
  imports: [AuthModule],
  controllers: [MemoryController],
  providers: [MemoryService, NativeMemoryProvider, LangGraphMemoryProvider],
  exports: [MemoryService],
})
export class MemoryModule {}
