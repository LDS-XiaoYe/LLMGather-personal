import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { SettingsThrottle } from '../common/settings-throttle.decorator';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SendVerificationCodeDto, TopUpDto } from './dto';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedRequestUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { VerificationCodeService } from './verification-code.service';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = Number(process.env.JWT_EXPIRES_SECONDS || 7 * 24 * 3600) * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  @Post('send-verification-code')
  @SettingsThrottle('rate_limit_register')
  @UseGuards(SettingsThrottleGuard)
  async sendVerificationCode(@Body() payload: SendVerificationCodeDto) {
    await this.verificationCodeService.sendCode(payload.email);
    return { ok: true, message: '验证码已发送' };
  }

  @Post('register')
  @SettingsThrottle('rate_limit_register')
  @UseGuards(SettingsThrottleGuard)
  async register(@Body() payload: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(payload);
    this.setTokenCookie(res, result.accessToken);
    return result;
  }

  @Post('login')
  @SettingsThrottle('rate_limit_login')
  @UseGuards(SettingsThrottleGuard)
  async login(@Body() payload: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(payload);
    this.setTokenCookie(res, result.accessToken);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.me(user.id);
  }

  @Post('topup')
  @UseGuards(JwtAuthGuard)
  topUp(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: TopUpDto) {
    return this.authService.topUp(user.id, payload);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/v1' });
    return { ok: true };
  }

  @Get('invitation-code')
  @UseGuards(JwtAuthGuard)
  async getInvitationCode(@CurrentUser() user: AuthenticatedRequestUser) {
    const code = await this.authService.getInvitationCode(user.id);
    return { invitationCode: code };
  }

  private setTokenCookie(res: Response, token: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/v1',
    });
  }
}
