import { Inject, Injectable } from '@nestjs/common';
import type { CityCode, LatLng, Ride, RideStatus, VehicleType } from '@apniride/shared';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';

interface RideRow {
  id: string;
  status: RideStatus;
  city: CityCode;
  vehicle_type: VehicleType;
  fare: number;
  distance_km: number;
  duration_min: number;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  created_at: Date;
  search_started_at: Date;
  cancelled_by: Ride['cancelledBy'];
  passenger_id: string;
  driver_id: string | null;
  passenger_name: string | null;
  driver_name: string | null;
}

/** Internal view with ids, for services. Never send this to apps; use toRide(). */
export interface RideRecord extends Ride {
  passengerId: string;
  driverId: string | null;
  searchStartedAt: Date;
}

const SELECT = `
  SELECT r.id, r.status, r.city, r.vehicle_type, r.fare, r.distance_km::float8 AS distance_km, r.duration_min,
         ST_Y(r.pickup::geometry) AS pickup_lat, ST_X(r.pickup::geometry) AS pickup_lng,
         ST_Y(r.dropoff::geometry) AS dropoff_lat, ST_X(r.dropoff::geometry) AS dropoff_lng,
         r.created_at, r.search_started_at, r.cancelled_by, r.passenger_id, r.driver_id,
         p.name AS passenger_name, d.name AS driver_name
    FROM rides r
    JOIN users p ON p.id = r.passenger_id
    LEFT JOIN users d ON d.id = r.driver_id`;

const ACTIVE = `('searching', 'accepted', 'arrived', 'in_progress')`;

/** First names only: "Muhammad Ali Khan" → "Muhammad". */
const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

function toRecord(row: RideRow): RideRecord {
  return {
    id: row.id,
    status: row.status,
    city: row.city,
    vehicleType: row.vehicle_type,
    fare: row.fare,
    distanceKm: row.distance_km,
    durationMin: row.duration_min,
    pickup: { latitude: row.pickup_lat, longitude: row.pickup_lng },
    dropoff: { latitude: row.dropoff_lat, longitude: row.dropoff_lng },
    createdAt: row.created_at.toISOString(),
    driver: row.driver_id ? { firstName: firstName(row.driver_name) } : null,
    passenger: { firstName: firstName(row.passenger_name) },
    cancelledBy: row.cancelled_by,
    passengerId: row.passenger_id,
    driverId: row.driver_id,
    searchStartedAt: row.search_started_at,
  };
}

/** Strips internal ids before sending to an app. */
export function toRide(record: RideRecord): Ride {
  const { passengerId: _p, driverId: _d, searchStartedAt: _s, ...ride } = record;
  return ride;
}

export interface NewRide {
  passengerId: string;
  city: CityCode;
  vehicleType: VehicleType;
  pickup: LatLng;
  dropoff: LatLng;
  fare: number;
  distanceKm: number;
  durationMin: number;
  quoteId: string;
}

@Injectable()
export class RidesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /** Throws pg error 23505 if the quote was already booked or the passenger has an active ride. */
  async insert(r: NewRide): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO rides (passenger_id, status, city, vehicle_type, pickup, dropoff, fare, distance_km, duration_min, quote_id)
       VALUES ($1, 'searching', $2, $3,
               ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
               ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
               $8, $9, $10, $11)
       RETURNING id`,
      [
        r.passengerId,
        r.city,
        r.vehicleType,
        r.pickup.longitude,
        r.pickup.latitude,
        r.dropoff.longitude,
        r.dropoff.latitude,
        r.fare,
        r.distanceKm,
        r.durationMin,
        r.quoteId,
      ],
    );
    return rows[0]!.id;
  }

  async find(id: string): Promise<RideRecord | null> {
    const { rows } = await this.pool.query<RideRow>(`${SELECT} WHERE r.id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByQuote(quoteId: string): Promise<RideRecord | null> {
    const { rows } = await this.pool.query<RideRow>(`${SELECT} WHERE r.quote_id = $1`, [quoteId]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findActiveForPassenger(passengerId: string): Promise<RideRecord | null> {
    const { rows } = await this.pool.query<RideRow>(
      `${SELECT} WHERE r.passenger_id = $1 AND r.status IN ${ACTIVE}`,
      [passengerId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findActiveForDriver(driverId: string): Promise<RideRecord | null> {
    const { rows } = await this.pool.query<RideRow>(
      `${SELECT} WHERE r.driver_id = $1 AND r.status IN ${ACTIVE}`,
      [driverId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  /**
   * Moves a ride from one of `from` to `to`, only if the conditions still hold (so concurrent
   * taps / retries can't skip states). Returns the updated ride, or null if nothing changed.
   */
  async transition(
    id: string,
    from: readonly RideStatus[],
    to: RideStatus,
    opts: { driverId?: string | null; passengerId?: string; set?: string } = {},
  ): Promise<RideRecord | null> {
    const params: unknown[] = [id, from, to];
    let where = 'id = $1 AND status = ANY($2::text[])';
    if (opts.driverId) {
      params.push(opts.driverId);
      where += ` AND driver_id = $${params.length}`;
    }
    if (opts.passengerId) {
      params.push(opts.passengerId);
      where += ` AND passenger_id = $${params.length}`;
    }
    const extra = opts.set ? `, ${opts.set}` : '';
    const { rowCount } = await this.pool.query(`UPDATE rides SET status = $3${extra} WHERE ${where}`, params);
    return rowCount ? this.find(id) : null;
  }

  /** Assigns the driver. Null if the ride is no longer searching (e.g. passenger cancelled). */
  async accept(id: string, driverId: string): Promise<RideRecord | null> {
    const { rowCount } = await this.pool.query(
      `UPDATE rides SET status = 'accepted', driver_id = $2, accepted_at = now(), cancelled_by = NULL
        WHERE id = $1 AND status = 'searching'`,
      [id, driverId],
    );
    return rowCount ? this.find(id) : null;
  }

  async recordOffer(rideId: string, driverId: string, pickupDistanceKm: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO ride_offers (ride_id, driver_id, pickup_distance_km) VALUES ($1, $2, $3)
       ON CONFLICT (ride_id, driver_id) DO UPDATE SET offered_at = now(), responded_at = NULL, response = NULL`,
      [rideId, driverId, Math.round(pickupDistanceKm * 10) / 10],
    );
  }

  async respondOffer(
    rideId: string,
    driverId: string,
    response: 'accepted' | 'declined' | 'expired' | 'cancelled',
  ): Promise<void> {
    await this.pool.query(
      `UPDATE ride_offers SET response = $3, responded_at = now()
        WHERE ride_id = $1 AND driver_id = $2 AND response IS NULL`,
      [rideId, driverId, response],
    );
  }
}
