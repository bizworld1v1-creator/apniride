import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type CityCode,
  cityForPoint,
  type FareEstimateBody,
  type FareEstimateResponse,
  type FareOption,
  vehicleTypeSchema,
} from '@apniride/shared';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';
import {
  calculateFare,
  estimateDurationMin,
  estimateRoadKm,
  type FareRate,
  MAX_TRIP_KM,
  MIN_TRIP_KM,
} from './fare-calculator.js';

/** How long a quoted fare can be booked. */
export const QUOTE_TTL_SECONDS = 10 * 60;
/** Rates change rarely; re-read them from Postgres at most once a minute. */
const RATES_CACHE_MS = 60_000;

/** What we keep in Redis so booking can charge exactly the quoted fare. */
export interface StoredQuote {
  userId: string;
  city: CityCode;
  pickup: FareEstimateBody['pickup'];
  dropoff: FareEstimateBody['dropoff'];
  distanceKm: number;
  options: FareOption[];
  expiresAt: string;
}

const quoteKey = (id: string) => `fare:quote:${id}`;

@Injectable()
export class FaresService {
  private ratesCache = new Map<CityCode, { at: number; rates: FareRate[] }>();

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async estimate(userId: string, { pickup, dropoff }: FareEstimateBody): Promise<FareEstimateResponse> {
    const city = cityForPoint(pickup);
    if (!city || cityForPoint(dropoff) !== city) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'outside_service_area', 'We do not serve this area yet');
    }

    const distanceKm = estimateRoadKm(pickup, dropoff);
    if (distanceKm < MIN_TRIP_KM) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'trip_too_short', 'Pickup and drop-off are too close');
    }
    if (distanceKm > MAX_TRIP_KM) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'trip_too_long', 'Trip is too long for a city ride');
    }

    const rates = await this.ratesFor(city);
    if (rates.length === 0) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'outside_service_area', 'No rides available here yet');
    }

    const options = rates.map((rate): FareOption => {
      const durationMin = estimateDurationMin(distanceKm, rate.avgSpeedKmh);
      return { vehicleType: rate.vehicleType, fare: calculateFare(rate, distanceKm, durationMin), durationMin };
    });

    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString();
    const stored: StoredQuote = { userId, city, pickup, dropoff, distanceKm, options, expiresAt };
    await this.redis.set(quoteKey(quoteId), JSON.stringify(stored), 'EX', QUOTE_TTL_SECONDS);

    return { quoteId, expiresAt, city, currency: 'PKR', distanceKm, options };
  }

  /** For booking: the quote if it exists, hasn't expired and belongs to this user. */
  async getQuote(userId: string, quoteId: string): Promise<StoredQuote | null> {
    const raw = await this.redis.get(quoteKey(quoteId));
    if (!raw) return null;
    const quote = JSON.parse(raw) as StoredQuote;
    return quote.userId === userId ? quote : null;
  }

  /** Typical city speed for this vehicle type, for ETAs. Falls back to 20 km/h if the rate is missing. */
  async avgSpeedKmh(city: CityCode, vehicleType: FareRate['vehicleType']): Promise<number> {
    const rate = (await this.ratesFor(city)).find((r) => r.vehicleType === vehicleType);
    return rate?.avgSpeedKmh ?? 20;
  }

  private async ratesFor(city: CityCode): Promise<FareRate[]> {
    const cached = this.ratesCache.get(city);
    if (cached && Date.now() - cached.at < RATES_CACHE_MS) return cached.rates;

    const { rows } = await this.pool.query<{
      vehicle_type: string;
      base_fare: number;
      per_km: number;
      per_min: number;
      minimum_fare: number;
      avg_speed_kmh: number;
    }>(
      `SELECT vehicle_type, base_fare, per_km, per_min, minimum_fare, avg_speed_kmh
         FROM fare_rates WHERE city = $1 AND active
        ORDER BY array_position(ARRAY['bike', 'car'], vehicle_type)`,
      [city],
    );
    const rates = rows.map(
      (r): FareRate => ({
        vehicleType: vehicleTypeSchema.parse(r.vehicle_type),
        baseFare: r.base_fare,
        perKm: r.per_km,
        perMin: r.per_min,
        minimumFare: r.minimum_fare,
        avgSpeedKmh: r.avg_speed_kmh,
      }),
    );
    this.ratesCache.set(city, { at: Date.now(), rates });
    return rates;
  }
}
