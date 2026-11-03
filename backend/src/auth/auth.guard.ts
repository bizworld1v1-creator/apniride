import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../common/app-exception.js';
import { type AuthUser, TokensService } from './tokens.service.js';

export type AuthedRequest = Request & { user: AuthUser };

/** Requires `Authorization: Bearer <access token>` and puts the user on `req.user`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Missing access token');
    }
    req.user = await this.tokens.verifyAccessToken(token);
    return true;
  }
}
