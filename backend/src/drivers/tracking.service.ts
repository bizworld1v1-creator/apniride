import { Inject, Injectable } from '@nestjs/common';
import type { CityCode, DriverLocationUpdate, DriverPosition, LatLng, VehicleType } from '@apniride/shared';
import type { Redis } from 'ioredis';
import { FaresService } from '../fares/fares.service.js';
import { REDIS } from '../redis/redis.module.js';
import { driverKeys } from './drivers.service.js';
import { etaTo } from './eta.js';

/** Last position is kept a bit longer than the heartbeat, for passengers who reconnect. */
const LAST_POSITION_TTL_SECONDS = 180;

/**
 * Per-ride tracking info, kept in Redis while the ride is accepted / arrived / in_progress,
 * so a location update (every few seconds per driver) needs no database query.
 */
interface Track {
  rideId: string;
  passengerId: string;
  city: CityCode;
  vehicleType: VehicleType;
  pickup: LatLng;
  dropoff: LatLng;
  /** to_pickup until the trip starts, then to_dropoff. */
  phase: 'to_pickup' | 'to_dropoff';
}

interface StoredLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  at: number;
}

const keys = {
  track: (rideId: string) => `ride:track:${rideId}`,
  lastLocation: (driverId: string) => `drv:loc:${driverId}`,
};

/**
 * Passengers see their driver's position **only during their own ride**: from accept until
 * complete / cancel. Before and after that, the location is never forwarded.
 */
@Injectable()
export class TrackingService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly fares: FaresService,
  ) {}

  async start(track: Omit<Track, 'phase'>): Promise<void> {
    await this.redis.set(keys.track(track.rideId), JSON.stringify({ ...track, phase: 'to_pickup' }));
  }

  async passengerOnBoard(rideId: string): Promise<void> {
    const track = await this.getTrack(rideId);
    if (track) await this.redis.set(keys.track(rideId), JSON.stringify({ ...track, phase: 'to_dropoff' }));
  }

  async stop(rideId: string): Promise<void> {
    await this.redis.del(keys.track(rideId));
  }

  /**
   * Called for every location the driver sends. Saves it, and if the driver is on a ride returns
   * what to push to that ride's passenger.
   */
  async onDriverLocation(
    driverId: string,
    update: DriverLocationUpdate,
  ): Promise<{ passengerId: string; position: DriverPosition } | null> {
    const stored: StoredLocation = {
      latitude: update.latitude,
      longitude: update.longitude,
      heading: update.heading ?? null,
      at: Date.now(),
    };
    await this.redis.set(keys.lastLocation(driverId), JSON.stringify(stored), 'EX', LAST_POSITION_TTL_SECONDS);

    const rideId = await this.redis.get(driverKeys.busy(driverId));
    if (!rideId) return null;
    const track = await this.getTrack(rideId);
    if (!track) return null;
    return { passengerId: track.passengerId, position: await this.position(track, stored) };
  }

  /** Last known position of the driver on this ride, or null (e.g. no update for 3 minutes). */
  async lastPosition(rideId: string, driverId: string): Promise<DriverPosition | null> {
    const [track, raw] = await Promise.all([this.getTrack(rideId), this.redis.get(keys.lastLocation(driverId))]);
    if (!track || !raw) return null;
    return this.position(track, JSON.parse(raw) as StoredLocation);
  }

  private async position(track: Track, loc: StoredLocation): Promise<DriverPosition> {
    const from = { latitude: loc.latitude, longitude: loc.longitude };
    const target = track.phase === 'to_pickup' ? track.pickup : track.dropoff;
    const speed = await this.fares.avgSpeedKmh(track.city, track.vehicleType);
    return {
      rideId: track.rideId,
      location: from,
      heading: loc.heading,
      ...etaTo(from, target, speed),
      ageSeconds: Math.max(0, Math.round((Date.now() - loc.at) / 1000)),
    };
  }

  private async getTrack(rideId: string): Promise<Track | null> {
    const raw = await this.redis.get(keys.track(rideId));
    return raw ? (JSON.parse(raw) as Track) : null;
  }
}
