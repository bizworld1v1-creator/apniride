import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { DriverCurrentResponse, Ride } from '@apniride/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { DispatchService } from './dispatch.service.js';
import { RidesService } from './rides.service.js';

/** Driver side: answer offers and move the ride along. */
@Controller('driver')
@UseGuards(AuthGuard)
export class DriverRidesController {
  constructor(
    private readonly rides: RidesService,
    private readonly dispatch: DispatchService,
  ) {}

  /** Pending offer and/or ride in progress. The driver app calls this on start and after reconnecting. */
  @Get('current')
  current(@CurrentUser() me: AuthUser): Promise<DriverCurrentResponse> {
    assertRole(me, 'driver');
    return this.rides.currentForDriver(me.userId);
  }

  @Post('rides/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'driver');
    return this.dispatch.accept(me.userId, id);
  }

  @Post('rides/:id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    assertRole(me, 'driver');
    await this.dispatch.decline(me.userId, id);
  }

  @Post('rides/:id/arrived')
  @HttpCode(HttpStatus.OK)
  arrived(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'driver');
    return this.rides.arrived(me.userId, id);
  }

  @Post('rides/:id/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'driver');
    return this.rides.start(me.userId, id);
  }

  @Post('rides/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'driver');
    return this.rides.complete(me.userId, id);
  }

  @Post('rides/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'driver');
    return this.rides.cancelByDriver(me.userId, id);
  }
}
