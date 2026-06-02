import { UnauthorizedException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedRequestUser } from './auth.types';

type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Current user unavailable in request');
    }
    return request.user;
  },
);
