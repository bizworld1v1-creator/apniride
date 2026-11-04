import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type CityCode,
  cityForPoint,
  type DriverApprovalStatus,
  type DriverProfile,
  type LatLng,
  type VehicleType,
} from '@apniride/shared';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { compareAndDelete } from '../common/redis-scripts.js';
import { PG_POOL } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';

/** A driver who hasn't sent a location for this long is skipped by matching (app killed, no signal). */
export const HEARTBEAT_TTL_SECONDS = 90;

/** All driver presence lives in Redis; Postgres only has the profile. */
export const driverKeys = {
  /** JSON {city, vehicleType} while online. */
  online: (id: string) => `drv:online:${id}`,
  heartbeat: (id: string) => `drv:hb:${id}`,
  /** rideId of the offer this driver is looking at right now (one at a time). */
  offer: (id: string) => `drv:offer:${id}`,
  /** rideId of the ride this driver is doing; makes them unavailable for new offers. */
  busy: (id: string) => `drv:ride:${id}`,
  /** Geo index of online drivers per city and vehicle type. */
  geo: (city: CityCode, vehicleType: VehicleType) => `drv:geo:${city}:${vehicleType}`,
};

interface OnlineState {
  city: CityCode;
  vehicleType: VehicleType;
}

// Atomically: online + recent heartbeat + not busy + no other offer → reserve for this offer.
const CLAIM_FOR_OFFER = `
if redis.call('exists', KEYS[1]) == 0 then return 0 end
if redis.call('exists', KEYS[2]) == 0 then return 0 end
if redis.call('exists', KEYS[3]) == 1 then return 0 end
if redis.call('set', KEYS[4], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end
return 0`;

@Injectable()
export class DriversService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async getProfile(userId: string): Promise<DriverProfile> {
    const { rows } = await this.pool.query<{ vehicle_type: VehicleType; approval_status: DriverApprovalStatus }>(
      'SELECT vehicle_type, approval_status FROM drivers WHERE user_id = $1',
      [userId],
    );
    const online = (await this.redis.exists(driverKeys.online(userId))) === 1;
    return {
      vehicleType: rows[0]?.vehicle_type ?? null,
      // No row yet = hasn't saved the onboarding details.
      approvalStatus: rows[0]?.approval_status ?? 'incomplete',
      online,
    };
  }

  async goOnline(userId: string, location: LatLng): Promise<DriverProfile> {
    const profile = await this.getProfile(userId);
    // Covers drivers who haven't onboarded yet (no vehicle either) as well as rejected / suspended ones.
    if (profile.approvalStatus !== 'approved' || !profile.vehicleType) {
      throw new AppException(HttpStatus.FORBIDDEN, 'driver_not_approved', 'Your account is not approved yet');
    }
    const city = cityForPoint(location);
    if (!city) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'outside_service_area', 'You are outside our service area');
    }
    const previous = await this.getOnline(userId);
    if (previous) await this.redis.zrem(driverKeys.geo(previous.city, previous.vehicleType), userId);

    const state: OnlineState = { city, vehicleType: profile.vehicleType };
    await this.redis.set(driverKeys.online(userId), JSON.stringify(state));
    await this.writeLocation(userId, state, location);
    return { ...profile, online: true };
  }

  async goOffline(userId: string): Promise<DriverProfile> {
    const state = await this.getOnline(userId);
    if (state) await this.redis.zrem(driverKeys.geo(state.city, state.vehicleType), userId);
    await this.redis.del(driverKeys.online(userId), driverKeys.heartbeat(userId));
    return this.getProfile(userId);
  }

  /** Called for every location the driver app sends (throttled on the phone). Ignored while offline. */
  async updateLocation(userId: string, location: LatLng): Promise<void> {
    const state = await this.getOnline(userId);
    if (!state) return;
    // Left the city (e.g. drove to Kasur): stop offering rides until they come back.
    if (cityForPoint(location) !== state.city) {
      await this.redis.zrem(driverKeys.geo(state.city, state.vehicleType), userId);
      return;
    }
    await this.writeLocation(userId, state, location);
  }

  /** Online drivers of this type near a point, nearest first. Availability is checked separately. */
  async findNearby(
    city: CityCode,
    vehicleType: VehicleType,
    point: LatLng,
    radiusKm: number,
  ): Promise<{ driverId: string; distanceKm: number }[]> {
    const result = (await this.redis.geosearch(
      driverKeys.geo(city, vehicleType),
      'FROMLONLAT',
      point.longitude,
      point.latitude,
      'BYRADIUS',
      radiusKm,
      'km',
      'ASC',
      'COUNT',
      20,
      'WITHDIST',
    )) as [string, string][];
    return result.map(([driverId, dist]) => ({ driverId, distanceKm: Number(dist) }));
  }

  /** Reserves an available driver for one offer. False if they're offline, stale, busy or already have an offer. */
  async claimForOffer(driverId: string, rideId: string, ttlSeconds: number): Promise<boolean> {
    const ok = await this.redis.eval(
      CLAIM_FOR_OFFER,
      4,
      driverKeys.online(driverId),
      driverKeys.heartbeat(driverId),
      driverKeys.busy(driverId),
      driverKeys.offer(driverId),
      rideId,
      ttlSeconds,
    );
    if (ok === 1) return true;
    // Clean up stale geo entries (app killed without going offline).
    if (!(await this.redis.exists(driverKeys.heartbeat(driverId)))) {
      const state = await this.getOnline(driverId);
      if (state) await this.redis.zrem(driverKeys.geo(state.city, state.vehicleType), driverId);
    }
    return false;
  }

  async releaseOffer(driverId: string, rideId: string): Promise<void> {
    await compareAndDelete(this.redis, driverKeys.offer(driverId), rideId);
  }

  async currentOfferRideId(driverId: string): Promise<string | null> {
    return this.redis.get(driverKeys.offer(driverId));
  }

  async setBusy(driverId: string, rideId: string): Promise<void> {
    await this.redis.set(driverKeys.busy(driverId), rideId);
  }

  async clearBusy(driverId: string, rideId: string): Promise<void> {
    await compareAndDelete(this.redis, driverKeys.busy(driverId), rideId);
  }

  private async getOnline(userId: string): Promise<OnlineState | null> {
    const raw = await this.redis.get(driverKeys.online(userId));
    return raw ? (JSON.parse(raw) as OnlineState) : null;
  }

  private async writeLocation(userId: string, state: OnlineState, location: LatLng) {
    await this.redis.geoadd(driverKeys.geo(state.city, state.vehicleType), location.longitude, location.latitude, userId);
    await this.redis.set(driverKeys.heartbeat(userId), '1', 'EX', HEARTBEAT_TTL_SECONDS);
  }
}
