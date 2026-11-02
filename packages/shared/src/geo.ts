import { z } from 'zod';

export const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

/** Cities we operate in. Feature flags are keyed by city. */
export const cityCodeSchema = z.enum(['LHE']);
export type CityCode = z.infer<typeof cityCodeSchema>;

/** Default map centre per city (Lahore: Liberty Market area). */
export const CITY_CENTERS: Record<CityCode, LatLng> = {
  LHE: { latitude: 31.5104, longitude: 74.3416 },
};
