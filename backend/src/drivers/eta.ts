import type { LatLng } from '@apniride/shared';
import { estimateDurationMin, estimateRoadKm } from '../fares/fare-calculator.js';

/** Closer than this, the driver is effectively there: show "0 min" rather than "1 min". */
const ARRIVED_KM = 0.1;

/** Road distance and minutes from the driver to a target, using the same estimate as fares. */
export function etaTo(from: LatLng, to: LatLng, avgSpeedKmh: number): { distanceKm: number; etaMin: number } {
  const distanceKm = estimateRoadKm(from, to);
  return { distanceKm, etaMin: distanceKm < ARRIVED_KM ? 0 : estimateDurationMin(distanceKm, avgSpeedKmh) };
}
