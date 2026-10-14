import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser = require('cookie-parser');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService, REMEMBER_LOGIN_SECONDS } from './jwt.service';
import { UsersService } from './users.service';
import { VerificationCodeService } from './verification-code.service';
import { RiskService } from '../security/risk.service';
import { DatabaseService } from '../database/database.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';

@Controller('fixture-gateway')
class GatewayProbe {
  @Get() @UseGuards(ApiKeyOrJwtGuard) get() { return { ok: true }; }
}

describe('login memory HTTP flow', () => {
  let app: INestApplication, base: string, jwt: JwtService;
  let version = 0;
  const sessions = new Map<string, { user_id: string; token_hash: string; expires_at: number }>();
  const user = { id: 'fixture-user', username: 'fixture', role: 'user', email: null, credits: 0, totalSpent: 0, createdAt: '2026-10-12' };
  const db = { connection: { prepare: (sql: string) => ({
    get: async (id: string) => sql.includes('FROM auth_login_sessions') ? sessions.get(id) : { ...user, auth_version: version },
    run: async (...args: any[]) => {
      if (sql.startsWith('INSERT INTO auth_login_sessions')) sessions.set(args[0], { user_id: args[1], token_hash: args[2], expires_at: args[3] });
      if (sql.startsWith('DELETE FROM auth_login_sessions WHERE id=') && sessions.get(args[0])?.token_hash === args[1]) sessions.delete(args[0]);
      if (sql.includes('expires_at <= ?')) for (const [id, session] of sessions) if (session.expires_at <= args[0]) sessions.delete(id);
      return { changes: 1 };
    },
  }) } };
  async function start() {
    const module = await Test.createTestingModule({ controllers: [AuthController, GatewayProbe], providers: [
      AuthService, JwtService,
      { provide: DatabaseService, useValue: db },
      { provide: UsersService, useValue: { validateUser: async () => ({ ...user, authVersion: version }), getPublicById: async () => user } },
      { provide: VerificationCodeService, useValue: {} },
      { provide: ApiKeysService, useValue: { validateKey: async () => null } },
      { provide: RiskService, useValue: { check: async () => ({ allowed: true }), clearFailures: async () => {} } },
    ] }).overrideGuard(SettingsThrottleGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('v1'); app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1'); base = await app.getUrl(); jwt = module.get(JwtService);
  }
  beforeAll(start);
  afterAll(async () => { await app?.close(); });
  afterEach(() => { jest.restoreAllMocks(); version = 0; });
  async function login(rememberMe?: unknown) {
    return fetch(base + '/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'fixture', password: 'fixture-password', ...(rememberMe === undefined ? {} : { rememberMe }) }) });
  }
  async function credentials(rememberMe?: boolean) {
    const res = await login(rememberMe); expect(res.status).toBe(201);
    const body = await res.json(); return { token: body.accessToken as string, cookie: res.headers.get('set-cookie')! };
  }
  it('issues matching 30-day JWT and HttpOnly persistent cookie; both authentication paths accept cookie-only requests', async () => {
    const { token, cookie } = await credentials(true), payload = jwt.verify(token);
    expect(payload.exp - payload.iat).toBe(REMEMBER_LOGIN_SECONDS);
    expect(cookie).toContain('Max-Age=2592000'); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Path=/v1');
    expect(cookie).toMatch(/SameSite=(Lax|Strict)/);
    expect(sessions.get(payload.sessionId!)?.token_hash).toHaveLength(64);
    expect(sessions.get(payload.sessionId!)?.token_hash).not.toBe(token);
    for (const route of ['/auth/me', '/fixture-gateway']) expect((await fetch(base + '/v1' + route, { headers: { Cookie: cookie.split(';')[0] } })).status).toBe(200);
  });
  it('unchecked or omitted remember flag creates a session cookie, and malformed flags are rejected', async () => {
    for (const flag of [false, undefined]) {
      const { token, cookie } = await credentials(flag);
      expect(cookie).not.toMatch(/Max-Age|Expires/);
      expect(jwt.verify(token).exp - jwt.verify(token).iat).toBe(jwt.expiresInSeconds);
    }
    expect((await login('true')).status).toBe(400);
  });
  it('logout revokes only the current session and blocks cookie and Bearer replay on both guards', async () => {
    const first = await credentials(true), other = await credentials(true);
    const res = await fetch(base + '/v1/auth/logout', { method: 'POST', headers: { Cookie: first.cookie.split(';')[0] } });
    expect(res.status).toBe(201); expect(res.headers.get('set-cookie')).toContain('1970');
    for (const headers of [{ Cookie: first.cookie.split(';')[0] }, { Authorization: 'Bearer ' + first.token }]) {
      for (const route of ['/auth/me', '/fixture-gateway']) expect((await fetch(base + '/v1' + route, { headers })).status).toBe(401);
    }
    expect((await fetch(base + '/v1/auth/me', { headers: { Cookie: other.cookie.split(';')[0] } })).status).toBe(200);
  });
  it('password reset and 30-day expiry invalidate remembered login', async () => {
    const { token, cookie } = await credentials(true);
    version = 1;
    expect((await fetch(base + '/v1/auth/me', { headers: { Cookie: cookie.split(';')[0] } })).status).toBe(401);
    version = 0;
    jest.spyOn(Date, 'now').mockReturnValue((jwt.verify(token).exp + 1) * 1000);
    expect((await fetch(base + '/v1/auth/me', { headers: { Cookie: cookie.split(';')[0] } })).status).toBe(401);
    expect((await fetch(base + '/v1/auth/logout', { method: 'POST', headers: { Cookie: cookie.split(';')[0] } })).status).toBe(201);
  });
  it('service recreation reuses persistent session rows; anonymous logout remains idempotent', async () => {
    const { cookie } = await credentials(true);
    await app.close(); await start();
    expect((await fetch(base + '/v1/auth/me', { headers: { Cookie: cookie.split(';')[0] } })).status).toBe(200);
    expect((await fetch(base + '/v1/auth/logout', { method: 'POST' })).status).toBe(201);
  });
});
