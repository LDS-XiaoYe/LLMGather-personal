import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from './jwt.service';
import { AuthenticatedRequestUser } from './auth.types';

type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // 1. Try Authorization: Bearer header
    const authHeader = request.header('authorization') ?? '';
    let token = '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice('bearer '.length).trim();
    }

    // 2. Fallback: HttpOnly cookie
    if (!token && request.cookies?.token) {
      token = request.cookies.token as string;
    }

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const payload = this.jwtService.verify(token);
    request.user = { id: payload.sub, username: payload.username, role: payload.role || 'user' };
    return true;
  }
}
