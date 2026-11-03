import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FaresModule } from '../fares/fares.module.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [AuthModule, FaresModule],
  controllers: [DriversController],
  providers: [DriversService, TrackingService],
  exports: [DriversService, TrackingService],
})
export class DriversModule {}
