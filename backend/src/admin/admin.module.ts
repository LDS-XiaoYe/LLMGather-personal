import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { DatabaseModule } from '../database/database.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BailianModelsService } from './bailian-models.service';

@Module({
  imports: [AuthModule, ProvidersModule, DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService, BailianModelsService],
  exports: [AdminService],
})
export class AdminModule {}
