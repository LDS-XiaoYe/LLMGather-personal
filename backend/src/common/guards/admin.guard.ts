import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedRequestUser } from '../../auth/auth.types';

type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const role = request.user?.role || 'user';
    if (role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return true;
  }
}
