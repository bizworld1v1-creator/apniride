import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Ride, type RideOffer, SOCKET_EVENTS } from '@apniride/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { AppException } from '../common/app-exception.js';
import { bullConnection, compareAndDelete } from '../common/redis-scripts.js';
import type { Env } from '../config/env.js';
import { DriversService } from '../drivers/drivers.service.js';
import { TrackingService } from '../drivers/tracking.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { REDIS } from '../redis/redis.module.js';
import { type RideRecord, RidesRepository, toRide } from './rides.repository.js';

/** When nobody is free nearby, look again this often until the search times out. */
const RETRY_DELAY_MS = 5_000;
/** Redis keys outlive the offer a little, so a timeout job that runs late still finds them. */
const KEY_GRACE_SECONDS = 10;

const rideKeys = {
  /** driverId currently holding the offer for this ride. */
  offer: (rideId: string) => `ride:offer:${rideId}`,
  /** The RideOffer payload, so a reconnecting driver app can show it again. */
  offerData: (rideId: string) => `ride:offerdata:${rideId}`,
  /** Drivers already offered this ride (declined / timed out / cancelled on it). */
  tried: (rideId: string) => `ride:tried:${rideId}`,
};

type DispatchJob = { name: 'next'; rideId: string } | { name: 'offer-timeout'; rideId: string; driverId: string };

/**
 * Sequential dispatch: offer the ride to the nearest available driver, wait OFFER_TIMEOUT_SECONDS,
 * then move to the next one. BullMQ holds the timers, so they survive restarts and work with
 * several API instances.
 *
 * Every hand-off of an offer (accept, decline, timeout, passenger cancel) goes through a
 * compare-and-delete on ride:offer:<id>, so exactly one of them wins.
 */
