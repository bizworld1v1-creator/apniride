import { z } from 'zod';
import { driverApprovalStatusSchema } from './drivers';
import { vehicleTypeSchema } from './fares';
import { cityCodeSchema, latLngSchema } from './geo';

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------

/**
 * searching → accepted → arrived → in_progress → completed
 * Any active state → cancelled. searching → no_driver (nobody accepted in time).
 * If the driver cancels before pickup, the ride goes back to searching for another driver.
 */
export const rideStatusSchema = z.enum([
  'searching',
  'accepted',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_driver',
]);
export type RideStatus = z.infer<typeof rideStatusSchema>;

export const ACTIVE_RIDE_STATUSES = ['searching', 'accepted', 'arrived', 'in_progress'] as const satisfies readonly RideStatus[];
export const isActiveRide = (status: RideStatus) => (ACTIVE_RIDE_STATUSES as readonly RideStatus[]).includes(status);

export const rideSchema = z.object({
  id: z.string().uuid(),
  status: rideStatusSchema,
  city: cityCodeSchema,
  vehicleType: vehicleTypeSchema,
  /** Fixed fare in rupees, from the quote the passenger booked. Paid in cash. */
  fare: z.number().int(),
  distanceKm: z.number(),
  durationMin: z.number().int(),
  pickup: latLngSchema,
  dropoff: latLngSchema,
  createdAt: z.string(),
  /** First names only. Phone numbers are never shared (masked calling comes later). */
  driver: z.object({ firstName: z.string() }).nullable(),
  passenger: z.object({ firstName: z.string() }),
  cancelledBy: z.enum(['passenger', 'driver', 'system']).nullable(),
});
export type Ride = z.infer<typeof rideSchema>;

export const bookRideBodySchema = z.object({
  quoteId: z.string().uuid(),
  vehicleType: vehicleTypeSchema,
});
export type BookRideBody = z.infer<typeof bookRideBodySchema>;

export const currentRideResponseSchema = z.object({ ride: rideSchema.nullable() });
export type CurrentRideResponse = z.infer<typeof currentRideResponseSchema>;

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export const driverProfileSchema = z.object({
  /** null until the driver has saved their onboarding details. */
  vehicleType: vehicleTypeSchema.nullable(),
  /** "incomplete" until they submit the onboarding application. Only "approved" drivers can go online. */
  approvalStatus: driverApprovalStatusSchema,
  online: z.boolean(),
});
export type DriverProfile = z.infer<typeof driverProfileSchema>;

export const goOnlineBodySchema = z.object({ location: latLngSchema });
export type GoOnlineBody = z.infer<typeof goOnlineBodySchema>;

/** A ride offered to one driver, who has until expiresAt to accept. */
export const rideOfferSchema = z.object({
  rideId: z.string().uuid(),
  expiresAt: z.string(),
  /** Seconds left when this was sent. Count down from this, not from expiresAt: phone clocks are often wrong. */
  expiresInSeconds: z.number().int(),
  vehicleType: vehicleTypeSchema,
  fare: z.number().int(),
  distanceKm: z.number(),
  durationMin: z.number().int(),
  pickup: latLngSchema,
  dropoff: latLngSchema,
  /** Straight-line distance from the driver to the pickup. */
  pickupDistanceKm: z.number(),
  passengerFirstName: z.string(),
});
export type RideOffer = z.infer<typeof rideOfferSchema>;

/** What the driver app needs after (re)connecting: a pending offer and/or the ride in progress. */
export const driverCurrentResponseSchema = z.object({
  offer: rideOfferSchema.nullable(),
  ride: rideSchema.nullable(),
});
export type DriverCurrentResponse = z.infer<typeof driverCurrentResponseSchema>;

// ---------------------------------------------------------------------------
// Realtime (Socket.IO). Connect to the API URL with auth: { token: <access token> }.
// ---------------------------------------------------------------------------

export const SOCKET_EVENTS = {
  /** server → driver: RideOffer */
  rideOffer: 'ride:offer',
  /** server → driver: { rideId }. The offer expired or the passenger cancelled. */
  rideOfferCancelled: 'ride:offer_cancelled',
  /** server → passenger and driver: Ride (any status change) */
  rideUpdate: 'ride:update',
  /** driver → server: DriverLocationUpdate. Every few seconds while online or on a ride. */
  driverLocation: 'driver:location',
  /** server → passenger: DriverPosition. Only for the passenger's own active ride. */
  rideDriverLocation: 'ride:driver_location',
  /** server → driver: { status }. An admin approved, rejected or suspended this driver. */
  driverReviewed: 'driver:reviewed',
} as const;

/** What the driver app sends. heading = compass degrees (0 = north), null if unknown. */
export const driverLocationUpdateSchema = latLngSchema.extend({
  heading: z.number().min(0).max(360).nullable().optional(),
});
export type DriverLocationUpdate = z.infer<typeof driverLocationUpdateSchema>;

/** Where the passenger's driver is, and how long until they reach the pickup (or the destination once on board). */
export const driverPositionSchema = z.object({
  rideId: z.string().uuid(),
  location: latLngSchema,
  heading: z.number().nullable(),
  /** Estimated minutes to the pickup (accepted / arrived) or to the destination (in_progress). */
  etaMin: z.number().int(),
  /** Estimated road km to the same target. */
  distanceKm: z.number(),
  /** How old this position is, in seconds (0 for live updates). Use instead of clocks, which differ per phone. */
  ageSeconds: z.number().int(),
});
export type DriverPosition = z.infer<typeof driverPositionSchema>;

export const driverPositionResponseSchema = z.object({ position: driverPositionSchema.nullable() });

export const rideOfferCancelledSchema = z.object({ rideId: z.string().uuid() });
