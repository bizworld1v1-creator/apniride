import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cityForPoint,
  type LatLng,
  NEARBY_DRIVERS,
  type NearbyDriver,
  todayInPakistan,
  vehicleTypeSchema,
} from '@apniride/shared';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { driverKeys } from './drivers.service.js';
import { TRACKING_KEYS } from './tracking.service.js';

/** ~11 m: enough for a map, not enough to pinpoint a parked driver's house. */
const round = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Available drivers around a passenger, for the map before booking (like other ride apps show).
 * Privacy: no ids, names or exact positions; a marker key that changes every day; only drivers who are online,
 * recently heard from and not on a ride.
 */
@Injectable()
export class NearbyDriversService {
  private readonly secret: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_SECRET', { infer: true });
  }

  async around(point: LatLng): Promise<NearbyDriver[]> {
    const city = cityForPoint(point);
    if (!city) return [];
    const day = todayInPakistan();
    const result: NearbyDriver[] = [];

    for (const vehicleType of vehicleTypeSchema.options) {
      const found = (await this.redis.geosearch(
        driverKeys.geo(city, vehicleType),
        'FROMLONLAT',
        point.longitude,
        point.latitude,
        'BYRADIUS',
        NEARBY_DRIVERS.radiusKm,
        'km',
        'ASC',
        'COUNT',
        NEARBY_DRIVERS.perVehicleType * 2,
        'WITHCOORD',
      )) as [string, [string, string]][];
      if (found.length === 0) continue;

      // One round trip for all of them: heartbeat, busy flag, last heading.
      const pipe = this.redis.pipeline();
      for (const [id] of found) {
        pipe.exists(driverKeys.heartbeat(id));
        pipe.exists(driverKeys.busy(id));
        pipe.get(TRACKING_KEYS.lastLocation(id));
      }
      const replies = (await pipe.exec()) ?? [];

      let added = 0;
      found.forEach(([id, [lng, lat]], i) => {
        if (added >= NEARBY_DRIVERS.perVehicleType) return;
        const alive = replies[i * 3]?.[1] === 1;
        const busy = replies[i * 3 + 1]?.[1] === 1;
        if (!alive || busy) return;
        const last = replies[i * 3 + 2]?.[1] as string | null;
        const heading = last ? ((JSON.parse(last) as { heading: number | null }).heading ?? null) : null;
        result.push({
          key: createHmac('sha256', this.secret).update(`nearby:${day}:${id}`).digest('base64url').slice(0, 16),
          vehicleType,
          location: { latitude: round(Number(lat)), longitude: round(Number(lng)) },
          heading: heading === null ? null : Math.round(heading),
        });
        added++;
      });
    }
    return result;
  }
}
