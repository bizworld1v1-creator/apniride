import { describe, expect, it } from 'vitest';
import { bookRideBodySchema } from './rides';
import { clampOffer, MAX_OFFER_MULTIPLIER, OFFER_STEP, offerRange } from './fares';

describe('passenger offer range', () => {
  it('starts at the recommended fare and allows up to twice it', () => {
    expect(offerRange(450)).toEqual({ min: 450, max: 900, step: OFFER_STEP });
    expect(MAX_OFFER_MULTIPLIER).toBe(2);
  });

  it('rounds the maximum up to Rs 10', () => {
    // A minimum fare that isn't a multiple of 10 still gets a round maximum.
    expect(offerRange(155).max).toBe(310);
    expect(offerRange(125).max).toBe(250);
    expect(offerRange(127).max).toBe(260);
  });

  it('never lets an offer go below the recommended fare or above the maximum', () => {
    expect(clampOffer(450, 300)).toBe(450);
    expect(clampOffer(450, 5000)).toBe(900);
    expect(clampOffer(450, Number.NaN)).toBe(450);
  });

  it('snaps offers to Rs 10 inside the range', () => {
    expect(clampOffer(450, 503)).toBe(500);
    expect(clampOffer(450, 506)).toBe(510);
    expect(clampOffer(155, 160)).toBe(160);
  });

  it('keeps the exact recommended fare even when it is not a multiple of 10', () => {
    expect(clampOffer(155, 155)).toBe(155);
    expect(clampOffer(155, 157)).toBe(160);
  });

  it('booking accepts an optional whole-rupee offer', () => {
    const quoteId = '7f1d8a52-36a4-4f0d-9a35-6f0b6f2c1e11';
    expect(bookRideBodySchema.safeParse({ quoteId, vehicleType: 'car' }).success).toBe(true);
    expect(bookRideBodySchema.safeParse({ quoteId, vehicleType: 'car', offeredFare: 500 }).success).toBe(true);
    expect(bookRideBodySchema.safeParse({ quoteId, vehicleType: 'car', offeredFare: 500.5 }).success).toBe(false);
    expect(bookRideBodySchema.safeParse({ quoteId, vehicleType: 'car', offeredFare: -10 }).success).toBe(false);
  });
});
