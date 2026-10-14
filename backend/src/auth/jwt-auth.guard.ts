import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from './jwt.service';
import { AuthenticatedRequestUser } from './auth.types';
import { DatabaseService } from '../database/database.service';
import { loginToken, verifyLoginSession } from './login-session';

type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const token = loginToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    request.user = await verifyLoginSession(this.jwtService, this.database, token);
    return true;
  }
}
