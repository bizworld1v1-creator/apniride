import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type NearbyDriversResponse, nearbyDriversQuerySchema } from '@apniride/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { NearbyDriversService } from './nearby-drivers.service.js';

@Controller('drivers')
@UseGuards(AuthGuard)
export class NearbyDriversController {
  constructor(private readonly nearby: NearbyDriversService) {}

  /** Passenger app, before booking: available drivers around a point (see NearbyDriversService). */
  @Get('nearby')
  async list(
    @CurrentUser() me: AuthUser,
    @Query(new ZodValidationPipe(nearbyDriversQuerySchema)) q: z.output<typeof nearbyDriversQuerySchema>,
  ): Promise<NearbyDriversResponse> {
    assertRole(me, 'passenger');
    return { drivers: await this.nearby.around(q) };
  }
}
