import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FaresModule } from '../fares/fares.module.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [AuthModule, FaresModule],
  controllers: [DriversController, OnboardingController],
  providers: [DriversService, TrackingService, OnboardingService],
  exports: [DriversService, TrackingService, OnboardingService],
})
export class DriversModule {}
