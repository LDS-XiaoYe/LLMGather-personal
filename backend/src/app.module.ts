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

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    ProvidersModule,
    AuthModule,
    ApiKeysModule,
    GatewayModule,
    AdminModule,
    RechargeModule,
    RouterModule,
    CollabModule,
    CacheModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}