import { HttpStatus } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { driverKeys } from '../drivers/drivers.service.js';
import { AppException } from './app-exception.js';

/**
 * For actions that would pull someone out of a ride or out of dispatch (switching mode, deleting the account):
 * refuses with 409 `go_offline_first` while they are online as a driver, and 409 `active_ride_exists` while they
 * have a ride that is still going on (as passenger or driver).
 */
export async function assertNotBusy(pool: pg.Pool, redis: Redis, userId: string): Promise<void> {
  if ((await redis.exists(driverKeys.online(userId))) === 1) {
    throw new AppException(HttpStatus.CONFLICT, 'go_offline_first', 'Go offline first');
  }
  const { rowCount } = await pool.query(
    `SELECT 1 FROM rides
      WHERE (passenger_id = $1 OR driver_id = $1) AND status IN ('searching', 'accepted', 'arrived', 'in_progress')
      LIMIT 1`,
    [userId],
  );
  if (rowCount) {
    throw new AppException(HttpStatus.CONFLICT, 'active_ride_exists', 'Finish or cancel the current ride first');
  }
}
