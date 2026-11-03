import { describe, expect, it } from 'vitest';
import { CITY_CENTERS, cityForPoint, haversineKm } from './geo';

const LIBERTY = CITY_CENTERS.LHE;
const DATA_DARBAR = { latitude: 31.5799, longitude: 74.3093 };
const KARACHI = { latitude: 24.8607, longitude: 67.0011 };

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(LIBERTY, LIBERTY)).toBe(0);
  });

  it('measures Liberty Market → Data Darbar (~8.3 km straight line)', () => {
    expect(haversineKm(LIBERTY, DATA_DARBAR)).toBeCloseTo(8.3, 0);
  });

  it('is symmetric', () => {
    expect(haversineKm(LIBERTY, KARACHI)).toBeCloseTo(haversineKm(KARACHI, LIBERTY), 9);
  });

  it('measures Lahore → Karachi (~1,030 km)', () => {
    expect(haversineKm(LIBERTY, KARACHI)).toBeGreaterThan(1000);
    expect(haversineKm(LIBERTY, KARACHI)).toBeLessThan(1060);
  });
});

describe('cityForPoint', () => {
  it('finds Lahore for points inside the service area', () => {
    expect(cityForPoint(LIBERTY)).toBe('LHE');
    expect(cityForPoint(DATA_DARBAR)).toBe('LHE');
  });

  it('returns null outside every service area', () => {
    expect(cityForPoint(KARACHI)).toBeNull();
  });
});
