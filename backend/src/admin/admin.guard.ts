import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Temporary admin auth: `X-Admin-Key: <ADMIN_API_KEY>`. Replace with admin accounts (sign-in, roles,
 * audit log) when the admin panel is built. With ADMIN_API_KEY unset the admin API doesn't exist (404).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly key: Buffer | null;

  constructor(config: ConfigService<Env, true>) {
    const key = config.get('ADMIN_API_KEY', { infer: true });
    this.key = key ? digest(key) : null;
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.key) throw new AppException(HttpStatus.NOT_FOUND, 'not_found', 'Not found');
    const header = ctx.switchToHttp().getRequest<Request>().headers['x-admin-key'];
    // Compare hashes in constant time, so response timing can't reveal the key.
    if (typeof header !== 'string' || !timingSafeEqual(digest(header), this.key)) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Invalid admin key');
    }
    return true;
  }
}
