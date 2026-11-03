import { z } from 'zod';
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

export const driverApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'suspended']);
export type DriverApprovalStatus = z.infer<typeof driverApprovalStatusSchema>;

export const driverProfileSchema = z.object({
  /** null until the driver has told us what they drive. */
  vehicleType: vehicleTypeSchema.nullable(),
  approvalStatus: driverApprovalStatusSchema.nullable(),
  online: z.boolean(),
});
export type DriverProfile = z.infer<typeof driverProfileSchema>;

export const updateDriverProfileBodySchema = z.object({ vehicleType: vehicleTypeSchema });
export type UpdateDriverProfileBody = z.infer<typeof updateDriverProfileBodySchema>;

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
  /** driver → server: LatLng. Every few seconds while online. */
  driverLocation: 'driver:location',
} as const;

export const rideOfferCancelledSchema = z.object({ rideId: z.string().uuid() });
