import { Module, forwardRef } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { BillingService } from '../billing/billing.service';
import { DatabaseModule } from '../database/database.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ProvidersModule } from '../providers/providers.module';
import { RouterController } from './router.controller';
import { RouterService } from './router.service';

@Module({
  imports: [DatabaseModule, ProvidersModule, AuthModule, ApiKeysModule, forwardRef(() => GatewayModule)],
  controllers: [RouterController],
  providers: [RouterService, BillingService],
  exports: [RouterService],
})
export class RouterModule {}
