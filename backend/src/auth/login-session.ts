import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedRequestUser } from './auth.types';
import { JwtService } from './jwt.service';

export function loginToken(req: Request): string {
  const header = req.header('authorization') ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  return bearer || (typeof req.cookies?.token === 'string' ? req.cookies.token : '');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Both ordinary endpoints and the OpenAI-compatible gateway enforce revocation. */
export async function verifyLoginSession(jwt: JwtService, db: DatabaseService, token: string): Promise<AuthenticatedRequestUser> {
  const payload = jwt.verify(token);
  if (payload.sessionId) {
    const session = await db.connection.prepare('SELECT user_id,token_hash,expires_at FROM auth_login_sessions WHERE id=?').get(payload.sessionId);
    if (!session || session.user_id !== payload.sub || session.token_hash !== tokenHash(token) || Number(session.expires_at) <= Date.now()) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
  }
  const user = await db.connection.prepare('SELECT id,username,role,auth_version FROM users WHERE id=?').get(payload.sub);
  if (!user) throw new UnauthorizedException('账户已不存在，请重新登录');
  if ((payload.version ?? 0) !== Number(user.auth_version)) throw new UnauthorizedException('登录状态已失效，请重新登录');
  return { id: String(user.id), username: String(user.username), role: String(user.role || 'user') };
}
