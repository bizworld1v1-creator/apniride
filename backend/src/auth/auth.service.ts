import { Inject, Injectable } from '@nestjs/common';
import { type AuthSession, maskPhone, type UserRole } from '@apniride/shared';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import { OtpService } from './otp.service.js';
import { TokensService } from './tokens.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
  ) {}

  /** Checks the code, signs up the number if it is new for this app, and opens a session. */
  async verifyOtp(phone: string, role: UserRole, code: string): Promise<AuthSession> {
    await this.otp.verify(phone, role, code);

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
}
