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
  /** Fare in rupees the passenger offered (at least the recommended fare of the quote). Paid in cash. */
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
  /**
   * The passenger's own price (like inDrive), within `offerRange(recommended fare)`. Leave out to book at the
   * recommended fare. Out of range → 400 `offer_out_of_range`.
   */
  offeredFare: z.number().int().positive().optional(),
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

/** The driver's own bid on a request, while the passenger is choosing. */
export const ownBidSchema = z.object({
  fare: z.number().int(),
  /** Seconds the passenger still has to choose this bid. */
  expiresInSeconds: z.number().int(),
});
export type OwnBid = z.infer<typeof ownBidSchema>;

/**
 * A ride request sent to a driver (like inDrive: to several drivers at once). Until expiresAt the driver can accept the
 * passenger's price, counter-offer (`counterOffers(fare)`), or decline. After bidding, `bid` is set and the passenger
 * chooses; the request then ends with a ride update (chosen) or `ride:offer_cancelled` (someone else / expired).
 */
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
  /** This driver's bid, once sent (then `expiresInSeconds` counts down the bid instead of the request). */
  bid: ownBidSchema.nullable().default(null),
});
export type RideOffer = z.infer<typeof rideOfferSchema>;

/** Driver → server: accept the passenger's price (fare = the offer) or counter-offer. */
export const driverBidBodySchema = z.object({ fare: z.number().int().positive() });
export type DriverBidBody = z.infer<typeof driverBidBodySchema>;

/**
 * A driver's answer, as the passenger sees it (offers deck). No ids or phone numbers of the driver: `bidId` is only
 * for choosing.
 */
export const bidSchema = z.object({
  bidId: z.string().uuid(),
  fare: z.number().int(),
  /** "accepted": at the passenger's price. "counter": higher. */
  kind: z.enum(['accepted', 'counter']),
  /** Seconds left to choose it (count down from this; phone clocks are often wrong). */
  expiresInSeconds: z.number().int(),
  driver: z.object({
    firstName: z.string(),
    /** e.g. "Honda City" (make + model), null if not known. Never the number plate before choosing. */
    vehicle: z.string().nullable(),
  }),
  pickupDistanceKm: z.number(),
  /** Estimated minutes for the driver to reach the pickup. */
  etaMin: z.number().int(),
});
export type Bid = z.infer<typeof bidSchema>;

/** The open bids on a ride, newest last. Also pushed to the passenger as `ride:bids` whenever they change. */
export const rideBidsSchema = z.object({ rideId: z.string().uuid(), bids: z.array(bidSchema) });
export type RideBids = z.infer<typeof rideBidsSchema>;

export const chooseBidBodySchema = z.object({ bidId: z.string().uuid() });
export type ChooseBidBody = z.infer<typeof chooseBidBodySchema>;

/** Why a request left the driver's screen. */
export const offerClosedReasonSchema = z.enum(['expired', 'taken', 'cancelled']);
export type OfferClosedReason = z.infer<typeof offerClosedReasonSchema>;

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
  /** server → driver: RideOffer (a new request, or the same one with the driver's bid). */
  rideOffer: 'ride:offer',
  /** server → driver: { rideId, reason: OfferClosedReason }. Expired, another driver was chosen, or the passenger cancelled. */
  rideOfferCancelled: 'ride:offer_cancelled',
  /** server → passenger: RideBids. The drivers' answers while searching (offers deck). */
  rideBids: 'ride:bids',
  /** server → passenger and driver: Ride (any status change) */
  rideUpdate: 'ride:update',
  /** driver → server: DriverLocationUpdate. Every few seconds while online or on a ride. */
  driverLocation: 'driver:location',
  /** server → passenger and driver: DriverPosition (with ETA). Only for that ride's passenger and its driver. */
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
