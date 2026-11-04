# Booking and dispatch

## Ride lifecycle

```
            book (quoteId)
                 │
                 ▼
  ┌──────────► searching ──── nobody accepts in SEARCH_TIMEOUT_SECONDS ───► no_driver
  │              │
  │  driver      │ driver accepts the offer
  │  cancels     ▼
  └──────────  accepted ──► arrived ──► in_progress ──► completed
                 │             │
                 └─────────────┴──── passenger cancels ───► cancelled
```

- The fare is copied from the **quote** (see [fares.md](fares.md)). A quote can be booked once, and booking it
  again returns the same ride, so a double tap or a retry after a lost response is safe.
- One active ride per passenger and per driver, enforced by partial unique indexes in Postgres.
- The passenger can cancel until the trip starts (`searching`, `accepted`, `arrived`).
- When a **driver cancels** after accepting, the ride goes back to `searching` with `cancelledBy: "driver"`
  and is never offered to that driver again. The passenger keeps the booking and gets another driver.
- Driver steps are idempotent: repeating "arrived" / "start" / "complete" after a lost response returns the ride.

## Dispatch (`backend/src/rides/dispatch.service.ts`)

Sequential offers, nearest driver first:

1. Find online drivers of the right vehicle type within `MATCH_RADIUS_KM` (5 km) of the pickup (Redis `GEOSEARCH`).
2. Skip anyone already tried for this ride, offline, silent for over 90 s (no heartbeat), on a ride, or already
   looking at another offer. The check and the reservation happen in one Lua script, so two rides can't grab
   the same driver.
3. Send the offer to that one driver (`ride:offer`). They have `OFFER_TIMEOUT_SECONDS` (15 s) to accept.
4. Decline or timeout → next driver. Nobody available → look again every 5 s until `SEARCH_TIMEOUT_SECONDS`
   (2 min) → `no_driver`.

The timers are **BullMQ** delayed jobs, so they survive an API restart and work across several API instances.
An offer is a Redis key, `ride:offer:<rideId>` = driverId. Accept, decline, timeout and passenger-cancel each
take it with an atomic compare-and-delete, so **exactly one** wins, even when "Accept" is tapped in the last
millisecond.

Every offer and its outcome (`accepted` / `declined` / `expired` / `cancelled`) is stored in `ride_offers`
for disputes and acceptance-rate stats.

## Driver presence (`backend/src/drivers/drivers.service.ts`)

| Redis key | Meaning |
| --- | --- |
| `drv:online:<id>` | Online, with city + vehicle type |
| `drv:geo:<city>:<vehicle>` | Geo index of online drivers |
| `drv:hb:<id>` (90 s TTL) | Heartbeat, refreshed by every location update |
| `drv:offer:<id>` | The ride this driver is being offered |
| `drv:ride:<id>` | The ride this driver is doing (busy) |

The driver app sends its location over Socket.IO every 5 s / 25 m while online, plus every 30 s when parked.

## API

Passenger (passenger-app token):

| | |
| --- | --- |
| `POST /rides` `{ quoteId, vehicleType }` | Book → ride in `searching` |
| `GET /rides/current` | `{ ride }`: the active ride or null |
| `GET /rides/:id` | Any ride you were part of (passenger or driver) |
| `POST /rides/:id/cancel` | Cancel (idempotent) |

Driver (driver-app token):

| | |
| --- | --- |
| `GET /driver/me` | `{ vehicleType, approvalStatus, online }`. Registration and approval: see [drivers.md](drivers.md) |
| `POST /driver/online` `{ location }`, `POST /driver/offline` | Start / stop receiving offers |
| `GET /driver/current` | `{ offer, ride }`. Call on app start and after reconnecting |
| `POST /driver/rides/:id/accept` · `decline` · `arrived` · `start` · `complete` · `cancel` | |

Errors the apps translate: `quote_expired`, `active_ride_exists`, `offer_expired`, `invalid_ride_state`,
`ride_not_found`, `driver_not_approved`, `vehicle_not_set`, `on_a_ride`, `outside_service_area`, `wrong_app`.

## Realtime (Socket.IO on the API port)

Connect with `auth: { token: <access token> }`. A bad or expired token fails with `connect_error: "unauthorized"`;
the apps refresh the token and reconnect. Each user joins a private room per app (`passenger:<id>`,
`driver:<id>`). Through the **Redis adapter**, an event emitted by any API instance or BullMQ worker reaches
the phone.

