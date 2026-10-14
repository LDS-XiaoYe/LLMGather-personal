import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto, RegisterDto, TopUpDto } from './dto';
import { AuthUser } from './auth.types';
import { JwtService } from './jwt.service';
import { UsersService } from './users.service';
import { VerificationCodeService } from './verification-code.service';
import { RiskService } from '../security/risk.service';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { tokenHash } from './login-session';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly riskService: RiskService,
    private readonly database: DatabaseService,
  ) {}

  async register(payload: RegisterDto, ip = 'unknown', userAgent = ''): Promise<{ accessToken: string; user: AuthUser }> {
    if (payload.tosAccepted !== true) {
      throw new BadRequestException('注册前请先同意服务条款和个人信息保护政策');
    }
    const risk = await this.riskService.check(ip, userAgent, {
      challengeId: payload.challengeId || '',
      behaviorPayload: payload.behaviorPayload,
      captchaId: payload.captchaId,
      captchaCode: payload.captchaCode,
    }, true);
    if (risk.captchaRequired && !risk.allowed) {
      throw new BadRequestException({ message: '需要图形验证码', captchaRequired: true, riskScore: risk.riskScore });
    }
    // Verify the email verification code
    const isValid = await this.verificationCodeService.verifyCode(payload.email, payload.verificationCode);
    if (!isValid) {
      await this.riskService.recordFailure(ip);
      throw new BadRequestException('验证码无效或已过期');
    }

    let invitedBy: string | undefined;
    if (payload.invitationCode) {
      const inviterId = await this.usersService.getUserIdByInvitationCode(payload.invitationCode);
      if (inviterId) {
        invitedBy = inviterId;
      }
    }
    const user = await this.usersService.createUser(payload.username, payload.password, payload.email, invitedBy);
    await this.riskService.clearFailures(ip);
    const accessToken = await this.issueSession(user);
    return { accessToken, user };
  }

  async login(payload: LoginDto, ip = 'unknown', userAgent = ''): Promise<{ accessToken: string; user: AuthUser }> {
    const risk = await this.riskService.check(ip, userAgent, {
      challengeId: payload.challengeId || '',
      behaviorPayload: payload.behaviorPayload,
      captchaId: payload.captchaId,
      captchaCode: payload.captchaCode,
    }, true);
    if (risk.captchaRequired && !risk.allowed) {
      throw new BadRequestException({ message: '需要图形验证码', captchaRequired: true, riskScore: risk.riskScore });
    }
    const user = await this.usersService.validateUser(payload.username, payload.password);
    if (!user) {
      await this.riskService.recordFailure(ip);
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.riskService.clearFailures(ip);
    const accessToken = await this.issueSession(user, payload.rememberMe === true, Number(user.authVersion ?? 0));
    return { accessToken, user: await this.usersService.getPublicById(user.id) };
  }

  async me(userId: string): Promise<AuthUser> {
    return this.usersService.getPublicById(userId);
  }

  private async issueSession(user: AuthUser, rememberMe = false, version = 0): Promise<string> {
    const id = randomUUID();
    const token = this.jwtService.sign(user.id, user.username, user.role, version, { rememberMe, sessionId: id });
    const expiresAt = this.jwtService.verify(token).exp * 1000;
    await this.database.connection.prepare('DELETE FROM auth_login_sessions WHERE expires_at <= ? LIMIT 1000').run(Date.now());
    await this.database.connection.prepare('INSERT INTO auth_login_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)').run(id, user.id, tokenHash(token), expiresAt);
    return token;
  }

  async logout(token: string): Promise<void> {
    if (!token) return;
    let payload;
    try { payload = this.jwtService.verify(token); }
    catch (error) { if (error instanceof UnauthorizedException) return; throw error; }
    if (payload.sessionId) {
      await this.database.connection.prepare('DELETE FROM auth_login_sessions WHERE id=? AND token_hash=?').run(payload.sessionId, tokenHash(token));
    }
  }

  async topUp(userId: string, payload: TopUpDto): Promise<AuthUser> {
    return this.usersService.topUpCredits(userId, payload.amount);
  }

  async getInvitationCode(userId: string): Promise<string | null> {
    return this.usersService.getInvitationCodeByUserId(userId);
  }
}
