import {
  calculateFare,
  estimateDurationMin,
  estimateRoadKm,
  type FareRate,
  ROAD_DETOUR_FACTOR,
  roundToTen,
} from './fare-calculator.js';

// Same numbers as the Lahore seed in migrations/0002_fare_rates.sql.
const BIKE: FareRate = { vehicleType: 'bike', baseFare: 60, perKm: 18, perMin: 2, minimumFare: 120, avgSpeedKmh: 26 };
const CAR: FareRate = { vehicleType: 'car', baseFare: 150, perKm: 45, perMin: 4, minimumFare: 300, avgSpeedKmh: 22 };

const LIBERTY = { latitude: 31.5104, longitude: 74.3416 };
const DATA_DARBAR = { latitude: 31.5799, longitude: 74.3093 };

describe('roundToTen', () => {
  it.each([
    [344, 340],
    [345, 350],
    [349.99, 350],
    [350, 350],
    [0, 0],
  ])('%d → %d', (input, expected) => {
    expect(roundToTen(input)).toBe(expected);
  });
});

describe('estimateRoadKm', () => {
  it('applies the detour factor and rounds to 1 decimal', () => {
    const km = estimateRoadKm(LIBERTY, DATA_DARBAR);
    expect(km).toBeCloseTo(8.33 * ROAD_DETOUR_FACTOR, 0);
    expect(Number.isInteger(km * 10)).toBe(true);
  });

  it('is 0 for the same point', () => {
    expect(estimateRoadKm(LIBERTY, LIBERTY)).toBe(0);
  });
});

describe('estimateDurationMin', () => {
  it('rounds up to whole minutes', () => {
    expect(estimateDurationMin(11, 22)).toBe(30); // exactly 30
    expect(estimateDurationMin(11.1, 22)).toBe(31); // 30.27 → 31
  });

  it('is at least 1 minute', () => {
    expect(estimateDurationMin(0, 22)).toBe(1);
  });
});

describe('calculateFare', () => {
  it('adds base + distance + time and rounds to Rs 10', () => {
    // Car, 11 km, 30 min: 150 + 495 + 120 = 765 → 770
    expect(calculateFare(CAR, 11, 30)).toBe(770);
    // Bike, 11 km, 26 min: 60 + 198 + 52 = 310
    expect(calculateFare(BIKE, 11, 26)).toBe(310);
  });

  it('never goes below the minimum fare', () => {
    expect(calculateFare(CAR, 0.5, 2)).toBe(300); // 150 + 22.5 + 8 = 180.5 → minimum 300
    expect(calculateFare(BIKE, 0.5, 2)).toBe(120); // 60 + 9 + 4 = 73 → minimum 120
  });

  it('is always a whole multiple of Rs 10 when the minimum is', () => {
    for (let km = 0.5; km <= 40; km += 0.7) {
      const fare = calculateFare(CAR, km, estimateDurationMin(km, CAR.avgSpeedKmh));
      expect(fare % 10).toBe(0);
    }
  });

  it('never decreases for a longer trip', () => {
    let last = 0;
    for (let km = 0.5; km <= 40; km += 0.1) {
      const fare = calculateFare(BIKE, km, estimateDurationMin(km, BIKE.avgSpeedKmh));
      expect(fare).toBeGreaterThanOrEqual(last);
      last = fare;
    }
  });

  it('makes a bike cheaper than a car for the same trip', () => {
    for (const km of [1, 5, 12, 30]) {
      const bike = calculateFare(BIKE, km, estimateDurationMin(km, BIKE.avgSpeedKmh));
      const car = calculateFare(CAR, km, estimateDurationMin(km, CAR.avgSpeedKmh));
      expect(bike).toBeLessThan(car);
    }
  });
});
