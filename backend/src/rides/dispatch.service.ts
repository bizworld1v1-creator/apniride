import { randomUUID } from 'node:crypto';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Bid,
  isAllowedBid,
  type OfferClosedReason,
  type Ride,
  type RideBids,
  type RideOffer,
  SOCKET_EVENTS,
} from '@apniride/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { AppException } from '../common/app-exception.js';
import { bullConnection, compareAndDelete, compareAndSet } from '../common/redis-scripts.js';
import type { Env } from '../config/env.js';
import { DriversService } from '../drivers/drivers.service.js';
import { TrackingService } from '../drivers/tracking.service.js';
import { estimateDurationMin, ROAD_DETOUR_FACTOR } from '../fares/fare-calculator.js';
import { FaresService } from '../fares/fares.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { REDIS } from '../redis/redis.module.js';
import { type OfferResponse, type RideRecord, RidesRepository, toRide } from './rides.repository.js';

/** While a ride is searching, top up the drivers who see it this often. */
const TICK_MS = 5_000;
/** Redis keys outlive their timers a little, so a timeout job that runs late still finds them. */
const KEY_GRACE_SECONDS = 10;
const HOUR = 3600;

const PENDING = 'pending';
const BID = 'bid';

const rideKeys = {
  /** One driver's request on one ride: "pending" (waiting for an answer) or "bid" (passenger choosing). */
  request: (rideId: string, driverId: string) => `ride:req:${rideId}:${driverId}`,
  /** Drivers who currently have this ride on their screen (pending or bid). */
  requested: (rideId: string) => `ride:reqs:${rideId}`,
  /** The RideOffer each driver was sent (pickup distance differs per driver), for reconnects. */
  offerData: (rideId: string, driverId: string) => `ride:offerdata:${rideId}:${driverId}`,
  /** Open bids: driverId → StoredBid JSON. */
  bids: (rideId: string) => `ride:bids:${rideId}`,
  /** Drivers already sent this ride (never sent again: declined, expired, not chosen, cancelled on it). */
  tried: (rideId: string) => `ride:tried:${rideId}`,
};

/** A bid as kept in Redis (with the driver's id, which apps never see). */
interface StoredBid extends Omit<Bid, 'expiresInSeconds'> {
  driverId: string;
  expiresAt: string;
}

type DispatchJob =
  | { name: 'next'; rideId: string }
  | { name: 'offer-timeout'; rideId: string; driverId: string }
  | { name: 'bid-timeout'; rideId: string; driverId: string; bidId: string };

const secondsLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));

/**
 * inDrive-style dispatch. A searching ride is sent to the MAX_PARALLEL_REQUESTS nearest free drivers at once (topped
 * up every few seconds as drivers drop out). Each driver has OFFER_TIMEOUT_SECONDS to accept the passenger's price or
 * counter-offer (a bid) or decline. The passenger sees the bids live and chooses one within BID_TIMEOUT_SECONDS; the
 * others are told the ride was taken.
 *
 * A driver sees one request at a time (`drv:offer:<id>` is held while their request or bid is open). Every change of
 * a request goes through compare-and-delete / compare-and-set on `ride:req:<ride>:<driver>`, so exactly one of
 * bid / decline / timeout / choose / cancel wins. BullMQ holds the timers, so they survive restarts.
 */
