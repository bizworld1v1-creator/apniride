import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MeController } from './me.controller.js';
import { PlacesController } from './places.controller.js';
import { PlacesService } from './places.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MeController, PlacesController],
  providers: [UsersService, PlacesService],
})
export class UsersModule {}
