import { z } from 'zod';
import { vehicleTypeSchema } from './fares';
import { haversineKm, type LatLng, latLngSchema } from './geo';

// ---------------------------------------------------------------------------
// Moving vehicle markers on the map (passenger and driver apps).
// Positions arrive every ~5 s. Instead of jumping, the marker glides there natively (no JS per frame,
// cheap on low-end phones) and turns to face the direction of travel.
// ---------------------------------------------------------------------------

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Compass direction from a to b: 0 = north, 90 = east. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const MARKER_MOTION = {
  /** Farther than this between two updates (GPS glitch, reconnect after a long gap): jump, don't glide. */
  jumpKm: 1,
  /** Older than this since the last update: jump. */
  staleMs: 60_000,
  /** Moved less than this: the GPS is just wobbling, stay put. */
  minMoveM: 3,
  /** Only work out the direction ourselves from moves at least this long (short ones point anywhere). */
  minTurnM: 8,
  minGlideMs: 400,
  maxGlideMs: 6_000,
} as const;

/** Where a marker is drawn and since when. */
export interface MarkerState {
  location: LatLng;
  /** Degrees, 0 = north. */
  heading: number;
  /** Phone time (ms) when this position arrived. */
  at: number;
}

export type MarkerMove =
  | { kind: 'jump'; heading: number }
  | { kind: 'glide'; heading: number; durationMs: number }
  | { kind: 'stay'; heading: number };

/**
 * How to get the marker from where it is to a new position.
 * Glide time = the time since the previous update, so the marker keeps moving until the next one arrives
 * (it trails the real car by one update, which looks natural). Heading: the phone's compass heading if it
 * sent one, otherwise the direction of the move, otherwise keep the old one.
 */
export function planMarkerMove(
  prev: MarkerState | null,
  next: { location: LatLng; heading: number | null | undefined },
  now: number,
): MarkerMove {
  if (!prev) return { kind: 'jump', heading: next.heading ?? 0 };
  const movedM = haversineKm(prev.location, next.location) * 1000;
  const heading =
    next.heading ?? (movedM >= MARKER_MOTION.minTurnM ? bearingDeg(prev.location, next.location) : prev.heading);
  const elapsed = now - prev.at;
  if (movedM > MARKER_MOTION.jumpKm * 1000 || elapsed > MARKER_MOTION.staleMs) return { kind: 'jump', heading };
  if (movedM < MARKER_MOTION.minMoveM) return { kind: 'stay', heading };
  const durationMs = Math.min(MARKER_MOTION.maxGlideMs, Math.max(MARKER_MOTION.minGlideMs, elapsed));
  return { kind: 'glide', heading, durationMs };
}

// ---------------------------------------------------------------------------
// Nearby drivers on the passenger's map before booking.
// ---------------------------------------------------------------------------

export const nearbyDriversQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
export type NearbyDriversQuery = z.input<typeof nearbyDriversQuerySchema>;

export const nearbyDriverSchema = z.object({
  /**
   * Stable for a day so the app can glide each marker, but not the driver's id: nobody can follow one driver
   * across days from it.
   */
  key: z.string(),
  vehicleType: vehicleTypeSchema,
  /** Rounded to about 10 m. */
  location: latLngSchema,
  heading: z.number().nullable(),
});
export type NearbyDriver = z.infer<typeof nearbyDriverSchema>;

export const nearbyDriversResponseSchema = z.object({ drivers: z.array(nearbyDriverSchema) });
export type NearbyDriversResponse = z.infer<typeof nearbyDriversResponseSchema>;

/** Show at most this many per vehicle type, within this radius of the passenger. */
export const NEARBY_DRIVERS = { radiusKm: 3, perVehicleType: 8 } as const;
