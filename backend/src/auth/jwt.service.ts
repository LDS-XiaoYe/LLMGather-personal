import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthTokenPayload } from './auth.types';

export const REMEMBER_LOGIN_SECONDS = 30 * 24 * 3600;

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString();
}

@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  readonly expiresInSeconds = (() => {
    const value = Number(process.env.JWT_EXPIRES_SECONDS || 7 * 24 * 3600);
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, REMEMBER_LOGIN_SECONDS) : 7 * 24 * 3600;
  })();

  constructor() {
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || this.secret.length < 32 || this.secret === 'dev-jwt-secret-change-me')) throw new Error('Production JWT_SECRET must contain at least 32 characters');
  }

  sign(userId: string, username: string, role = 'user', version = 0, options: { rememberMe?: boolean; sessionId?: string } = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
      sub: userId,
      version,
      username,
      role,
      iat: now,
      exp: now + (options.rememberMe === true ? REMEMBER_LOGIN_SECONDS : this.expiresInSeconds),
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    };

    const headerEncoded = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = this.signRaw(`${headerEncoded}.${payloadEncoded}`);
    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  verify(token: string): AuthTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expected = this.signRaw(`${headerEncoded}.${payloadEncoded}`);

    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: AuthTokenPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadEncoded)) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.sub !== 'string' || !payload.sub || typeof payload.username !== 'string' || !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.iat > now + 60) throw new UnauthorizedException('Invalid token payload');
    if (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version < 0)) throw new UnauthorizedException('Invalid token version');
    if (payload.sessionId !== undefined && (typeof payload.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(payload.sessionId))) throw new UnauthorizedException('Invalid token session');
    if (payload.exp <= now) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }

  private signRaw(data: string): string {
    return createHmac('sha256', this.secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
