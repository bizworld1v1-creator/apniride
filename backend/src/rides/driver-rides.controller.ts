import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  type DriverBidBody,
  driverBidBodySchema,
  type DriverCurrentResponse,
  type DriverEarnings,
  type Ride,
  type RideOffer,
  type RideHistoryPage,
  rideHistoryQuerySchema,
} from '@apniride/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DispatchService } from './dispatch.service.js';
import { HistoryService } from './history.service.js';
import { RidesService } from './rides.service.js';

/** Driver side: answer offers and move the ride along. */
@Controller('driver')
@UseGuards(AuthGuard)
export class DriverRidesController {
  constructor(
    private readonly rides: RidesService,
    private readonly dispatch: DispatchService,
    private readonly rideHistory: HistoryService,
  ) {}

  /** Pending offer and/or ride in progress. The driver app calls this on start and after reconnecting. */
  @Get('current')
  current(@CurrentUser() me: AuthUser): Promise<DriverCurrentResponse> {
    assertRole(me, 'driver');
    return this.rides.currentForDriver(me.userId);
  }

  /** Rides this driver did (completed or cancelled), newest first. */
  @Get('rides/history')
  history(
    @CurrentUser() me: AuthUser,
    @Query(new ZodValidationPipe(rideHistoryQuerySchema)) query: z.output<typeof rideHistoryQuerySchema>,
  ): Promise<RideHistoryPage> {
    assertRole(me, 'driver');
    return this.rideHistory.page('driver', me.userId, query.cursor);
  }

  /** Cash collected today, in the last 7 days and in total. */
  @Get('earnings')
  earnings(@CurrentUser() me: AuthUser): Promise<DriverEarnings> {
    assertRole(me, 'driver');
    return this.rideHistory.earnings(me.userId);
  }

  /**
   * Answer a request: fare = the passenger's price ("accept") or one of `counterOffers(price)`. The passenger then
   * chooses among the drivers who answered. 410 offer_expired if the request is gone.
   */
  @Post('rides/:id/bid')
  @HttpCode(HttpStatus.OK)
  bid(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(driverBidBodySchema)) body: DriverBidBody,
  ): Promise<RideOffer> {
    assertRole(me, 'driver');
    return this.dispatch.bid(me.userId, id, body.fare);
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
