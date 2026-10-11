import { MysqlCheckpointer } from './runtime/mysql-checkpointer';
import { WorkflowRuntimeService } from './runtime/workflow-runtime.service';
import { ProvidersModule } from '../providers/providers.module';

import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryModule } from '../memory/memory.module';
import { SkillsModule } from '../skills/skills.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [ProvidersModule, AuthModule, forwardRef(() => AgentsModule), ToolsModule, KnowledgeModule, MemoryModule, SkillsModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, MysqlCheckpointer, WorkflowRuntimeService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
