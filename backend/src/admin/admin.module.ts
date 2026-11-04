import { Module } from '@nestjs/common';
import { DriversModule } from '../drivers/drivers.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AdminDriversController } from './admin-drivers.controller.js';
import { AdminGuard } from './admin.guard.js';
import { DriverReviewService } from './driver-review.service.js';

@Module({
  imports: [DriversModule, RealtimeModule],
  controllers: [AdminDriversController],
  providers: [AdminGuard, DriverReviewService],
})
export class AdminModule {}
