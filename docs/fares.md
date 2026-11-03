# Fare estimate

`POST /fares/estimate` (signed in) with `{ pickup, dropoff }` (lat/lng) returns a **fixed** fare for every vehicle
type. There's no bargaining and no surge yet. The passenger pays exactly what they saw.

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

## Later

- Real road distance and traffic-aware time from a routing API (Google Directions / OSRM). Only
  `estimateRoadKm` / `estimateDurationMin` change.
- Rain mode (capped fares), fuel-indexed rates, airport fees: extra columns or rules on top of `calculateFare`.
- Editing rates in the admin panel.
