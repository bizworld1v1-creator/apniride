import { z } from 'zod';

export const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

/** Cities we operate in. Feature flags and fare rates are keyed by city. */
export const cityCodeSchema = z.enum(['LHE']);
export type CityCode = z.infer<typeof cityCodeSchema>;

/** Default map centre per city (Lahore: Liberty Market area). */
export const CITY_CENTERS: Record<CityCode, LatLng> = {
  LHE: { latitude: 31.5104, longitude: 74.3416 },
};

/** Rough service area: a circle around the centre (Lahore incl. DHA, Raiwind Rd, Shahdara). */
export const CITY_SERVICE_RADIUS_KM: Record<CityCode, number> = {
  LHE: 35,
};

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line ("as the crow flies") distance between two points, in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The city whose service area contains this point, or null if we don't operate there. */
export function cityForPoint(point: LatLng): CityCode | null {
  for (const city of cityCodeSchema.options) {
    if (haversineKm(point, CITY_CENTERS[city]) <= CITY_SERVICE_RADIUS_KM[city]) return city;
  }
  return null;
}
