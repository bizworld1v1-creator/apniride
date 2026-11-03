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
  /** Fixed fare in whole Pakistani rupees: what the passenger pays (cash). No bargaining. */
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

/** Error codes from POST /fares/estimate. */
export const fareErrorCodeSchema = z.enum(['outside_service_area', 'trip_too_short', 'trip_too_long']);
export type FareErrorCode = z.infer<typeof fareErrorCodeSchema>;
