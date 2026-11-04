import { type CanActivate, type ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AuthedRequest } from '../auth/auth.guard.js';
import { TokensService } from '../auth/tokens.service.js';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';

/**
 * Requires an admin-panel access token (`Authorization: Bearer …`, signed in with role "admin") from an admin
 * who is still enabled. Checked on every request, so disabling an admin locks them out at once.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    @Inject(PG_POOL) private readonly pool: pg.Pool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Missing access token');
    }
    const user = await this.tokens.verifyAccessToken(token);
    if (user.role !== 'admin') throw notAdmin();
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM admins WHERE user_id = $1 AND disabled_at IS NULL',
      [user.userId],
    );
    if (rowCount !== 1) throw notAdmin();
    req.user = user;
    return true;
  }
}

const notAdmin = () => new AppException(HttpStatus.FORBIDDEN, 'not_admin', 'Admins only');
