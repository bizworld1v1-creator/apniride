import { etaTo } from './eta.js';

const LIBERTY = { latitude: 31.5104, longitude: 74.3416 };

describe('etaTo', () => {
  it('is 0 min when the driver is at the target', () => {
    expect(etaTo(LIBERTY, LIBERTY, 22)).toEqual({ distanceKm: 0, etaMin: 0 });
    const nextDoor = { latitude: LIBERTY.latitude + 0.0003, longitude: LIBERTY.longitude };
    expect(etaTo(nextDoor, LIBERTY, 22).etaMin).toBe(0);
  });

  it('estimates minutes from road distance and speed', () => {
    // ~1.11 km straight north → 1.5 km by road → at 22 km/h ≈ 4.1 min → 5
    const north = { latitude: LIBERTY.latitude + 0.01, longitude: LIBERTY.longitude };
    const { distanceKm, etaMin } = etaTo(north, LIBERTY, 22);
    expect(distanceKm).toBe(1.5);
    expect(etaMin).toBe(5);
  });

  it('is shorter for a faster vehicle', () => {
    const far = { latitude: LIBERTY.latitude + 0.05, longitude: LIBERTY.longitude };
    expect(etaTo(far, LIBERTY, 26).etaMin).toBeLessThan(etaTo(far, LIBERTY, 22).etaMin);
  });
});
