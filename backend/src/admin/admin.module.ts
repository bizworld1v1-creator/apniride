import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DriversModule } from '../drivers/drivers.module.js';
import { FaresModule } from '../fares/fares.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AdminController } from './admin.controller.js';
import { AdminDriversController } from './admin-drivers.controller.js';
import { AdminOpsService } from './admin-ops.service.js';
import { AdminGuard } from './admin.guard.js';
import { AuditService } from './audit.service.js';
import { DriverReviewService } from './driver-review.service.js';

@Module({
  imports: [AuthModule, DriversModule, FaresModule, RealtimeModule],
  controllers: [AdminController, AdminDriversController],
  providers: [AdminGuard, AuditService, DriverReviewService, AdminOpsService],
})
export class AdminModule {}
