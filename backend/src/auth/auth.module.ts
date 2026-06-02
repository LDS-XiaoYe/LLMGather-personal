import { Module } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { BillingController } from '../billing/billing.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from './jwt.service';
import { UsersService } from './users.service';
import { EmailService } from './email.service';
import { VerificationCodeService } from './verification-code.service';

@Module({
  controllers: [AuthController, BillingController],
  providers: [AuthService, UsersService, JwtService, JwtAuthGuard, BillingService, EmailService, VerificationCodeService],
  exports: [UsersService, JwtService, JwtAuthGuard, BillingService],
})
export class AuthModule {}
