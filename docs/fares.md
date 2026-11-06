# Fare estimate

`POST /fares/estimate` (signed in) with `{ pickup, dropoff }` (lat/lng) returns the **fair price** (recommended fare)
for every vehicle type, from distance and time. Since 2026-11-07 the passenger **names their own price** like inDrive
(see "Passenger's offer" below); the fair price is the lowest they may offer. No surge yet.

```json
{ "quoteId": "…", "expiresAt": "…", "city": "LHE", "currency": "PKR", "distanceKm": 11.2,
  "options": [ { "vehicleType": "bike", "fare": 310, "durationMin": 26 },
               { "vehicleType": "car",  "fare": 780, "durationMin": 31 } ] }
```

## How the fare is calculated (`backend/src/fares/fare-calculator.ts`)

1. **Road distance** = straight-line distance × 1.35 (Lahore detour factor), 1 decimal.
2. **Trip time** = road distance ÷ the vehicle's average city speed, rounded up to whole minutes.
3. **Fare** = base + per-km × km + per-minute × minutes, rounded to the nearest **Rs 10**, never below the minimum fare.

Rates are stored per city and vehicle type in the `fare_rates` table. They're cached for 60 seconds, so a change in
the database takes effect within a minute without a deploy. **The Lahore rates in migration 0002 are placeholders.
Set the real ones before launch:**

| Vehicle | Base | Per km | Per min | Minimum | Avg speed |
| --- | --- | --- | --- | --- | --- |
| Bike | Rs 60 | Rs 18 | Rs 2 | Rs 120 | 26 km/h |
| Car (AC) | Rs 150 | Rs 45 | Rs 4 | Rs 300 | 22 km/h |

## Rules

- Pickup and drop-off must both be inside the same city's service area (Lahore: 35 km around Liberty Market) →
  otherwise `422 outside_service_area`.
- Trips must be 0.5–60 km by road → otherwise `trip_too_short` / `trip_too_long`.
- Every estimate is saved in Redis for **10 minutes** under its `quoteId`, together with the user id.
  Booking will take the `quoteId` and charge that exact fare (`FaresService.getQuote`), so the price can't
  change between seeing it and booking.

## Passenger's offer (like inDrive, owner decision 2026-11-07)

- The "Name your price" screen starts at the fair price. A slider and −Rs 20 / +Rs 20 / +Rs 50 buttons change it.
- Allowed: **fair price ≤ offer ≤ 2 × fair price** (rounded up to Rs 10), in steps of Rs 10. The rule lives in one
  place, `offerRange` / `clampOffer` in `packages/shared/src/fares.ts` (unit tests in `fares.test.ts`), used by the
  app and the server. Change `MAX_OFFER_MULTIPLIER` to allow more or less.
- `POST /rides` takes an optional `offeredFare`. Out of range → `400 offer_out_of_range`. Left out → the fair price.
  The ride's `fare` is the offer, so the driver sees and gets that price.
- A meter under the price lights 2–4 cars: fair price, ≥ +10 % "more drivers will want this ride", ≥ +25 % "drivers
  will rush to you". It is a hint only.
- Not yet: drivers counter-offering and the passenger choosing between several offers (the full bidding chunk).

## Later

- Real road distance and traffic-aware time from a routing API (Google Directions / OSRM). Only
  `estimateRoadKm` / `estimateDurationMin` change.
- Rain mode (capped fares), fuel-indexed rates, airport fees: extra columns or rules on top of `calculateFare`.
- Editing rates in the admin panel.
