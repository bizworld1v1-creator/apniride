import { HttpStatus, Injectable } from '@nestjs/common';
import type { BookRideBody, DriverCurrentResponse, DriverPosition, Ride, RideStatus } from '@apniride/shared';
import { offerRange } from '@apniride/shared';
import { AppException } from '../common/app-exception.js';
import { DriversService } from '../drivers/drivers.service.js';
import { TrackingService } from '../drivers/tracking.service.js';
import { FaresService } from '../fares/fares.service.js';
import { DispatchService } from './dispatch.service.js';
import { type RideRecord, RidesRepository, toRide } from './rides.repository.js';

/** The passenger can cancel until the trip starts; after that it goes through support. */
const PASSENGER_CANCELLABLE: readonly RideStatus[] = ['searching', 'accepted', 'arrived'];

const invalidState = () =>
  new AppException(HttpStatus.CONFLICT, 'invalid_ride_state', 'The ride has changed, please refresh');
const notFound = () => new AppException(HttpStatus.NOT_FOUND, 'ride_not_found', 'Ride not found');

@Injectable()
export class RidesService {
  constructor(
    private readonly rides: RidesRepository,
    private readonly fares: FaresService,
    private readonly drivers: DriversService,
    private readonly dispatch: DispatchService,
    private readonly tracking: TrackingService,
  ) {}

  // ---------------------------------------------------------------- passenger

  async book(passengerId: string, body: BookRideBody): Promise<Ride> {
    // Same quote booked twice (double tap, or a retry after a lost response): return the same ride.
    const existing = await this.rides.findByQuote(body.quoteId);
    if (existing) {
      if (existing.passengerId !== passengerId) throw quoteExpired();
      return toRide(existing);
    }

    const quote = await this.fares.getQuote(passengerId, body.quoteId);
    if (!quote) throw quoteExpired();
    const option = quote.options.find((o) => o.vehicleType === body.vehicleType);
    if (!option) throw quoteExpired();
    // The passenger may raise the price (like inDrive), never below the distance-based fare and at most 2×.
    const range = offerRange(option.fare);
    const fare = body.offeredFare ?? option.fare;
    if (fare < range.min || fare > range.max) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'offer_out_of_range', `Offer must be between Rs ${range.min} and Rs ${range.max}`);
    }

    let rideId: string;
    try {
      rideId = await this.rides.insert({
        passengerId,
        city: quote.city,
        vehicleType: option.vehicleType,
        pickup: quote.pickup,
        dropoff: quote.dropoff,
        fare,
        distanceKm: quote.distanceKm,
        durationMin: option.durationMin,
        quoteId: body.quoteId,
      });
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === '23505' && e.constraint === 'rides_one_active_per_passenger') {
        throw new AppException(HttpStatus.CONFLICT, 'active_ride_exists', 'You already have a ride in progress');
      }
      if (e.code === '23505' && e.constraint === 'rides_quote_id_key') {
        const raced = await this.rides.findByQuote(body.quoteId);
        if (raced?.passengerId === passengerId) return toRide(raced);
      }
      throw err;
    }

    await this.dispatch.kick(rideId);
    return toRide((await this.rides.find(rideId))!);
  }

  async currentForPassenger(passengerId: string): Promise<Ride | null> {
    const ride = await this.rides.findActiveForPassenger(passengerId);
    return ride ? toRide(ride) : null;
  }

  /** A ride the user took part in (as passenger or driver), in any state. */
  async get(userId: string, rideId: string): Promise<Ride> {
    const ride = await this.rides.find(rideId);
    if (!ride || (ride.passengerId !== userId && ride.driverId !== userId)) throw notFound();
    return toRide(ride);
  }

  /** The passenger's view of where their driver is. Null outside an active ride with a driver. */
  async driverPosition(passengerId: string, rideId: string): Promise<DriverPosition | null> {
    const ride = await this.rides.find(rideId);
    if (!ride || ride.passengerId !== passengerId) throw notFound();
    if (!ride.driverId || !['accepted', 'arrived', 'in_progress'].includes(ride.status)) return null;
    return this.tracking.lastPosition(rideId, ride.driverId);
  }

  async cancelByPassenger(passengerId: string, rideId: string): Promise<Ride> {
    const before = await this.rides.find(rideId);
    if (!before || before.passengerId !== passengerId) throw notFound();
    if (before.status === 'cancelled' || before.status === 'no_driver') return toRide(before); // idempotent

    const ride = await this.rides.transition(rideId, PASSENGER_CANCELLABLE, 'cancelled', {
      passengerId,
      set: "cancelled_by = 'passenger', cancelled_at = now()",
    });
    if (!ride) throw invalidState();

    await this.dispatch.withdrawOffer(rideId);
    await this.tracking.stop(rideId);
    if (before.driverId) await this.drivers.clearBusy(before.driverId, rideId);
    this.dispatch.broadcast(ride, { toDriverId: before.driverId });
    return toRide(ride);
  }

  // ---------------------------------------------------------------- driver

  async currentForDriver(driverId: string): Promise<DriverCurrentResponse> {
    const [offer, ride] = await Promise.all([
      this.dispatch.currentOffer(driverId),
      this.rides.findActiveForDriver(driverId),
    ]);
    return { offer, ride: ride ? toRide(ride) : null };
  }

  arrived(driverId: string, rideId: string) {
    return this.driverStep(driverId, rideId, ['accepted'], 'arrived', 'arrived_at = now()');
  }

  async start(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.driverStep(driverId, rideId, ['arrived'], 'in_progress', 'started_at = now()');
    // ETA now counts to the destination.
    await this.tracking.passengerOnBoard(rideId);
    return ride;
  }

  async complete(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.driverStep(driverId, rideId, ['in_progress'], 'completed', 'completed_at = now()');
    await this.tracking.stop(rideId);
    await this.drivers.clearBusy(driverId, rideId);
    return ride;
  }

  /**
   * Driver backs out before pickup: the passenger keeps their booking and we search again
   * (never offering it back to this driver). Penalties for this come with driver ratings.
   */
  async cancelByDriver(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.rides.transition(rideId, ['accepted', 'arrived'], 'searching', {
      driverId,
      set: `driver_id = NULL, accepted_at = NULL, arrived_at = NULL,
            cancelled_by = 'driver', search_started_at = now()`,
    });
    if (!ride) throw invalidState();
    await this.tracking.stop(rideId);
    await this.drivers.clearBusy(driverId, rideId);
    await this.dispatch.markTried(rideId, driverId);
    this.dispatch.broadcast(ride);
    await this.dispatch.kick(rideId);
    return toRide(ride);
  }

  private async driverStep(
    driverId: string,
    rideId: string,
    from: readonly RideStatus[],
    to: RideStatus,
    set: string,
  ): Promise<Ride> {
    const ride: RideRecord | null = await this.rides.transition(rideId, from, to, { driverId, set });
    if (!ride) {
      // Retry after a lost response: already in the target state → just return it.
      const current = await this.rides.find(rideId);
      if (current?.driverId === driverId && current.status === to) return toRide(current);
      throw current?.driverId === driverId ? invalidState() : notFound();
    }
    this.dispatch.broadcast(ride);
    return toRide(ride);
  }
}

function quoteExpired() {
  return new AppException(HttpStatus.GONE, 'quote_expired', 'This fare has expired, please check the fare again');
}
