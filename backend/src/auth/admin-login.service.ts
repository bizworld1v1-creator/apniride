import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthSession } from '@apniride/shared';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import { PG_POOL } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';
import { TokensService } from './tokens.service.js';

export const ADMIN_LOGIN_LIMITS = {
  /** Wrong username/password tries per client IP … */
  maxFails: 10,
  /** … per this many seconds. */
  windowSeconds: 15 * 60,
} as const;

const sha256 = (s: string) => createHash('sha256').update(s).digest();
/** Constant-time string compare (hashing first makes the lengths equal). */
const same = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

/**
 * The one admin of the admin panel signs in with ADMIN_USERNAME + ADMIN_PASSWORD from backend/.env.
 * No phone OTP, no commands: the admin row is created on the first sign-in.
 */
@Injectable()
export class AdminLoginService {
  readonly username: string;
  private readonly password: string | undefined;
  /** Stored on the admin row at sign-in; the admin guard compares it, so a new password signs the admin out. */
  readonly fingerprint: string;

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly tokens: TokensService,
    config: ConfigService<Env, true>,
  ) {
    this.username = config.get('ADMIN_USERNAME', { infer: true });
    this.password = config.get('ADMIN_PASSWORD', { infer: true });
    this.fingerprint = createHmac('sha256', config.get('JWT_SECRET', { infer: true }))
      .update(`admin-login\0${this.username}\0${this.password ?? ''}`)
      .digest('hex');
  }

  async login(username: string, password: string, ip: string): Promise<AuthSession> {
    if (!this.password) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'admin_login_off',
        'Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env, then restart the backend',
      );
    }
    const failKey = `admin-login:fails:${ip}`;
    const fails = Number((await this.redis.get(failKey)) ?? 0);
    if (fails >= ADMIN_LOGIN_LIMITS.maxFails) {
      const t = await this.redis.ttl(failKey);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limited',
        'Too many wrong tries, try again later',
        t > 0 ? t : ADMIN_LOGIN_LIMITS.windowSeconds,
      );
    }
    // Both compared every time (no early exit), so timing doesn't tell which one was wrong.
    const userOk = same(username, this.username);
    const passOk = same(password, this.password);
    if (!userOk || !passOk) {
      if ((await this.redis.incr(failKey)) === 1) await this.redis.expire(failKey, ADMIN_LOGIN_LIMITS.windowSeconds);
      throw new AppException(HttpStatus.UNAUTHORIZED, 'invalid_login', 'Wrong username or password');
    }

    const id = await this.upsertAdmin();
    const tokens = await this.tokens.createSession(id, 'admin');
    return { ...tokens, isNewUser: false, user: { id, role: 'admin', name: 'Admin', phoneMasked: '' } };
  }

  /** The admin row for ADMIN_USERNAME (created on first sign-in, with a user row that has no phone). */
  private async upsertAdmin(): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialises two first sign-ins at the same moment (only one creates the admin).
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('admin-login'))`);
      const found = await client.query<{ user_id: string }>('SELECT user_id FROM admins WHERE username = $1', [
        this.username,
      ]);
      let id = found.rows[0]?.user_id;
      if (!id) {
        const user = await client.query<{ id: string }>(`INSERT INTO users (name) VALUES ('Admin') RETURNING id`);
        id = user.rows[0]!.id;
        await client.query('INSERT INTO admins (user_id, username) VALUES ($1, $2)', [id, this.username]);
      }
      await client.query('UPDATE admins SET login_fingerprint = $2 WHERE user_id = $1', [id, this.fingerprint]);
      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
