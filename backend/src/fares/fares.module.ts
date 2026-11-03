import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FaresController } from './fares.controller.js';
import { FaresService } from './fares.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FaresController],
  providers: [FaresService],
  // Booking will use getQuote() to charge exactly the quoted fare.
  exports: [FaresService],
})
export class FaresModule {}
