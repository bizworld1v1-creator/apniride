import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { FaresModule } from './fares/fares.module.js';
import { HealthModule } from './health/health.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RidesModule } from './rides/rides.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    FaresModule,
    DriversModule,
    RealtimeModule,
    RidesModule,
    AdminModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
