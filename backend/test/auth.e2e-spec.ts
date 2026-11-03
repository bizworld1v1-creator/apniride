import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { authSessionSchema, authTokensSchema, requestOtpResponseSchema, userSchema } from '@apniride/shared';
import pg from 'pg';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';

// Needs `pnpm db:up` and backend/.env. Uses a random phone number so runs don't collide.
describe('Phone OTP auth (e2e)', () => {
  let app: INestApplication<App>;
  const phone = `0300${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await runMigrations(app.get<pg.Pool>(PG_POOL), { log: () => {} });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects an invalid phone number with a code the app can translate', async () => {
    const res = await http().post('/auth/otp/request').send({ phone: '12345', role: 'passenger' }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'invalid_phone' });
  });

  it('signs up, completes the profile, refreshes and logs out', async () => {
    // 1. Request a code.
    const otpRes = await http().post('/auth/otp/request').send({ phone, role: 'passenger' }).expect(200);
    const otp = requestOtpResponseSchema.parse(otpRes.body);
    expect(otp.devCode).toMatch(/^\d{6}$/);

    // Asking again straight away is blocked, with Retry-After.
    const again = await http().post('/auth/otp/request').send({ phone, role: 'passenger' }).expect(429);
    expect(again.body.code).toBe('resend_too_soon');
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);

    // 2. Wrong code, then the right one.
    const wrong = otp.devCode === '000000' ? '111111' : '000000';
    const bad = await http().post('/auth/otp/verify').send({ phone, role: 'passenger', code: wrong }).expect(400);
    expect(bad.body.code).toBe('invalid_code');

    const verifyRes = await http()
      .post('/auth/otp/verify')
      .send({ phone, role: 'passenger', code: otp.devCode })
      .expect(200);
    const session = authSessionSchema.parse(verifyRes.body);
    expect(session.isNewUser).toBe(true);
    expect(session.user.name).toBeNull();
    // The full number never comes back.
    expect(JSON.stringify(verifyRes.body)).not.toContain(phone.slice(1));

    // 3. Protected routes.
    await http().get('/me').expect(401);
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    const named = await http().patch('/me').set(auth).send({ name: '  Ayesha Khan ' }).expect(200);
    expect(userSchema.parse(named.body).name).toBe('Ayesha Khan');
    const short = await http().patch('/me').set(auth).send({ name: 'A' }).expect(400);
    expect(short.body.code).toBe('name_too_short');

    // 4. Refresh rotates the token; the old one still works briefly (weak-network grace)...
    const r1 = authTokensSchema.parse(
      (await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200)).body,
    );
    expect(r1.refreshToken).not.toBe(session.refreshToken);
    const r2 = authTokensSchema.parse(
      (await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200)).body,
    );
    await http().get('/me').set({ Authorization: `Bearer ${r2.accessToken}` }).expect(200);

    // 5. Logout revokes the session.
    await http().post('/auth/logout').send({ refreshToken: r2.refreshToken }).expect(204);
    const after = await http().post('/auth/refresh').send({ refreshToken: r2.refreshToken }).expect(401);
    expect(after.body.code).toBe('invalid_refresh_token');
  });
});
