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

/** A driver's counter-offers: the passenger's offer + 10 %, + 20 %, + 30 % (rounded up to Rs 10, each at least Rs 10 more). */
export const COUNTER_OFFER_PERCENT = [10, 20, 30] as const;

export function counterOffers(offer: number): number[] {
  const out: number[] = [];
  let last = offer;
  for (const percent of COUNTER_OFFER_PERCENT) {
    // Whole numbers only (offer × 110 / 1000), so 100 + 10 % is exactly 110, not 110.00000000000001.
    const raised = Math.ceil((offer * (100 + percent)) / (100 * OFFER_STEP)) * OFFER_STEP;
    const next = Math.max(last + OFFER_STEP, raised);
    out.push(next);
    last = next;
  }
  return out;
}

/** What a driver may bid on a request: the passenger's own price, or one of the counter-offers. */
export function isAllowedBid(offer: number, bid: number): boolean {
  return bid === offer || counterOffers(offer).includes(bid);
}

/** Error codes from POST /fares/estimate. */
export const fareErrorCodeSchema = z.enum(['outside_service_area', 'trip_too_short', 'trip_too_long']);
export type FareErrorCode = z.infer<typeof fareErrorCodeSchema>;
