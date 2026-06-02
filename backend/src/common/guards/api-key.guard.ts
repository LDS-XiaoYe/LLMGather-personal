import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { API_KEY_HEADER } from '../constants';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requirePlatformApiKey = process.env.REQUIRE_PLATFORM_API_KEY === 'true';
    if (!requirePlatformApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const expectedKey = process.env.PLATFORM_API_KEY;

    if (!expectedKey) {
      throw new UnauthorizedException('Server misconfigured: missing PLATFORM_API_KEY');
    }

    const keyFromHeader = request.header(API_KEY_HEADER) ?? '';
    const authHeader = request.header('authorization') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length)
      : '';

    const candidate = keyFromHeader || bearer;

    if (!candidate || candidate !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
