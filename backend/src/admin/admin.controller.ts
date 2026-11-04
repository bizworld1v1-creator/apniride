import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import {
  type AdminFareRate,
  type AdminMe,
  type AdminRideDetail,
  adminRideListQuerySchema,
  type AdminRideSummary,
  type AdminStats,
  type CityCode,
  cityCodeSchema,
  fareRateBodySchema,
  type VehicleType,
  vehicleTypeSchema,
} from '@apniride/shared';
import type { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AdminOpsService } from './admin-ops.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly ops: AdminOpsService) {}

  @Get('me')
  me(@CurrentUser() me: AuthUser): Promise<AdminMe> {
    return this.ops.me(me.userId);
  }

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.ops.stats();
  }

  @Get('rides')
  rides(
    @Query(new ZodValidationPipe(adminRideListQuerySchema)) query: z.output<typeof adminRideListQuerySchema>,
  ): Promise<AdminRideSummary[]> {
    return this.ops.rides(query);
  }

  @Get('rides/:id')
  ride(@Param('id', ParseUUIDPipe) id: string): Promise<AdminRideDetail> {
    return this.ops.ride(id);
  }

  @Get('fare-rates')
  fareRates(): Promise<AdminFareRate[]> {
    return this.ops.fareRates();
  }

  @Put('fare-rates/:city/:vehicleType')
  updateFareRate(
    @CurrentUser() me: AuthUser,
    @Param('city', new ZodValidationPipe(cityCodeSchema)) city: CityCode,
    @Param('vehicleType', new ZodValidationPipe(vehicleTypeSchema)) vehicleType: VehicleType,
    @Body(new ZodValidationPipe(fareRateBodySchema)) body: z.output<typeof fareRateBodySchema>,
  ): Promise<AdminFareRate> {
    return this.ops.updateFareRate(me.userId, city, vehicleType, body);
  }
}
