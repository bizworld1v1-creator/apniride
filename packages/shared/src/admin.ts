import { z } from 'zod';
import {
  driverApprovalStatusSchema,
  driverDetailsSchema,
  driverDocumentSchema,
  driverDocumentTypeSchema,
  genderSchema,
} from './drivers';
import { vehicleTypeSchema } from './fares';
import { cityCodeSchema, latLngSchema } from './geo';
import { rideStatusSchema } from './rides';

// ---------------------------------------------------------------------------
// Admin panel API (/admin/*). Needs an access token from signing in with role "admin".
// Admins see full phone numbers (to call drivers and passengers for support). Never send them to the apps.
// ---------------------------------------------------------------------------

export const adminMeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  phoneMasked: z.string(),
});
export type AdminMe = z.infer<typeof adminMeSchema>;

export const adminStatsSchema = z.object({
  pendingDrivers: z.number().int(),
  approvedDrivers: z.number().int(),
  onlineDrivers: z.number().int(),
  activeRides: z.number().int(),
  /** "Today" = since midnight in Pakistan. */
  today: z.object({
    rides: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    noDriver: z.number().int(),
    /** Sum of completed fares, whole rupees. */
    completedFares: z.number().int(),
  }),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

/** One entry from the audit log, e.g. "Sana rejected this driver: CNIC blurry". */
export const auditEntrySchema = z.object({
  action: z.string(),
  adminName: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  at: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

// --- Drivers ---------------------------------------------------------------

export const adminDriverSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  phone: z.string(),
  status: driverApprovalStatusSchema,
  vehicleType: vehicleTypeSchema,
  gender: genderSchema.nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminDriverSummary = z.infer<typeof adminDriverSummarySchema>;

export const adminDriverDetailSchema = adminDriverSummarySchema.extend({
  details: driverDetailsSchema.nullable(),
  documents: z.array(driverDocumentSchema),
  missingDocuments: z.array(driverDocumentTypeSchema),
  /** False when the CNIC's last digit disagrees with the chosen gender: check the card closely. */
  cnicGenderMatches: z.boolean().nullable(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  /** Who approved / rejected / suspended, newest first. */
  history: z.array(auditEntrySchema),
});
export type AdminDriverDetail = z.infer<typeof adminDriverDetailSchema>;

export const adminDriverListQuerySchema = z.object({
  status: driverApprovalStatusSchema.optional(),
});

export const reviewNoteBodySchema = z.object({
  reason: z.string().trim().min(3, 'required').max(300, 'too_long'),
});
export type ReviewNoteBody = z.input<typeof reviewNoteBodySchema>;

// --- Rides -----------------------------------------------------------------

const person = z.object({ id: z.string().uuid(), name: z.string().nullable(), phone: z.string() });

export const adminRideSummarySchema = z.object({
  id: z.string().uuid(),
  status: rideStatusSchema,
  city: cityCodeSchema,
  vehicleType: vehicleTypeSchema,
  fare: z.number().int(),
  distanceKm: z.number(),
  passenger: person,
  driver: person.nullable(),
  cancelledBy: z.enum(['passenger', 'driver', 'system']).nullable(),
  createdAt: z.string(),
});
export type AdminRideSummary = z.infer<typeof adminRideSummarySchema>;

export const adminRideDetailSchema = adminRideSummarySchema.extend({
  durationMin: z.number().int(),
  pickup: latLngSchema,
  dropoff: latLngSchema,
  acceptedAt: z.string().nullable(),
  arrivedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  /** Every driver this ride was offered to, in order. */
  offers: z.array(
    z.object({
      driverId: z.string().uuid(),
      driverName: z.string().nullable(),
      offeredAt: z.string(),
      response: z.enum(['accepted', 'declined', 'expired', 'cancelled']).nullable(),
      respondedAt: z.string().nullable(),
      pickupDistanceKm: z.number(),
    }),
  ),
});
export type AdminRideDetail = z.infer<typeof adminRideDetailSchema>;

export const adminRideListQuerySchema = z.object({
  status: rideStatusSchema.optional(),
  /** Paging: rides created before this ISO time (the last createdAt of the previous page). */
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminRideListQuery = z.input<typeof adminRideListQuerySchema>;

// --- Fare rates ------------------------------------------------------------

const rupees = (max: number) =>
  z.coerce.number({ message: 'invalid_number' }).int('invalid_number').min(0, 'invalid_number').max(max, 'too_large');

/** PUT /admin/fare-rates/:city/:vehicleType. Whole rupees. */
export const fareRateBodySchema = z
  .object({
    baseFare: rupees(5000),
    perKm: rupees(1000),
    perMin: rupees(100),
    minimumFare: rupees(10000),
    avgSpeedKmh: z.coerce.number({ message: 'invalid_number' }).int('invalid_number').min(5, 'invalid_number').max(80, 'too_large'),
    active: z.boolean(),
  })
  .refine((r) => r.minimumFare >= r.baseFare, { message: 'minimum_below_base', path: ['minimumFare'] });
export type FareRateBody = z.input<typeof fareRateBodySchema>;

export const adminFareRateSchema = z.object({
  city: cityCodeSchema,
  vehicleType: vehicleTypeSchema,
  baseFare: z.number().int(),
  perKm: z.number().int(),
  perMin: z.number().int(),
  minimumFare: z.number().int(),
  avgSpeedKmh: z.number().int(),
  active: z.boolean(),
  updatedAt: z.string(),
  /** What passengers would pay for typical trips with these rates (road km → rupees). */
  examples: z.array(z.object({ km: z.number(), durationMin: z.number().int(), fare: z.number().int() })),
});
export type AdminFareRate = z.infer<typeof adminFareRateSchema>;

/** Error codes from the admin API the panel shows in words. */
export const adminErrorCodeSchema = z.enum([
  'not_admin',
  'invalid_driver_state',
  'driver_not_found',
  'ride_not_found',
  'fare_rate_not_found',
  'document_not_found',
  'invalid_number',
  'too_large',
  'minimum_below_base',
]);
