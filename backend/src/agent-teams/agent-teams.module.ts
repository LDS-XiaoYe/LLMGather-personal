import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { AgentTeamsController } from './agent-teams.controller';
import { AgentTeamsService } from './agent-teams.service';

@Module({
  imports: [AuthModule, AgentsModule],
  controllers: [AgentTeamsController],
  providers: [AgentTeamsService],
})
export class AgentTeamsModule {}
