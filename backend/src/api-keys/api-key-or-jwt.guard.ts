import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { Request } from 'express';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyOrJwtGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization || '';

    // Bearer token
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // 1) sk-xxx → API Key 认证
    if (token.startsWith('sk-')) {
      const userId = await this.apiKeysService.validateKey(token);
      if (!userId) throw new UnauthorizedException('无效的 API Key');
      (request as any).user = { id: userId, username: '' };
      return true;
    }

    // 2) JWT token → JWT 认证
    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        (request as any).user = { id: payload.sub, username: payload.username };
        return true;
      } catch {
        throw new UnauthorizedException('Token 无效或已过期');
      }
    }

    throw new UnauthorizedException('请提供 API Key 或登录 Token');
  }
}
