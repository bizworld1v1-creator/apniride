import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DriversModule } from '../drivers/drivers.module.js';
import { FaresModule } from '../fares/fares.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { DispatchService } from './dispatch.service.js';
import { DriverRidesController } from './driver-rides.controller.js';
import { RidesController } from './rides.controller.js';
import { RidesRepository } from './rides.repository.js';
import { HistoryService } from './history.service.js';
import { RidesService } from './rides.service.js';

@Module({
  imports: [AuthModule, DriversModule, FaresModule, RealtimeModule],
  controllers: [RidesController, DriverRidesController],
  providers: [RidesRepository, RidesService, DispatchService, HistoryService],
})
export class RidesModule {}
