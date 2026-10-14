import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SettingsThrottle } from '../common/settings-throttle.decorator';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SendVerificationCodeDto, TopUpDto } from './dto';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedRequestUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { VerificationCodeService } from './verification-code.service';
import { REMEMBER_LOGIN_SECONDS } from './jwt.service';
import { loginToken } from './login-session';

const COOKIE_NAME = 'token';

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
  async register(@Body() payload: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(payload, this.ip(req), req.header('user-agent') || '');
    this.setTokenCookie(res, result.accessToken);
    return result;
  }

  @Post('login')
  @SettingsThrottle('rate_limit_login')
  @UseGuards(SettingsThrottleGuard)
  async login(@Body() payload: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(payload, this.ip(req), req.header('user-agent') || '');
    this.setTokenCookie(res, result.accessToken, payload.rememberMe === true);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.me(user.id);
  }

  @Post('topup')
  @UseGuards(JwtAuthGuard, AdminGuard)
  topUp(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: TopUpDto) {
    return this.authService.topUp(user.id, payload);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Idempotent: expired/missing credentials must not prevent clearing the cookie.
    await this.authService.logout(loginToken(req));
    res.clearCookie(COOKIE_NAME, { path: '/v1' });
    return { ok: true };
  }

  @Get('invitation-code')
  @UseGuards(JwtAuthGuard)
  async getInvitationCode(@CurrentUser() user: AuthenticatedRequestUser) {
    const code = await this.authService.getInvitationCode(user.id);
    return { invitationCode: code };
  }

  private setTokenCookie(res: Response, token: string, rememberMe = false): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      ...(rememberMe ? { maxAge: REMEMBER_LOGIN_SECONDS * 1000 } : {}),
      path: '/v1',
    });
  }

  private ip(req: Request): string {
    const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
  }
}
