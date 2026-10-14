import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { Request } from 'express';
import { ApiKeysService } from './api-keys.service';
import { DatabaseService } from '../database/database.service';
import { loginToken, verifyLoginSession } from '../auth/login-session';

@Injectable()
export class ApiKeyOrJwtGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtService: JwtService,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = loginToken(request);

    // 1) sk-xxx → API Key 认证
    if (token.startsWith('sk-')) {
      const apiUser = await this.apiKeysService.validateKey(token);
      if (!apiUser) throw new UnauthorizedException('无效的 API Key');
      (request as any).user = { id: apiUser.userId, username: apiUser.username, role: apiUser.role || 'user' };
      return true;
    }

    // 2) JWT token → JWT 认证
    if (token) {
      try {
        (request as any).user = await verifyLoginSession(this.jwtService, this.database, token);
        return true;
      } catch {
        throw new UnauthorizedException('Token 无效或已过期');
      }
    }

    throw new UnauthorizedException('请提供 API Key 或登录 Token');
  }
}
