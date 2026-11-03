import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthTokens, UserRole } from '@apniride/shared';
import { jwtVerify, SignJWT } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import { PG_POOL } from '../database/database.module.js';

/** 1 hour: short enough to limit a leaked token, long enough to avoid constant refreshes on 3G. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 60;
/** After rotation the previous refresh token still works this long (lost responses on weak networks). */
export const ROTATION_GRACE_SECONDS = 120;

const ISSUER = 'apniride';

export interface AuthUser {
  userId: string;
  role: UserRole;
  sessionId: string;
}

const sha256 = (token: string) => createHash('sha256').update(token).digest();

@Injectable()
export class TokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    config: ConfigService<Env, true>,
  ) {
    this.key = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }));
  }

  /** Starts a new session (one per device sign-in) and returns its first token pair. */
  async createSession(userId: string, role: UserRole): Promise<AuthTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO auth_sessions (user_id, role, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4))
       RETURNING id`,
      [userId, role, sha256(refreshToken), REFRESH_TOKEN_TTL_DAYS],
    );
    return this.issue({ userId, role, sessionId: rows[0]!.id }, refreshToken);
  }

  /** Swaps a refresh token for a new pair (rotation). */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const hash = sha256(refreshToken);
    const next = randomBytes(32).toString('base64url');
    // Accept the current token, or the previous one within the grace window.
    // Rotating from the previous token keeps prev_refresh_token_hash as-is, so the
    // grace window can't be extended forever by replaying an old token.
    const { rows } = await this.pool.query<{ id: string; user_id: string; role: UserRole }>(
      `UPDATE auth_sessions
          SET prev_refresh_token_hash = CASE WHEN refresh_token_hash = $1 THEN $1 ELSE prev_refresh_token_hash END,
              rotated_at = CASE WHEN refresh_token_hash = $1 THEN now() ELSE rotated_at END,
              refresh_token_hash = $2,
              last_used_at = now()
        WHERE revoked_at IS NULL
          AND expires_at > now()
          AND (refresh_token_hash = $1
               OR (prev_refresh_token_hash = $1 AND rotated_at > now() - make_interval(secs => $3)))
        RETURNING id, user_id, role`,
      [hash, sha256(next), ROTATION_GRACE_SECONDS],
    );
    const row = rows[0];
    if (!row) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'invalid_refresh_token', 'Please sign in again');
    }
    return this.issue({ userId: row.user_id, role: row.role, sessionId: row.id }, next);
  }

  /** Signs out one device. Unknown tokens are ignored (logout is idempotent). */
  async revoke(refreshToken: string): Promise<void> {
    const hash = sha256(refreshToken);
    await this.pool.query(
      `UPDATE auth_sessions SET revoked_at = now()
        WHERE revoked_at IS NULL AND (refresh_token_hash = $1 OR prev_refresh_token_hash = $1)`,
      [hash],
    );
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      const role = payload.role;
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || (role !== 'passenger' && role !== 'driver')) {
        throw new Error('bad claims');
      }
      return { userId: payload.sub, role, sessionId: payload.sid };
    } catch {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Invalid or expired access token');
    }
  }

  private async issue(user: AuthUser, refreshToken: string): Promise<AuthTokens> {
    const accessToken = await new SignJWT({ role: user.role, sid: user.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
    return { accessToken, refreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }
}
