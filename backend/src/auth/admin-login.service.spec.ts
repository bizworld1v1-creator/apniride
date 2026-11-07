import type { ConfigService } from '@nestjs/config';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import { ADMIN_LOGIN_LIMITS, AdminLoginService } from './admin-login.service.js';
import type { TokensService } from './tokens.service.js';

/** Just enough of ioredis for the fail counter. */
class FakeRedis {
  strings = new Map<string, string>();
  async get(key: string) {
    return this.strings.get(key) ?? null;
  }
  async incr(key: string) {
    const n = Number(this.strings.get(key) ?? 0) + 1;
    this.strings.set(key, String(n));
    return n;
  }
  async expire() {
    return 1;
  }
  async ttl() {
    return 600;
  }
}

/** A pool whose client answers the sign-in transaction (admin already exists). */
function fakePool() {
  const client = {
    query: async (sql: string) => (sql.startsWith('SELECT user_id') ? { rows: [{ user_id: 'admin-id' }] } : { rows: [] }),
    release: () => {},
  };
  return { connect: async () => client } as unknown as pg.Pool;
}

const tokens = {
  createSession: async () => ({ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900 }),
} as unknown as TokensService;

function service(values: Partial<Record<keyof Env, unknown>>) {
  const all = { JWT_SECRET: 'x'.repeat(32), ADMIN_USERNAME: 'admin', ...values };
  const config = { get: (k: keyof Env) => all[k] } as unknown as ConfigService<Env, true>;
  return new AdminLoginService(fakePool(), new FakeRedis() as never, tokens, config);
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
}

describe('AdminLoginService', () => {
  it('signs in with the right username and password', async () => {
    const s = service({ ADMIN_PASSWORD: 'secret-password' });
    const session = await s.login('admin', 'secret-password', '1.2.3.4');
    expect(session.user).toMatchObject({ id: 'admin-id', role: 'admin' });
  });

  it('refuses a wrong password or username', async () => {
    const s = service({ ADMIN_PASSWORD: 'secret-password' });
    await expectCode(s.login('admin', 'secret-passwor', '1.2.3.4'), 'invalid_login');
    await expectCode(s.login('Admin', 'secret-password', '1.2.3.4'), 'invalid_login');
  });

  it('is off when no password is set', async () => {
    await expectCode(service({}).login('admin', 'anything', '1.2.3.4'), 'admin_login_off');
  });

  it('locks an IP out after too many wrong tries, even with the right password', async () => {
    const s = service({ ADMIN_PASSWORD: 'secret-password' });
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFails; i++) {
      await expectCode(s.login('admin', 'nope', '1.2.3.4'), 'invalid_login');
    }
    await expectCode(s.login('admin', 'secret-password', '1.2.3.4'), 'rate_limited');
    // Another IP is not affected.
    await s.login('admin', 'secret-password', '5.6.7.8');
  });

  it('a new password gives a new fingerprint (signs the old session out)', () => {
    expect(service({ ADMIN_PASSWORD: 'password-one' }).fingerprint).not.toBe(
      service({ ADMIN_PASSWORD: 'password-two' }).fingerprint,
    );
  });
});
