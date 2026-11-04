import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type AdminFareRate,
  type AdminMe,
  type AdminRideDetail,
  adminRideListQuerySchema,
  type AdminRideSummary,
  type AdminStats,
  type CityCode,
  cityCodeSchema,
  fareRateBodySchema,
  maskPhone,
  type RideStatus,
  type VehicleType,
  vehicleTypeSchema,
} from '@apniride/shared';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import type { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';
import { driverKeys } from '../drivers/drivers.service.js';
import { calculateFare, estimateDurationMin } from '../fares/fare-calculator.js';
import { FaresService } from '../fares/fares.service.js';
import { REDIS } from '../redis/redis.module.js';
import { AuditService } from './audit.service.js';

/** Typical Lahore trips shown next to each fare rate, so the effect of a change is obvious. */
const EXAMPLE_KM = [3, 8, 15];

/** Midnight today in Pakistan, as a Postgres expression. */
const PK_TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')`;

const iso = (d: Date | null) => d?.toISOString() ?? null;

interface RideRow {
  id: string;
  status: RideStatus;
  city: CityCode;
  vehicle_type: VehicleType;
  fare: number;
  distance_km: number;
  duration_min: number;
  passenger_id: string;
  passenger_name: string | null;
  passenger_phone: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  cancelled_by: AdminRideSummary['cancelledBy'];
  created_at: Date;
}

const RIDE_SELECT = `
  SELECT r.id, r.status, r.city, r.vehicle_type, r.fare, r.distance_km::float8 AS distance_km, r.duration_min,
         r.passenger_id, p.name AS passenger_name, p.phone AS passenger_phone,
         r.driver_id, d.name AS driver_name, d.phone AS driver_phone, r.cancelled_by, r.created_at
    FROM rides r
    JOIN users p ON p.id = r.passenger_id
    LEFT JOIN users d ON d.id = r.driver_id`;

function toRideSummary(r: RideRow): AdminRideSummary {
  return {
    id: r.id,
    status: r.status,
    city: r.city,
    vehicleType: r.vehicle_type,
    fare: r.fare,
    distanceKm: r.distance_km,
    passenger: { id: r.passenger_id, name: r.passenger_name, phone: r.passenger_phone },
    driver: r.driver_id ? { id: r.driver_id, name: r.driver_name, phone: r.driver_phone ?? '' } : null,
    cancelledBy: r.cancelled_by,
    createdAt: r.created_at.toISOString(),
  };
}

interface FareRow {
  city: CityCode;
  vehicle_type: VehicleType;
  base_fare: number;
  per_km: number;
  per_min: number;
  minimum_fare: number;
  avg_speed_kmh: number;
  active: boolean;
  updated_at: Date;
}

function toFareRate(r: FareRow): AdminFareRate {
  const rate = {
    vehicleType: r.vehicle_type,
    baseFare: r.base_fare,
    perKm: r.per_km,
    perMin: r.per_min,
    minimumFare: r.minimum_fare,
    avgSpeedKmh: r.avg_speed_kmh,
  };
  return {
    city: r.city,
    ...rate,
    active: r.active,
    updatedAt: r.updated_at.toISOString(),
    examples: EXAMPLE_KM.map((km) => {
      const durationMin = estimateDurationMin(km, rate.avgSpeedKmh);
      return { km, durationMin, fare: calculateFare(rate, km, durationMin) };
    }),
  };
}

/** Dashboard, rides and fare rates for the admin panel. */
@Injectable()
export class AdminOpsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly fares: FaresService,
    private readonly audit: AuditService,
  ) {}

  async me(adminId: string): Promise<AdminMe> {
    const { rows } = await this.pool.query<{ name: string | null; phone: string }>(
      'SELECT name, phone FROM users WHERE id = $1',
      [adminId],
    );
    const row = rows[0]!;
    return { id: adminId, name: row.name, phoneMasked: maskPhone(row.phone) };
  }

  async stats(): Promise<AdminStats> {
    const [drivers, rides, online] = await Promise.all([
      this.pool.query<{ pending: number; approved: number }>(
        `SELECT count(*) FILTER (WHERE approval_status = 'pending')::int AS pending,
                count(*) FILTER (WHERE approval_status = 'approved')::int AS approved
           FROM drivers`,
      ),
      this.pool.query<{
        active: number;
        today: number;
        completed: number;
        cancelled: number;
        no_driver: number;
        completed_fares: number;
      }>(
        `SELECT count(*) FILTER (WHERE status IN ('searching', 'accepted', 'arrived', 'in_progress'))::int AS active,
                count(*) FILTER (WHERE created_at >= ${PK_TODAY})::int AS today,
                count(*) FILTER (WHERE created_at >= ${PK_TODAY} AND status = 'completed')::int AS completed,
                count(*) FILTER (WHERE created_at >= ${PK_TODAY} AND status = 'cancelled')::int AS cancelled,
                count(*) FILTER (WHERE created_at >= ${PK_TODAY} AND status = 'no_driver')::int AS no_driver,
                COALESCE(sum(fare) FILTER (WHERE created_at >= ${PK_TODAY} AND status = 'completed'), 0)::int
                  AS completed_fares
           FROM rides
          WHERE status IN ('searching', 'accepted', 'arrived', 'in_progress') OR created_at >= ${PK_TODAY}`,
      ),
      this.onlineDrivers(),
    ]);
    const d = drivers.rows[0]!;
    const r = rides.rows[0]!;
    return {
      pendingDrivers: d.pending,
      approvedDrivers: d.approved,
      onlineDrivers: online,
      activeRides: r.active,
      today: {
        rides: r.today,
        completed: r.completed,
        cancelled: r.cancelled,
        noDriver: r.no_driver,
        completedFares: r.completed_fares,
      },
    };
  }

  /** Drivers in the matching pools right now (may include some whose app died in the last 90 s). */
  private async onlineDrivers(): Promise<number> {
    const counts = await Promise.all(
      cityCodeSchema.options.flatMap((city) =>
        vehicleTypeSchema.options.map((v) => this.redis.zcard(driverKeys.geo(city, v))),
      ),
    );
    return counts.reduce((a, b) => a + b, 0);
  }

  /** Newest first, 50 per page. */
  async rides(query: z.output<typeof adminRideListQuerySchema>): Promise<AdminRideSummary[]> {
    const { rows } = await this.pool.query<RideRow>(
      `${RIDE_SELECT}
        WHERE ($1::text IS NULL OR r.status = $1)
          AND ($2::timestamptz IS NULL OR r.created_at < $2)
        ORDER BY r.created_at DESC
        LIMIT $3`,
      [query.status ?? null, query.before ?? null, query.limit],
    );
    return rows.map(toRideSummary);
  }

  async ride(id: string): Promise<AdminRideDetail> {
    const [ride, extra, offers] = await Promise.all([
      this.pool.query<RideRow>(`${RIDE_SELECT} WHERE r.id = $1`, [id]),
      this.pool.query<{
        pickup_lat: number;
        pickup_lng: number;
        dropoff_lat: number;
        dropoff_lng: number;
        accepted_at: Date | null;
        arrived_at: Date | null;
        started_at: Date | null;
        completed_at: Date | null;
        cancelled_at: Date | null;
      }>(
        `SELECT ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
                ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
                accepted_at, arrived_at, started_at, completed_at, cancelled_at
           FROM rides WHERE id = $1`,
        [id],
      ),
      this.pool.query<{
        driver_id: string;
        name: string | null;
        offered_at: Date;
        response: AdminRideDetail['offers'][number]['response'];
        responded_at: Date | null;
        pickup_distance_km: number;
      }>(
        `SELECT o.driver_id, u.name, o.offered_at, o.response, o.responded_at,
                o.pickup_distance_km::float8 AS pickup_distance_km
           FROM ride_offers o JOIN users u ON u.id = o.driver_id
          WHERE o.ride_id = $1 ORDER BY o.offered_at`,
        [id],
      ),
    ]);
    const row = ride.rows[0];
    const x = extra.rows[0];
    if (!row || !x) throw new AppException(HttpStatus.NOT_FOUND, 'ride_not_found', 'No such ride');
    return {
      ...toRideSummary(row),
      durationMin: row.duration_min,
      pickup: { latitude: x.pickup_lat, longitude: x.pickup_lng },
      dropoff: { latitude: x.dropoff_lat, longitude: x.dropoff_lng },
      acceptedAt: iso(x.accepted_at),
      arrivedAt: iso(x.arrived_at),
      startedAt: iso(x.started_at),
      completedAt: iso(x.completed_at),
      cancelledAt: iso(x.cancelled_at),
      offers: offers.rows.map((o) => ({
        driverId: o.driver_id,
        driverName: o.name,
        offeredAt: o.offered_at.toISOString(),
        response: o.response,
        respondedAt: iso(o.responded_at),
        pickupDistanceKm: o.pickup_distance_km,
      })),
    };
  }

  async fareRates(): Promise<AdminFareRate[]> {
    const { rows } = await this.pool.query<FareRow>(
      `SELECT * FROM fare_rates ORDER BY city, array_position(ARRAY['bike', 'car'], vehicle_type)`,
    );
    return rows.map(toFareRate);
  }

  /** Changes apply to new fare quotes within a minute. Old and new values go to the audit log. */
  async updateFareRate(
    adminId: string,
    city: CityCode,
    vehicleType: VehicleType,
    body: z.output<typeof fareRateBodySchema>,
  ): Promise<AdminFareRate> {
    const client = await this.pool.connect();
    let updated: FareRow;
    let before: FareRow;
    try {
      await client.query('BEGIN');
      const old = await client.query<FareRow>(
        'SELECT * FROM fare_rates WHERE city = $1 AND vehicle_type = $2 FOR UPDATE',
        [city, vehicleType],
      );
      if (!old.rows[0]) {
        throw new AppException(HttpStatus.NOT_FOUND, 'fare_rate_not_found', 'No fare rate for this city and vehicle');
      }
      before = old.rows[0];
      const { rows } = await client.query<FareRow>(
        `UPDATE fare_rates SET base_fare = $3, per_km = $4, per_min = $5, minimum_fare = $6, avg_speed_kmh = $7,
                active = $8, updated_at = now()
          WHERE city = $1 AND vehicle_type = $2 RETURNING *`,
        [city, vehicleType, body.baseFare, body.perKm, body.perMin, body.minimumFare, body.avgSpeedKmh, body.active],
      );
      updated = rows[0]!;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const pick = (r: FareRow) => ({
      baseFare: r.base_fare,
      perKm: r.per_km,
      perMin: r.per_min,
      minimumFare: r.minimum_fare,
      avgSpeedKmh: r.avg_speed_kmh,
      active: r.active,
    });
    await this.audit.record(adminId, 'fare_rate.update', 'fare_rate', `${city}:${vehicleType}`, {
      before: pick(before),
      after: pick(updated),
    });
    this.fares.clearRatesCache();
    return toFareRate(updated);
  }
}