| Event | Direction | Payload |
| --- | --- | --- |
| `ride:offer` | server → driver | `RideOffer`, with `expiresInSeconds` (count down from receipt: phone clocks are often wrong) |
| `ride:offer_cancelled` | server → driver | `{ rideId }`: expired or the passenger cancelled |
| `ride:update` | server → passenger + driver | `Ride`, on every status change |
| `driver:location` | driver → server | `{ latitude, longitude, heading? }` |
| `ride:driver_location` | server → passenger + that ride's driver | `DriverPosition`: `{ rideId, location, heading, etaMin, distanceKm, ageSeconds }` (the driver uses it for "5 min to pickup") |

**Weak networks:** events are only a fast path. After every (re)connect both apps re-read
`/rides/current` or `/driver/current`, and if a ride ended while they were offline they fetch its final state.
Socket.IO's connection-state recovery also replays events missed during short drops (up to 2 minutes).

## Live tracking (`backend/src/drivers/tracking.service.ts`)

- The driver app sends its position every 5 s / 25 m (and every 30 s when parked) while **online or on a ride**.
- Every position is saved as `drv:loc:<driverId>` (3 min TTL). If the driver is on a ride (`drv:ride:<id>`),
  it is forwarded to **that ride's passenger only**, as `ride:driver_location`, with an ETA:
  - `accepted` / `arrived`: to the **pickup**
  - `in_progress`: to the **destination**
- ETA = road distance (straight line × 1.35) ÷ the vehicle's average city speed from `fare_rates`; under 100 m = 0 min.
- Per-ride info (passenger, pickup, destination, phase) is kept in `ride:track:<rideId>` from accept until
  complete / cancel, so a location update needs no database query.
- `GET /rides/:id/driver-location` → `{ position }` for a passenger who reconnects. `ageSeconds` says how old it
  is (the app shows "last updated N min ago" after 60 s instead of trusting a stale ETA).
- **Privacy:** outside the passenger's own active ride, nothing is forwarded and the endpoint returns null.
  Another passenger gets 404.

## Vehicle markers and smooth movement

- Drivers show as **top-down car / bike images** (`apps/*/assets/vehicles/`, drawn in `design/vehicles/*.svg`,
  rendered with `pnpm render:vehicles`). To use a designer's art: replace the SVGs (same size, front pointing up)
  and re-render, or drop in PNGs at 1x/2x/3x (car 32×56 dp, bike 24×48 dp).
- **Glide:** each new position is reached with the map's own animation (`animateMarkerToCoordinate`), lasting as
  long as the gap since the previous update (0.4–6 s). No JavaScript runs per frame, so cheap phones stay smooth.
  The marker trails the real car by one update, as in other ride apps.
- **Jump** instead after a GPS glitch (> 1 km) or a long gap (> 60 s); **stay** for GPS wobble under 3 m.
- **Turning:** the phone's compass heading, else the direction of the move (if ≥ 8 m), else the last one.
  Google Maps (Android, iPhone builds with a key) rotates the image natively; on Apple Maps the image is rotated
  in a small view.
- The rules live in `planMarkerMove` (`packages/shared/src/tracking.ts`, unit-tested); both apps use the same
  `VehicleMarker` component.
- **Driver app:** their own car / bike replaces the blue dot (glides at most 0.8 s, since the camera follows them),
  and the ride card shows "About 4 min · 1.3 km to pickup / to the destination".

## Nearby drivers (before booking)

`GET /drivers/nearby?latitude=&longitude=` (passenger token) → `{ drivers: [{ key, vehicleType, location, heading }] }`.

- Up to 8 per vehicle type within 3 km, only drivers who are online, heard from in the last 90 s and not on a ride.
- **Privacy:** no ids or names; `key` is a hash that changes every day (so the app can glide each marker, but
  nobody can follow one driver from day to day); positions rounded to ~11 m.
- The passenger app asks every 10 s for the area the map shows (snapped to ~100 m so small pans don't refetch),
  only while the app is on screen and no ride is booked. About 1 KB per request.

## Privacy

Apps get **first names only** and never a phone number. Masked calling comes as its own feature.

## Not done yet

- ETA from a real routing/traffic API (today: straight line × 1.35 at an average speed).
- Masked calling, SOS and share-trip.
- Female-driver option (needs driver gender from onboarding).
- Penalties for driver cancellations and declines; ratings.
- Background location in the driver app (needs a development build, not Expo Go).
- A notification sound for offers. Today they vibrate, and only while the app is open.
