import { Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { ChallengeService } from './challenge.service';
import { RiskService } from './risk.service';
import { SecurityController } from './security.controller';

@Module({
  controllers: [SecurityController],
  providers: [ChallengeService, CaptchaService, RiskService],
  exports: [ChallengeService, CaptchaService, RiskService],
})
export class SecurityModule {}
