import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  type DriverProfile,
  type GoOnlineBody,
  goOnlineBodySchema,
} from '@apniride/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DriversService } from './drivers.service.js';

@Controller('driver')
@UseGuards(AuthGuard)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('me')
  me(@CurrentUser() me: AuthUser): Promise<DriverProfile> {
    assertRole(me, 'driver');
    return this.drivers.getProfile(me.userId);
  }

  /** Start receiving ride offers. Location updates then come over Socket.IO. */
  @Post('online')
  @HttpCode(HttpStatus.OK)
  online(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(goOnlineBodySchema)) body: GoOnlineBody,
  ): Promise<DriverProfile> {
    assertRole(me, 'driver');
    return this.drivers.goOnline(me.userId, body.location);
  }

  @Post('offline')
  @HttpCode(HttpStatus.OK)
  offline(@CurrentUser() me: AuthUser): Promise<DriverProfile> {
    assertRole(me, 'driver');
    return this.drivers.goOffline(me.userId);
  }
}
