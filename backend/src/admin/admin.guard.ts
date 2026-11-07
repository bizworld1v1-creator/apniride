import { type CanActivate, type ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AdminLoginService } from '../auth/admin-login.service.js';
import type { AuthedRequest } from '../auth/auth.guard.js';
import { TokensService } from '../auth/tokens.service.js';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';

/**
 * Requires an admin-panel access token (`Authorization: Bearer …`, role "admin") of the admin named by
 * ADMIN_USERNAME, signed in with the current ADMIN_PASSWORD. Checked on every request, so changing either in
 * backend/.env (or setting disabled_at) locks the old session out at once.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly adminLogin: AdminLoginService,
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
      `SELECT 1 FROM admins
       WHERE user_id = $1 AND username = $2 AND login_fingerprint = $3 AND disabled_at IS NULL`,
      [user.userId, this.adminLogin.username, this.adminLogin.fingerprint],
    );
    if (rowCount !== 1) throw notAdmin();
    req.user = user;
    return true;
  }
}

const notAdmin = () => new AppException(HttpStatus.FORBIDDEN, 'not_admin', 'Admins only');
