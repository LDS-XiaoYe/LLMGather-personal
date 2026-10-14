import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedRequestUser } from '../../auth/auth.types';
import { DatabaseService } from '../../database/database.service';

type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const row = request.user?.id ? await this.database.connection.prepare('SELECT role FROM users WHERE id=?').get(request.user.id) : undefined;
    const role = row?.role || 'user';
    if (role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    request.user!.role = 'admin';
    return true;
  }
}
