import { Module, forwardRef } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { ProvidersModule } from '../providers/providers.module';
import { RouterModule } from '../router/router.module';
import { RelayController } from './relay.controller';
import { TtsController } from './tts.controller';
import { MemoryModule } from '../memory/memory.module';
import { ChatMemoryContextService } from './chat-memory-context.service';

@Module({
  imports: [ProvidersModule, AuthModule, ApiKeysModule, MemoryModule, forwardRef(() => RouterModule), forwardRef(() => AgentsModule)],
  controllers: [ChatController, ModelsController, ConversationsController, RelayController, TtsController],
  providers: [ChatService, ModelsService, ConversationsService, ChatMemoryContextService],
  exports: [ChatService],
})
export class GatewayModule {}