@Injectable()
export class DispatchService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Dispatch');
  private queue!: Queue;
  private worker!: Worker;
  private readonly offerTimeoutS: number;
  private readonly bidTimeoutS: number;
  private readonly searchTimeoutS: number;
  private readonly radiusKm: number;
  private readonly maxParallel: number;
  private readonly allowSelfRides: boolean;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
    private readonly drivers: DriversService,
    private readonly rides: RidesRepository,
    private readonly realtime: RealtimeGateway,
    private readonly tracking: TrackingService,
    private readonly fares: FaresService,
  ) {
    this.offerTimeoutS = config.get('OFFER_TIMEOUT_SECONDS', { infer: true });
    this.bidTimeoutS = config.get('BID_TIMEOUT_SECONDS', { infer: true });
    this.searchTimeoutS = config.get('SEARCH_TIMEOUT_SECONDS', { infer: true });
    this.radiusKm = config.get('MATCH_RADIUS_KM', { infer: true });
    this.maxParallel = config.get('MAX_PARALLEL_REQUESTS', { infer: true });
    // Lets one tester use the same phone number in both modes during development.
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
        if (data.name === 'next') await this.fanOut(data.rideId);
        else if (data.name === 'offer-timeout') await this.expireRequest(data.rideId, data.driverId);
        else if (data.name === 'bid-timeout') await this.expireBid(data.rideId, data.driverId, data.bidId);
      },
      { connection, prefix, concurrency: 20 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`job ${job?.name} failed: ${err.message}`));
  }

  async onApplicationShutdown() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Start (or resume) sending this ride to drivers. */
  async kick(rideId: string, delayMs = 0): Promise<void> {
    await this.queue.add('next', { rideId }, { delay: delayMs });
  }

  // ------------------------------------------------------------------------------------- driver

  /** The driver accepts the passenger's price (fare = ride fare) or counter-offers. Returns the request with the bid. */
  async bid(driverId: string, rideId: string, fare: number): Promise<RideOffer> {
    const ride = await this.rides.find(rideId);
    const raw = await this.redis.get(rideKeys.offerData(rideId, driverId));
    if (!ride || ride.status !== 'searching' || !raw) throw offerExpired();
    if (!isAllowedBid(ride.fare, fare)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'bid_not_allowed', 'Choose the passenger price or a counter-offer');
    }

    const ttl = this.bidTimeoutS + KEY_GRACE_SECONDS;
    if (!(await compareAndSet(this.redis, rideKeys.request(rideId, driverId), PENDING, BID, ttl))) throw offerExpired();
    await this.drivers.extendOffer(driverId, rideId, ttl);

    const offer = JSON.parse(raw) as RideOffer;
    const speed = await this.fares.avgSpeedKmh(ride.city, ride.vehicleType);
    const expiresAt = new Date(Date.now() + this.bidTimeoutS * 1000).toISOString();
    const stored: StoredBid = {
      bidId: randomUUID(),
      driverId,
      fare,
      kind: fare === ride.fare ? 'accepted' : 'counter',
      expiresAt,
      driver: await this.rides.bidder(driverId),
      pickupDistanceKm: offer.pickupDistanceKm,
      etaMin: estimateDurationMin(Math.round(offer.pickupDistanceKm * ROAD_DETOUR_FACTOR * 10) / 10, speed),
    };
    await this.redis.hset(rideKeys.bids(rideId), driverId, JSON.stringify(stored));
    await this.redis.expire(rideKeys.bids(rideId), HOUR);

    const updated: RideOffer = { ...offer, expiresAt, expiresInSeconds: this.bidTimeoutS, bid: { fare, expiresInSeconds: this.bidTimeoutS } };
    await this.redis.set(rideKeys.offerData(rideId, driverId), JSON.stringify(updated), 'EX', ttl);
    await this.rides.recordBid(rideId, driverId, fare);
    await this.queue.add('bid-timeout', { rideId, driverId, bidId: stored.bidId }, { delay: this.bidTimeoutS * 1000 });
    await this.pushBids(ride);
    return updated;
  }

  async decline(driverId: string, rideId: string): Promise<void> {
    if (!(await compareAndDelete(this.redis, rideKeys.request(rideId, driverId), PENDING))) return;
    await this.release(rideId, driverId, 'declined');
    await this.kick(rideId);
  }

  /** The request this driver is looking at, if it's still open (for the driver app after a reconnect). */
  async currentOffer(driverId: string): Promise<RideOffer | null> {
    const rideId = await this.drivers.currentOfferRideId(driverId);
    if (!rideId || !(await this.redis.exists(rideKeys.request(rideId, driverId)))) return null;
    const raw = await this.redis.get(rideKeys.offerData(rideId, driverId));
    if (!raw) return null;
    const offer = JSON.parse(raw) as RideOffer;
    const left = secondsLeft(offer.expiresAt);
    if (left <= 0) return null;
    return { ...offer, expiresInSeconds: left, bid: offer.bid ? { ...offer.bid, expiresInSeconds: left } : null };
  }

  /** A driver who cancels after being chosen must not be sent the same ride again. */
  async markTried(rideId: string, driverId: string): Promise<void> {
    await this.redis.sadd(rideKeys.tried(rideId), driverId);
    await this.redis.expire(rideKeys.tried(rideId), HOUR);
  }

  // ---------------------------------------------------------------------------------- passenger

  /** Open bids on the passenger's searching ride (offers deck). */
  async bidsFor(ride: RideRecord): Promise<RideBids> {
    if (ride.status !== 'searching') return { rideId: ride.id, bids: [] };
    const all = Object.values(await this.redis.hgetall(rideKeys.bids(ride.id))).map((v) => JSON.parse(v) as StoredBid);
    const bids = all
      .filter((b) => secondsLeft(b.expiresAt) > 0)
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .map(({ driverId: _d, expiresAt, ...bid }): Bid => ({ ...bid, expiresInSeconds: secondsLeft(expiresAt) }));
    return { rideId: ride.id, bids };
  }

  /** The passenger rides with this driver at their bid. Everyone else is told the ride is taken. */
  async choose(ride: RideRecord, bidId: string): Promise<Ride> {
    if (ride.status !== 'searching') {
      throw new AppException(HttpStatus.CONFLICT, 'invalid_ride_state', 'This ride is no longer looking for a driver');
    }
    const all = Object.values(await this.redis.hgetall(rideKeys.bids(ride.id))).map((v) => JSON.parse(v) as StoredBid);
    const chosen = all.find((b) => b.bidId === bidId && secondsLeft(b.expiresAt) > 0);
    if (!chosen || !(await compareAndDelete(this.redis, rideKeys.request(ride.id, chosen.driverId), BID))) {
      throw bidExpired();
    }
    await this.redis.hdel(rideKeys.bids(ride.id), chosen.driverId);

    let accepted: RideRecord | null;
    try {
      accepted = await this.rides.accept(ride.id, chosen.driverId, chosen.fare);
    } catch (err) {
      // 23505: this driver somehow already has an active ride.
      if ((err as { code?: string }).code !== '23505') throw err;
      accepted = null;
    }
    if (!accepted) {
      await this.release(ride.id, chosen.driverId, 'cancelled', 'taken');
      await this.pushBids(ride);
      await this.kick(ride.id);
      throw bidExpired();
    }

    await this.release(ride.id, chosen.driverId, 'accepted', null);
    await this.drivers.setBusy(chosen.driverId, ride.id);
    await this.tracking.start({
      rideId: ride.id,
      passengerId: accepted.passengerId,
      city: accepted.city,
      vehicleType: accepted.vehicleType,
      pickup: accepted.pickup,
      dropoff: accepted.dropoff,
    });
    await this.closeAll(ride.id, 'taken');
    this.broadcast(accepted);
    return toRide(accepted);
  }

  /** Passenger cancelled while searching: take the request back from every driver's screen. */
  async withdrawAll(rideId: string): Promise<void> {
    await this.closeAll(rideId, 'cancelled');
  }

  /** Sends the ride's new state to its passenger and driver. */
  broadcast(ride: RideRecord, opts: { toDriverId?: string | null } = {}) {
    const payload = toRide(ride);
    this.realtime.toPassenger(ride.passengerId, SOCKET_EVENTS.rideUpdate, payload);
    const driverId = opts.toDriverId === undefined ? ride.driverId : opts.toDriverId;
    if (driverId) this.realtime.toDriver(driverId, SOCKET_EVENTS.rideUpdate, payload);
  }

  // ------------------------------------------------------------------------------------ internals

  /** Sends the ride to more drivers until MAX_PARALLEL_REQUESTS see it, then checks again in a few seconds. */
  private async fanOut(rideId: string): Promise<void> {
    const ride = await this.rides.find(rideId);
    if (!ride || ride.status !== 'searching') return;

    const open = await this.redis.scard(rideKeys.requested(rideId));
    if (Date.now() - ride.searchStartedAt.getTime() > this.searchTimeoutS * 1000) {
      // Time's up for new drivers. Wait while drivers are still answering or the passenger is choosing.
      if (open > 0) return this.scheduleTick(rideId);
      const updated = await this.rides.transition(rideId, ['searching'], 'no_driver', {
        set: "cancelled_by = 'system', cancelled_at = now()",
      });
      if (updated) this.broadcast(updated);
      return;
    }

    let slots = this.maxParallel - open;
    if (slots > 0) {
      const tried = new Set(await this.redis.smembers(rideKeys.tried(rideId)));
      const nearby = await this.drivers.findNearby(ride.city, ride.vehicleType, ride.pickup, this.radiusKm);
      for (const candidate of nearby) {
        if (slots <= 0) break;
        if (tried.has(candidate.driverId)) continue;
        if (candidate.driverId === ride.passengerId && !this.allowSelfRides) continue;
        if (await this.sendRequest(ride, candidate.driverId, candidate.distanceKm)) slots--;
      }
    }
    await this.scheduleTick(rideId);
  }

  private async sendRequest(ride: RideRecord, driverId: string, distanceKm: number): Promise<boolean> {
    const ttl = this.offerTimeoutS + KEY_GRACE_SECONDS;
    if (!(await this.drivers.claimForOffer(driverId, ride.id, ttl))) return false;
    // Guard against two workers sending the same ride to the same driver at once.
    if (!(await this.redis.set(rideKeys.request(ride.id, driverId), PENDING, 'EX', ttl, 'NX'))) {
      await this.drivers.releaseOffer(driverId, ride.id);
      return false;
    }
    await this.redis.sadd(rideKeys.requested(ride.id), driverId);
    await this.redis.expire(rideKeys.requested(ride.id), HOUR);
    await this.markTried(ride.id, driverId);

    const offer: RideOffer = {
      rideId: ride.id,
      expiresAt: new Date(Date.now() + this.offerTimeoutS * 1000).toISOString(),
      expiresInSeconds: this.offerTimeoutS,
      vehicleType: ride.vehicleType,
      fare: ride.fare,
      distanceKm: ride.distanceKm,
      durationMin: ride.durationMin,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      pickupDistanceKm: Math.round(distanceKm * 10) / 10,
      passengerFirstName: ride.passenger.firstName,
      bid: null,
    };
    await this.redis.set(rideKeys.offerData(ride.id, driverId), JSON.stringify(offer), 'EX', ttl);
    await this.rides.recordOffer(ride.id, driverId, distanceKm);
    await this.queue.add('offer-timeout', { rideId: ride.id, driverId }, { delay: this.offerTimeoutS * 1000 });
    this.realtime.toDriver(driverId, SOCKET_EVENTS.rideOffer, offer);
    return true;
  }

  /** The driver didn't answer in time. */
  private async expireRequest(rideId: string, driverId: string): Promise<void> {
    if (!(await compareAndDelete(this.redis, rideKeys.request(rideId, driverId), PENDING))) return;
    await this.release(rideId, driverId, 'expired', 'expired');
    await this.fanOut(rideId);
  }

  /** The passenger didn't choose this bid in time. */
  private async expireBid(rideId: string, driverId: string, bidId: string): Promise<void> {
    const raw = await this.redis.hget(rideKeys.bids(rideId), driverId);
    if (!raw || (JSON.parse(raw) as StoredBid).bidId !== bidId) return;
    if (!(await compareAndDelete(this.redis, rideKeys.request(rideId, driverId), BID))) return;
    await this.redis.hdel(rideKeys.bids(rideId), driverId);
    await this.release(rideId, driverId, 'bid_expired', 'expired');
    const ride = await this.rides.find(rideId);
    if (ride) await this.pushBids(ride);
    await this.fanOut(rideId);
  }

  /**
   * Frees a driver from this ride (their request key is already gone): forget the offer, record the outcome, and
   * (if `reason` is given) take it off their screen.
   */
  private async release(
    rideId: string,
    driverId: string,
    response: OfferResponse,
    reason: OfferClosedReason | null = null,
  ): Promise<void> {
    await this.redis.srem(rideKeys.requested(rideId), driverId);
    await this.redis.del(rideKeys.offerData(rideId, driverId));
    await this.drivers.releaseOffer(driverId, rideId);
    await this.rides.respondOffer(rideId, driverId, response);
    if (reason) this.realtime.toDriver(driverId, SOCKET_EVENTS.rideOfferCancelled, { rideId, reason });
  }

  /** Ends every open request and bid on a ride (another driver was chosen, or the passenger cancelled). */
  private async closeAll(rideId: string, reason: OfferClosedReason): Promise<void> {
    const driverIds = await this.redis.smembers(rideKeys.requested(rideId));
    for (const driverId of driverIds) {
      const key = rideKeys.request(rideId, driverId);
      const state = await this.redis.get(key);
      if (!state || !(await compareAndDelete(this.redis, key, state))) continue;
      const response: OfferResponse = state === BID && reason === 'taken' ? 'not_chosen' : 'cancelled';
      await this.release(rideId, driverId, response, reason);
    }
    await this.redis.del(rideKeys.bids(rideId));
  }

  private async pushBids(ride: RideRecord): Promise<void> {
    this.realtime.toPassenger(ride.passengerId, SOCKET_EVENTS.rideBids, await this.bidsFor(ride));
  }

  private async scheduleTick(rideId: string): Promise<void> {
    // One pending tick per ride and time slot (BullMQ ignores a job whose id is already waiting).
    const slot = Math.floor(Date.now() / TICK_MS) + 1;
    await this.queue.add('next', { rideId }, { delay: TICK_MS, jobId: `tick-${rideId}-${slot}` });
  }
}

function offerExpired() {
  return new AppException(HttpStatus.GONE, 'offer_expired', 'This ride is no longer available');
}

function bidExpired() {
  return new AppException(HttpStatus.GONE, 'bid_expired', 'This offer has expired, please choose another driver');
}
