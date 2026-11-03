import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { type BookRideBody, bookRideBodySchema, type CurrentRideResponse, type DriverPosition, type Ride } from '@apniride/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RidesService } from './rides.service.js';

/** Passenger side. Status changes are also pushed over Socket.IO ("ride:update"). */
@Controller('rides')
@UseGuards(AuthGuard)
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  /** Books the quoted fare and starts looking for a driver. Safe to retry with the same quoteId. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  book(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(bookRideBodySchema)) body: BookRideBody,
  ): Promise<Ride> {
    assertRole(me, 'passenger');
    return this.rides.book(me.userId, body);
  }

  @Get('current')
  async current(@CurrentUser() me: AuthUser): Promise<CurrentRideResponse> {
    assertRole(me, 'passenger');
    return { ride: await this.rides.currentForPassenger(me.userId) };
  }

  @Get(':id')
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    return this.rides.get(me.userId, id);
  }

  @Get(':id/driver-location')
  async driverLocation(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ position: DriverPosition | null }> {
    assertRole(me, 'passenger');
    return { position: await this.rides.driverPosition(me.userId, id) };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Ride> {
    assertRole(me, 'passenger');
    return this.rides.cancelByPassenger(me.userId, id);
  }
}
