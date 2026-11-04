import type { INestApplication } from '@nestjs/common';
import { authSessionSchema, requestOtpResponseSchema } from '@apniride/shared';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PG_POOL } from '../src/database/database.module.js';

export const randomPhone = () => `030${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
export const toE164 = (phone: string) => `+92${phone.slice(1)}`;

/** Admins created by this test run. The tests share the dev database, so they must not stay admins. */
const created = new Set<string>();

/** Takes every test admin off the admin list. Call in afterAll. */
export async function removeTestAdmins(app: INestApplication<App>): Promise<void> {
  if (created.size === 0) return;
  await app.get<pg.Pool>(PG_POOL).query('DELETE FROM admins WHERE user_id = ANY($1)', [[...created]]);
  created.clear();
}

/** Puts a number on the admin list, like `pnpm admins add`. */
export async function addAdmin(app: INestApplication<App>, phone: string, name = 'Test Admin'): Promise<string> {
  const pool = app.get<pg.Pool>(PG_POOL);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, name) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [toE164(phone), name],
  );
  await pool.query('INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET disabled_at = NULL', [
    rows[0]!.id,
  ]);
  created.add(rows[0]!.id);
  return rows[0]!.id;
}

/** A new admin, signed in through phone OTP like the admin panel does. */
export async function signInAdmin(app: INestApplication<App>, name = 'Test Admin') {
  const phone = randomPhone();
  const id = await addAdmin(app, phone, name);
  const http = request(app.getHttpServer());
  const otp = requestOtpResponseSchema.parse(
    (await http.post('/auth/otp/request').send({ phone, role: 'admin' }).expect(200)).body,
  );
  const session = authSessionSchema.parse(
    (await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone, role: 'admin', code: otp.devCode }).expect(200))
      .body,
  );
  return { id, phone, auth: { Authorization: `Bearer ${session.accessToken}` }, session };
}
