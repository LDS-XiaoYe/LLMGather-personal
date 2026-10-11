import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgentClient } from './agent.client';
import { ModelServicesService } from './model-services.service';
import { ManagedEmbeddingService } from './managed-embedding.service';
import { ModelServicesController } from './model-services.controller';
@Module({imports:[AuthModule],providers:[AgentClient,ModelServicesService,ManagedEmbeddingService],controllers:[ModelServicesController],exports:[ModelServicesService,ManagedEmbeddingService]})
export class ModelServicesModule {}
