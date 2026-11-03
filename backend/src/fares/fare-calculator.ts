import { haversineKm, type LatLng, type VehicleType } from '@apniride/shared';

/** One row of fare_rates. Money in whole rupees. */
export interface FareRate {
  vehicleType: VehicleType;
  baseFare: number;
  perKm: number;
  perMin: number;
  minimumFare: number;
  avgSpeedKmh: number;
}

/**
 * Lahore roads are rarely straight: road distance ≈ 1.35 × straight-line distance.
 * Replace with a real routing API (Google Directions / OSRM) when we have one; the fare maths stays the same.
 */
export const ROAD_DETOUR_FACTOR = 1.35;
export const MIN_TRIP_KM = 0.5;
export const MAX_TRIP_KM = 60;

/** Estimated road distance in km, rounded to 1 decimal. */
export function estimateRoadKm(pickup: LatLng, dropoff: LatLng): number {
  return Math.round(haversineKm(pickup, dropoff) * ROAD_DETOUR_FACTOR * 10) / 10;
}

/** Estimated trip time in whole minutes (at least 1). */
export function estimateDurationMin(roadKm: number, avgSpeedKmh: number): number {
  return Math.max(1, Math.ceil((roadKm / avgSpeedKmh) * 60));
}

/** Cash-friendly: nearest Rs 10 (Rs 345 → 350, Rs 344 → 340). */
export function roundToTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

/**
 * Fixed fare = base + per-km + per-minute, never below the minimum fare, rounded to Rs 10.
 * The minimum is applied after rounding so a passenger never pays less than the advertised minimum.
 */
export function calculateFare(rate: FareRate, roadKm: number, durationMin: number): number {
  const raw = rate.baseFare + rate.perKm * roadKm + rate.perMin * durationMin;
  return Math.max(rate.minimumFare, roundToTen(raw));
}
