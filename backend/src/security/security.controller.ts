import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CaptchaService } from './captcha.service';
import { ChallengeService } from './challenge.service';
import { RiskService } from './risk.service';
import { RiskCheckInput } from './security.types';

@Controller('security')
export class SecurityController {
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly captchaService: CaptchaService,
    private readonly riskService: RiskService,
  ) {}

  @Get('challenge')
  async challenge(@Req() request: Request) {
    const data = await this.challengeService.create(this.ip(request), request.header('user-agent') || '');
    return { data };
  }

  @Post('risk-check')
  async riskCheck(@Req() request: Request, @Body() payload: RiskCheckInput) {
    const data = await this.riskService.check(this.ip(request), request.header('user-agent') || '', payload, false);
    return { data };
  }

  @Get('captcha')
  async captcha() {
    const data = await this.captchaService.create();
    return { data };
  }

  @Post('captcha/verify')
  async verifyCaptcha(@Body() payload: { captchaId: string; captchaCode: string }) {
    const ok = await this.captchaService.verify(payload.captchaId, payload.captchaCode);
    return { data: { ok } };
  }

  private ip(request: Request): string {
    const forwarded = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || request.ip || request.socket.remoteAddress || 'unknown';
  }
}
