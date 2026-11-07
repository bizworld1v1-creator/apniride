import type { INestApplication } from '@nestjs/common';
import { authSessionSchema } from '@apniride/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';

export const randomPhone = () => `030${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
export const toE164 = (phone: string) => `+92${phone.slice(1)}`;

/** The admin login of the e2e tests (vitest.config.e2e.ts). */
export const TEST_ADMIN = { username: 'e2e-admin', password: 'e2e-admin-password' } as const;

/** Signs in the one admin with username + password, like the admin panel does. */
export async function signInAdmin(app: INestApplication<App>) {
  const session = authSessionSchema.parse(
    (await request(app.getHttpServer()).post('/auth/admin/login').send(TEST_ADMIN).expect(200)).body,
  );
  return { id: session.user.id, auth: { Authorization: `Bearer ${session.accessToken}` }, session };
}
