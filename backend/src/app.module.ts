import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GatewayModule } from './gateway/gateway.module';
import { RechargeModule } from './recharge/recharge.module';
import { HealthController } from './common/health.controller';
import { ProvidersModule } from './providers/providers.module';
import { RouterModule } from './router/router.module';
import { CollabModule } from './collab/collab.module';
import { CacheModule } from './cache/cache.module';
import { AgentsModule } from './agents/agents.module';
import { AgentTeamsModule } from './agent-teams/agent-teams.module';
import { ToolsModule } from './tools/tools.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryModule } from './memory/memory.module';
import { McpModule } from './mcp/mcp.module';
import { SkillsModule } from './skills/skills.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    RedisModule,
    DatabaseModule,
    SecurityModule,
    ProvidersModule,
    AuthModule,
    ApiKeysModule,
    GatewayModule,
    AdminModule,
    RechargeModule,
    RouterModule,
    CollabModule,
    CacheModule,
    ToolsModule,
    KnowledgeModule,
    MemoryModule,
    McpModule,
    SkillsModule,
    AgentsModule,
    AgentTeamsModule,
    WorkflowsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
