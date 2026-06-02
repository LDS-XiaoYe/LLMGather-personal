import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RechargeController } from './recharge.controller';
import { RechargeService } from './recharge.service';
import { AlipayService } from './alipay.service';

@Module({
  imports: [AuthModule],
  controllers: [RechargeController],
  providers: [RechargeService, AlipayService],
})
export class RechargeModule {}
