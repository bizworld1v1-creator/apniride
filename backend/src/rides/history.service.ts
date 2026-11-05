import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type DriverEarnings,
  HISTORY_PAGE_SIZE,
  type Ride,
  type RideHistoryItem,
  type RideHistoryPage,
  type RideStatus,
} from '@apniride/shared';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';

/** Midnight today in Pakistan, whatever the server's time zone. */
const PK_TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')`;

/** Finished rides only: active ones are on the home screen. Drivers don't see rides nobody accepted. */
const FINISHED: Record<'passenger' | 'driver', readonly RideStatus[]> = {
  passenger: ['completed', 'cancelled', 'no_driver'],
  driver: ['completed', 'cancelled'],
};

interface HistoryRow {
  id: string;
  status: RideStatus;
  city: Ride['city'];
  vehicle_type: Ride['vehicleType'];
  fare: number;
  distance_km: number;
  duration_min: number;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  created_at: Date;
  /** created_at in whole microseconds since 1970, as text: exact, unlike a JS Date (milliseconds). */
  created_us: string;
  ended_at: Date | null;
  cancelled_by: Ride['cancelledBy'];
  driver_id: string | null;
  passenger_name: string | null;
  driver_name: string | null;
}

const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

/** "<microseconds>.<ride id>": the position after the last ride of a page (keyset pagination, newest first). */
const encodeCursor = (row: HistoryRow) => `${row.created_us}.${row.id}`;
function decodeCursor(cursor: string): { createdUs: string; id: string } {
  const match = /^(\d{1,20})\.([0-9a-f-]{36})$/i.exec(cursor);
  if (!match) throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_cursor', 'Invalid cursor');
  return { createdUs: match[1]!, id: match[2]! };
}

function toItem(r: HistoryRow): RideHistoryItem {
  return {
    id: r.id,
    status: r.status,
    city: r.city,
    vehicleType: r.vehicle_type,
    fare: r.fare,
    distanceKm: r.distance_km,
    durationMin: r.duration_min,
    pickup: { latitude: r.pickup_lat, longitude: r.pickup_lng },
    dropoff: { latitude: r.dropoff_lat, longitude: r.dropoff_lng },
    createdAt: r.created_at.toISOString(),
    endedAt: r.ended_at?.toISOString() ?? null,
    // First names only, never phone numbers (deleted accounts show an empty name).
    driver: r.driver_id ? { firstName: firstName(r.driver_name) } : null,
    passenger: { firstName: firstName(r.passenger_name) },
    cancelledBy: r.cancelled_by,
  };
}

@Injectable()
export class HistoryService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /** One page of the user's finished rides in this mode, newest first. */
  async page(mode: 'passenger' | 'driver', userId: string, cursor?: string): Promise<RideHistoryPage> {
    const column = mode === 'passenger' ? 'r.passenger_id' : 'r.driver_id';
    const after = cursor ? decodeCursor(cursor) : null;
    const params: unknown[] = [userId, FINISHED[mode], HISTORY_PAGE_SIZE + 1];
    let keyset = '';
    if (after) {
      params.push(after.createdUs, after.id);
      // Exact microseconds: 'epoch' + n µs, so no ride is skipped or repeated between pages.
      keyset = `AND (r.created_at, r.id) < (timestamptz 'epoch' + $4::bigint * interval '1 microsecond', $5::uuid)`;
    }
    const { rows } = await this.pool.query<HistoryRow>(
      `SELECT r.id, r.status, r.city, r.vehicle_type, r.fare, r.distance_km::float8 AS distance_km, r.duration_min,
              ST_Y(r.pickup::geometry) AS pickup_lat, ST_X(r.pickup::geometry) AS pickup_lng,
              ST_Y(r.dropoff::geometry) AS dropoff_lat, ST_X(r.dropoff::geometry) AS dropoff_lng,
              r.created_at, (extract(epoch FROM r.created_at) * 1000000)::bigint::text AS created_us,
              COALESCE(r.completed_at, r.cancelled_at) AS ended_at, r.cancelled_by, r.driver_id,
              p.name AS passenger_name, d.name AS driver_name
         FROM rides r
         JOIN users p ON p.id = r.passenger_id
         LEFT JOIN users d ON d.id = r.driver_id
        WHERE ${column} = $1 AND r.status = ANY($2) ${keyset}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $3`,
      params,
    );
    const more = rows.length > HISTORY_PAGE_SIZE;
    const pageRows = more ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
    return {
      rides: pageRows.map(toItem),
      nextCursor: more ? encodeCursor(pageRows[pageRows.length - 1]!) : null,
    };
  }

  /** Cash from completed rides: today, the last 7 days (incl. today) and all time, in Pakistan days. */
  async earnings(driverId: string): Promise<DriverEarnings> {
    const { rows } = await this.pool.query<{
      today_rides: number;
      today_cash: number;
      week_rides: number;
      week_cash: number;
      all_rides: number;
      all_cash: number;
    }>(
      `SELECT count(*) FILTER (WHERE completed_at >= ${PK_TODAY})::int AS today_rides,
              COALESCE(sum(fare) FILTER (WHERE completed_at >= ${PK_TODAY}), 0)::int AS today_cash,
              count(*) FILTER (WHERE completed_at >= ${PK_TODAY} - interval '6 days')::int AS week_rides,
              COALESCE(sum(fare) FILTER (WHERE completed_at >= ${PK_TODAY} - interval '6 days'), 0)::int AS week_cash,
              count(*)::int AS all_rides,
              COALESCE(sum(fare), 0)::int AS all_cash
         FROM rides
        WHERE driver_id = $1 AND status = 'completed'`,
      [driverId],
    );
    const r = rows[0]!;
    return {
      today: { rides: r.today_rides, cash: r.today_cash },
      last7Days: { rides: r.week_rides, cash: r.week_cash },
      allTime: { rides: r.all_rides, cash: r.all_cash },
    };
  }
}
