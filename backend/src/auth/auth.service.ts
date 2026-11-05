import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type AppMode, type AuthSession, maskPhone, type UserRole } from '@apniride/shared';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { assertNotBusy } from '../common/assert-not-busy.js';
import { PG_POOL } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';
import { OtpService } from './otp.service.js';
import { type AuthUser, TokensService } from './tokens.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
  ) {}

  /** Checks the code, signs up the number if it is new for this app, and opens a session. */
  async verifyOtp(phone: string, role: UserRole, code: string): Promise<AuthSession> {
    await this.otp.verify(phone, role, code);
    if (role === 'admin') return this.adminSession(phone);

    const client = await this.pool.connect();
    let user: { id: string; name: string | null };
    let isNewUser: boolean;
    try {
      await client.query('BEGIN');
      // DO UPDATE (a no-op) instead of DO NOTHING so RETURNING also gives back an existing row.
      const { rows } = await client.query<{ id: string; name: string | null }>(
        `INSERT INTO users (phone) VALUES ($1)
         ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
         RETURNING id, name`,
        [phone],
      );
      user = rows[0]!;
      // "New user" means first sign-in to this app (a passenger can later become a driver).
      const roleInsert = await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, role],
      );
      isNewUser = roleInsert.rowCount === 1;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const tokens = await this.tokens.createSession(user.id, role);
    return {
      ...tokens,
      isNewUser,
      user: { id: user.id, role, name: user.name, phoneMasked: maskPhone(phone) },
    };
  }

  /**
   * Passenger ↔ driver mode in the one mobile app, without a new OTP (the phone number was already verified).
   * Ends the current session and opens one for the other mode, so every route keeps checking a single role.
   */
  async switchRole(me: AuthUser, role: AppMode, refreshToken: string): Promise<AuthSession> {
    if (me.role === 'admin') {
      throw new AppException(HttpStatus.FORBIDDEN, 'wrong_app', 'Admin sessions cannot switch mode');
    }
    if (me.role === role) throw new AppException(HttpStatus.BAD_REQUEST, 'same_role', `Already in ${role} mode`);
    // The refresh token proves this is the device that owns the session (an access token alone is not enough).
    if (!(await this.tokens.sessionHasRefreshToken(me.sessionId, refreshToken))) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'invalid_refresh_token', 'Please sign in again');
    }
    // A driver must not vanish from dispatch by switching (going offline is a deliberate step), and nobody
    // switches in the middle of a ride.
    await assertNotBusy(this.pool, this.redis, me.userId);

    const roleInsert = await this.pool.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [me.userId, role],
    );
    const { rows } = await this.pool.query<{ name: string | null; phone: string }>(
      'SELECT name, phone FROM users WHERE id = $1',
      [me.userId],
    );
    const user = rows[0];
    if (!user) throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Account not found');

    const tokens = await this.tokens.createSession(me.userId, role);
    await this.tokens.revokeSession(me.sessionId);
    return {
      ...tokens,
      // First time in this mode, e.g. a passenger who opens driver mode to register.
      isNewUser: roleInsert.rowCount === 1,
      user: { id: me.userId, role, name: user.name, phoneMasked: maskPhone(user.phone) },
    };
  }

  /** The user id if this number belongs to an admin who isn't disabled. */
  async activeAdminId(phone: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT u.id FROM users u JOIN admins a ON a.user_id = u.id WHERE u.phone = $1 AND a.disabled_at IS NULL`,
      [phone],
    );
    return rows[0]?.id ?? null;
  }

  /** Admins are never created by signing in: the number must already be on the admin list. */
  private async adminSession(phone: string): Promise<AuthSession> {
    const id = await this.activeAdminId(phone);
    // Disabled between requesting and entering the code. Same error as a wrong code.
    if (!id) throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_code', 'Wrong code');
    const { rows } = await this.pool.query<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [id]);
    const tokens = await this.tokens.createSession(id, 'admin');
    return {
      ...tokens,
      isNewUser: false,
      user: { id, role: 'admin', name: rows[0]?.name ?? null, phoneMasked: maskPhone(phone) },
    };
  }
}