@Injectable()
export class DispatchService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Dispatch');
  private queue!: Queue;
  private worker!: Worker;
  private readonly offerTimeoutS: number;
  private readonly searchTimeoutS: number;
  private readonly radiusKm: number;
  private readonly allowSelfRides: boolean;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
    private readonly drivers: DriversService,
    private readonly rides: RidesRepository,
    private readonly realtime: RealtimeGateway,
    private readonly tracking: TrackingService,
  ) {
    this.offerTimeoutS = config.get('OFFER_TIMEOUT_SECONDS', { infer: true });
    this.searchTimeoutS = config.get('SEARCH_TIMEOUT_SECONDS', { infer: true });
    this.radiusKm = config.get('MATCH_RADIUS_KM', { infer: true });
    // Lets one tester use the same phone number in both apps during development.
    this.allowSelfRides = config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  onModuleInit() {
    const connection = bullConnection(this.config.get('REDIS_URL', { infer: true }));
    const prefix = this.config.get('QUEUE_PREFIX', { infer: true });
    this.queue = new Queue('dispatch', {
      connection,
      prefix,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 500, attempts: 3, backoff: { type: 'fixed', delay: 1000 } },
    });
    this.worker = new Worker(
      'dispatch',
      async (job) => {
        const data = { name: job.name, ...job.data } as DispatchJob;
        if (data.name === 'next') await this.offerNext(data.rideId);
        else if (data.name === 'offer-timeout') await this.expireOffer(data.rideId, data.driverId);
      },
      { connection, prefix, concurrency: 20 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`job ${job?.name} failed: ${err.message}`));
  }

  async onApplicationShutdown() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Start (or resume) looking for a driver for this ride. */
  async kick(rideId: string, delayMs = 0): Promise<void> {
    await this.queue.add('next', { rideId }, { delay: delayMs });
  }

  /** Called by the driver app. Only the driver currently holding the offer can accept. */
  async accept(driverId: string, rideId: string): Promise<Ride> {
    if (!(await compareAndDelete(this.redis, rideKeys.offer(rideId), driverId))) {
      throw new AppException(HttpStatus.GONE, 'offer_expired', 'This ride is no longer available');
    }
    await this.redis.del(rideKeys.offerData(rideId));
    await this.drivers.releaseOffer(driverId, rideId);

    let ride: RideRecord | null;
    try {
      ride = await this.rides.accept(rideId, driverId);
    } catch (err) {
      // 23505: this driver somehow already has an active ride. Give the ride to someone else.
      if ((err as { code?: string }).code !== '23505') throw err;
      ride = null;
    }
    if (!ride) {
      await this.rides.respondOffer(rideId, driverId, 'cancelled');
      await this.kick(rideId);
      throw new AppException(HttpStatus.CONFLICT, 'offer_expired', 'This ride is no longer available');
    }

    await this.drivers.setBusy(driverId, rideId);
    await this.tracking.start({
      rideId,
      passengerId: ride.passengerId,
      city: ride.city,
      vehicleType: ride.vehicleType,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
    });
    await this.rides.respondOffer(rideId, driverId, 'accepted');
    this.broadcast(ride);
    return toRide(ride);
  }

  async decline(driverId: string, rideId: string): Promise<void> {
    if (!(await compareAndDelete(this.redis, rideKeys.offer(rideId), driverId))) return;
    await this.redis.del(rideKeys.offerData(rideId));
    await this.drivers.releaseOffer(driverId, rideId);
    await this.rides.respondOffer(rideId, driverId, 'declined');
    await this.kick(rideId);
  }

  /** Passenger cancelled while an offer was out: take it back from the driver's screen. */
  async withdrawOffer(rideId: string): Promise<void> {
    const driverId = await this.redis.get(rideKeys.offer(rideId));
    if (!driverId || !(await compareAndDelete(this.redis, rideKeys.offer(rideId), driverId))) return;
    await this.redis.del(rideKeys.offerData(rideId));
    await this.drivers.releaseOffer(driverId, rideId);
    await this.rides.respondOffer(rideId, driverId, 'cancelled');
    this.realtime.toDriver(driverId, SOCKET_EVENTS.rideOfferCancelled, { rideId });
  }

  /** A driver who cancels after accepting must not be offered the same ride again. */
  async markTried(rideId: string, driverId: string): Promise<void> {
    await this.redis.sadd(rideKeys.tried(rideId), driverId);
    await this.redis.expire(rideKeys.tried(rideId), 3600);
  }

  /** The offer this driver is looking at, if it's still open (for the driver app after a reconnect). */
  async currentOffer(driverId: string): Promise<RideOffer | null> {
    const rideId = await this.drivers.currentOfferRideId(driverId);
    if (!rideId || (await this.redis.get(rideKeys.offer(rideId))) !== driverId) return null;
    const raw = await this.redis.get(rideKeys.offerData(rideId));
    if (!raw) return null;
    const offer = JSON.parse(raw) as RideOffer;
    const left = Math.ceil((Date.parse(offer.expiresAt) - Date.now()) / 1000);
    return left > 0 ? { ...offer, expiresInSeconds: left } : null;
  }

  /** Sends the ride's new state to its passenger and driver. */
  broadcast(ride: RideRecord, opts: { toDriverId?: string | null } = {}) {
    const payload = toRide(ride);
    this.realtime.toPassenger(ride.passengerId, SOCKET_EVENTS.rideUpdate, payload);
    const driverId = opts.toDriverId === undefined ? ride.driverId : opts.toDriverId;
    if (driverId) this.realtime.toDriver(driverId, SOCKET_EVENTS.rideUpdate, payload);
  }

  // ------------------------------------------------------------------------------------------

  private async offerNext(rideId: string): Promise<void> {
    const ride = await this.rides.find(rideId);
    if (!ride || ride.status !== 'searching') return;
    if (await this.redis.exists(rideKeys.offer(rideId))) return; // an offer is already out

    if (Date.now() - ride.searchStartedAt.getTime() > this.searchTimeoutS * 1000) {
      const updated = await this.rides.transition(rideId, ['searching'], 'no_driver', {
        set: "cancelled_by = 'system', cancelled_at = now()",
      });
      if (updated) this.broadcast(updated);
      return;
    }

    const tried = new Set(await this.redis.smembers(rideKeys.tried(rideId)));
    const nearby = await this.drivers.findNearby(ride.city, ride.vehicleType, ride.pickup, this.radiusKm);
    const keyTtl = this.offerTimeoutS + KEY_GRACE_SECONDS;

    for (const candidate of nearby) {
      if (tried.has(candidate.driverId)) continue;
      if (candidate.driverId === ride.passengerId && !this.allowSelfRides) continue;
      if (!(await this.drivers.claimForOffer(candidate.driverId, rideId, keyTtl))) continue;

      // Second guard against two workers offering the same ride at once.
      const claimed = await this.redis.set(rideKeys.offer(rideId), candidate.driverId, 'EX', keyTtl, 'NX');
      if (!claimed) {
        await this.drivers.releaseOffer(candidate.driverId, rideId);
        return;
      }
      await this.markTried(rideId, candidate.driverId);

      const offer: RideOffer = {
        rideId,
        expiresAt: new Date(Date.now() + this.offerTimeoutS * 1000).toISOString(),
        expiresInSeconds: this.offerTimeoutS,
        vehicleType: ride.vehicleType,
        fare: ride.fare,
        distanceKm: ride.distanceKm,
        durationMin: ride.durationMin,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        pickupDistanceKm: Math.round(candidate.distanceKm * 10) / 10,
        passengerFirstName: ride.passenger.firstName,
      };
      await this.redis.set(rideKeys.offerData(rideId), JSON.stringify(offer), 'EX', keyTtl);
      await this.rides.recordOffer(rideId, candidate.driverId, candidate.distanceKm);
      await this.queue.add(
        'offer-timeout',
        { rideId, driverId: candidate.driverId },
        { delay: this.offerTimeoutS * 1000 },
      );
      this.realtime.toDriver(candidate.driverId, SOCKET_EVENTS.rideOffer, offer);
      return;
    }

    // Nobody free right now; drivers come online / finish rides all the time.
    await this.kick(rideId, RETRY_DELAY_MS);
  }

  private async expireOffer(rideId: string, driverId: string): Promise<void> {
    if (!(await compareAndDelete(this.redis, rideKeys.offer(rideId), driverId))) return;
    await this.redis.del(rideKeys.offerData(rideId));
    await this.drivers.releaseOffer(driverId, rideId);
    await this.rides.respondOffer(rideId, driverId, 'expired');
    this.realtime.toDriver(driverId, SOCKET_EVENTS.rideOfferCancelled, { rideId });
    await this.offerNext(rideId);
  }
}
