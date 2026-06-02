import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto, RegisterDto, TopUpDto } from './dto';
import { AuthUser } from './auth.types';
import { JwtService } from './jwt.service';
import { UsersService } from './users.service';
import { VerificationCodeService } from './verification-code.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  async register(payload: RegisterDto): Promise<{ accessToken: string; user: AuthUser }> {
    // Verify the email verification code
    const isValid = await this.verificationCodeService.verifyCode(payload.email, payload.verificationCode);
    if (!isValid) {
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
    const accessToken = this.jwtService.sign(user.id, user.username, user.role);
    return { accessToken, user };
  }

  async login(payload: LoginDto): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.usersService.validateUser(payload.username, payload.password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const accessToken = this.jwtService.sign(user.id, user.username, user.role);
    return { accessToken, user: await this.usersService.getPublicById(user.id) };
  }

  async me(userId: string): Promise<AuthUser> {
    return this.usersService.getPublicById(userId);
  }

  async topUp(userId: string, payload: TopUpDto): Promise<AuthUser> {
    return this.usersService.topUpCredits(userId, payload.amount);
  }

  async getInvitationCode(userId: string): Promise<string | null> {
    return this.usersService.getInvitationCodeByUserId(userId);
  }
}
