import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ProvidersModule } from '../providers/providers.module';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';

@Module({
  imports: [ProvidersModule, GatewayModule, AuthModule, ApiKeysModule],
  controllers: [CollabController],
  providers: [CollabService],
})
export class CollabModule {}
