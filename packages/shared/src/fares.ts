import { z } from 'zod';
import { cityCodeSchema, latLngSchema } from './geo';

/** What the passenger can book. Every car is AC (AC Guarantee). */
export const vehicleTypeSchema = z.enum(['bike', 'car']);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const fareEstimateBodySchema = z.object({
  pickup: latLngSchema,
  dropoff: latLngSchema,
});
export type FareEstimateBody = z.infer<typeof fareEstimateBodySchema>;

export const fareOptionSchema = z.object({
  vehicleType: vehicleTypeSchema,
  /**
   * Recommended fare in whole Pakistani rupees, from distance and time. It is also the **lowest** fare the passenger
   * may offer; they can raise it up to `offerRange(fare).max` (like inDrive). Paid in cash.
   */
  fare: z.number().int(),
  /** Estimated trip time in minutes for this vehicle type. */
  durationMin: z.number().int(),
});
export type FareOption = z.infer<typeof fareOptionSchema>;

export const fareEstimateResponseSchema = z.object({
  /** Pass this when booking so the passenger gets exactly the fare they saw. */
  quoteId: z.string(),
  /** ISO time after which the quote can't be booked any more. */
  expiresAt: z.string(),
  city: cityCodeSchema,
  currency: z.literal('PKR'),
  /** Estimated road distance in km (1 decimal). */
  distanceKm: z.number(),
  options: z.array(fareOptionSchema),
});
export type FareEstimateResponse = z.infer<typeof fareEstimateResponseSchema>;

// ---------------------------------------------------------------------------
// Passenger's own offer (like inDrive)
// ---------------------------------------------------------------------------

/** Offers move in steps of Rs 10. */
export const OFFER_STEP = 10;
/** Highest offer = recommended fare × this (rounded up to Rs 10). Stops typos like Rs 45,000. */
export const MAX_OFFER_MULTIPLIER = 2;

/**
 * What the passenger may offer for a trip: never below the distance-based recommended fare (so drivers are paid
 * fairly), at most twice that.
 */
export function offerRange(recommendedFare: number): { min: number; max: number; step: number } {
  const max = Math.ceil((recommendedFare * MAX_OFFER_MULTIPLIER) / OFFER_STEP) * OFFER_STEP;
  return { min: recommendedFare, max, step: OFFER_STEP };
}

/** Clamp an offer into the allowed range and snap it to Rs 10 (min and max themselves always allowed). */
export function clampOffer(recommendedFare: number, offer: number): number {
  const { min, max, step } = offerRange(recommendedFare);
  if (!Number.isFinite(offer) || offer <= min) return min;
  if (offer >= max) return max;
  return Math.min(max, Math.max(min, Math.round(offer / step) * step));
}

/** Error codes from POST /fares/estimate. */
export const fareErrorCodeSchema = z.enum(['outside_service_area', 'trip_too_short', 'trip_too_long']);
export type FareErrorCode = z.infer<typeof fareErrorCodeSchema>;
