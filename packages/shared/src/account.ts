import { z } from 'zod';
import { latLngSchema } from './geo';
import { rideSchema } from './rides';

// ---------------------------------------------------------------------------
// Side menu: profile photo, account deletion, saved places, ride history, driver earnings
// ---------------------------------------------------------------------------

/** Same limit as driver documents. The app shrinks photos to ~100 KB before upload anyway. */
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

// Saved places ---------------------------------------------------------------

export const MAX_SAVED_PLACES = 20;

export const savedPlaceKindSchema = z.enum(['home', 'work', 'other']);
export type SavedPlaceKind = z.infer<typeof savedPlaceKindSchema>;

export const savedPlaceSchema = z.object({
  id: z.string().uuid(),
  kind: savedPlaceKindSchema,
  /** Named by the passenger (we don't look up addresses). Home / Work get a default label in the app. */
  label: z.string(),
  location: latLngSchema,
});
export type SavedPlace = z.infer<typeof savedPlaceSchema>;

/** Create or change a place. Saving a second Home / Work replaces the first one. */
export const savedPlaceBodySchema = z.object({
  kind: savedPlaceKindSchema,
  label: z.string().trim().min(1, 'label_required').max(40, 'label_too_long'),
  location: latLngSchema,
});
export type SavedPlaceBody = z.input<typeof savedPlaceBodySchema>;

export const savedPlacesResponseSchema = z.object({ places: z.array(savedPlaceSchema) });
export type SavedPlacesResponse = z.infer<typeof savedPlacesResponseSchema>;

// Ride history ---------------------------------------------------------------

export const HISTORY_PAGE_SIZE = 20;

/** A finished ride (completed, cancelled, or nobody accepted). Same shape as a live ride, plus when it ended. */
export const rideHistoryItemSchema = rideSchema.extend({
  /** When it was completed or cancelled; null for "no driver" rides. */
  endedAt: z.string().nullable(),
});
export type RideHistoryItem = z.infer<typeof rideHistoryItemSchema>;

export const rideHistoryPageSchema = z.object({
  rides: z.array(rideHistoryItemSchema),
  /** Pass as `cursor` to get the next (older) page; null when there are no more. */
  nextCursor: z.string().nullable(),
});
export type RideHistoryPage = z.infer<typeof rideHistoryPageSchema>;

export const rideHistoryQuerySchema = z.object({
  cursor: z.string().max(100).optional(),
});

// Driver earnings ------------------------------------------------------------

const earningsPeriodSchema = z.object({
  /** Completed rides. */
  rides: z.number().int(),
  /** Cash collected from passengers, in rupees (no commission is taken yet). */
  cash: z.number().int(),
});

/** Days are Pakistan time (Asia/Karachi), whatever the phone's clock says. */
export const driverEarningsSchema = z.object({
  today: earningsPeriodSchema,
  /** Today and the 6 days before it. */
  last7Days: earningsPeriodSchema,
  allTime: earningsPeriodSchema,
});
export type DriverEarnings = z.infer<typeof driverEarningsSchema>;

/** Error codes for this area (translated by the apps). */
export const accountErrorCodeSchema = z.enum([
  'label_required',
  'label_too_long',
  'too_many_places',
  'place_exists',
  'invalid_image',
  'file_too_large',
  'invalid_cursor',
]);
