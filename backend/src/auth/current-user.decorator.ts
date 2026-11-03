import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './auth.guard.js';
import type { AuthUser } from './tokens.service.js';

/** The signed-in user. Only use on routes protected by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
