import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { type User, updateProfileBodySchema } from '@apniride/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() me: AuthUser): Promise<User> {
    return this.users.get(me.userId, me.role);
  }

  @Patch()
  update(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(updateProfileBodySchema))
    body: z.output<typeof updateProfileBodySchema>,
  ): Promise<User> {
    return this.users.updateName(me.userId, me.role, body.name);
  }
}
