import { describe, expect, it } from 'vitest';
import { bearingDeg, MARKER_MOTION, type MarkerState, planMarkerMove } from './tracking';

const LIBERTY = { latitude: 31.5104, longitude: 74.3416 };
/** ~meters north / east of a point (good enough near Lahore). */
const north = (p: typeof LIBERTY, m: number) => ({ ...p, latitude: p.latitude + m / 111_000 });
const east = (p: typeof LIBERTY, m: number) => ({ ...p, longitude: p.longitude + m / 95_000 });

describe('bearingDeg', () => {
  it('points the right way', () => {
    expect(bearingDeg(LIBERTY, north(LIBERTY, 100))).toBeCloseTo(0, 0);
    expect(bearingDeg(LIBERTY, east(LIBERTY, 100))).toBeCloseTo(90, 0);
    expect(bearingDeg(north(LIBERTY, 100), LIBERTY)).toBeCloseTo(180, 0);
    expect(bearingDeg(east(LIBERTY, 100), LIBERTY)).toBeCloseTo(270, 0);
  });
});

describe('planMarkerMove', () => {
  const prev: MarkerState = { location: LIBERTY, heading: 45, at: 10_000 };

  it('jumps to the first position', () => {
    expect(planMarkerMove(null, { location: LIBERTY, heading: 120 }, 0)).toEqual({ kind: 'jump', heading: 120 });
    expect(planMarkerMove(null, { location: LIBERTY, heading: null }, 0)).toEqual({ kind: 'jump', heading: 0 });
  });

  it('glides for as long as the gap between updates, within limits', () => {
    const to = north(LIBERTY, 60);
    expect(planMarkerMove(prev, { location: to, heading: 10 }, 15_000)).toEqual({
      kind: 'glide',
      heading: 10,
      durationMs: 5_000,
    });
    expect(planMarkerMove(prev, { location: to, heading: 10 }, 10_100)).toMatchObject({
      durationMs: MARKER_MOTION.minGlideMs,
    });
    expect(planMarkerMove(prev, { location: to, heading: 10 }, 40_000)).toMatchObject({
      durationMs: MARKER_MOTION.maxGlideMs,
    });
  });

  it('works out the direction when the phone sends no heading', () => {
    const move = planMarkerMove(prev, { location: east(LIBERTY, 50), heading: null }, 15_000);
    expect(move.kind).toBe('glide');
    expect(move.heading).toBeCloseTo(90, 0);
    // A tiny move says nothing about direction: keep the old one.
    expect(planMarkerMove(prev, { location: east(LIBERTY, 5), heading: null }, 15_000).heading).toBe(45);
  });

  it('ignores GPS wobble', () => {
    expect(planMarkerMove(prev, { location: north(LIBERTY, 1), heading: null }, 15_000)).toEqual({
      kind: 'stay',
      heading: 45,
    });
  });

  it('jumps after a GPS glitch or a long gap instead of sliding across town', () => {
    expect(planMarkerMove(prev, { location: north(LIBERTY, 2_000), heading: 0 }, 15_000).kind).toBe('jump');
    expect(planMarkerMove(prev, { location: north(LIBERTY, 60), heading: 0 }, 10_000 + 61_000).kind).toBe('jump');
  });
});
