import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { GatewayModule } from '../gateway/gateway.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryModule } from '../memory/memory.module';
import { SkillsModule } from '../skills/skills.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentAccessController } from './agent-access.controller';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [AuthModule, ApiKeysModule, GatewayModule, ToolsModule, KnowledgeModule, MemoryModule, SkillsModule],
  controllers: [AgentsController, AgentAccessController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
