# Project: ApniRide — Ride-Hailing App for Pakistan

Repo: https://github.com/bizworld1v1-creator/apniride

This file gives Claude Code the context for this project. Keep it updated as decisions change.

## Vision
Compete on **trust, not price**. Hero line: *"Thanda safar, mehfooz safar, waqt pe safar"*
(Cool ride, safe ride, on-time ride). Competitors: inDrive (fare bidding), Yango (fixed fares), Bykea (bikes), SheDrives / VSisters (women-only, small).

## Signature features (our differentiators)
1. **AC Guarantee** – passenger taps "AC off" mid-ride → automatic partial refund.
2. **Trip Black Box** – encrypted in-ride audio from driver phone, only decrypted when a complaint is filed.
3. **Ammi Mode** – book a ride for a family member without a smartphone; driver calls them, booker tracks live (targets overseas Pakistanis too).
4. **WhatsApp / missed-call booking** – no app needed.
5. **On-Time Promise** – automatic compensation if a scheduled/airport pickup is late.
6. **Masked phone numbers** – all calls go through the app; nobody sees real numbers.
7. **Female-driver option** in the main app (not a separate app).
8. **Route-deviation / early-drop detection** – alert + penalty if driver abandons ride or goes off route.

## Pakistan-specific touches (later phases)
Ramadan mode, namaz stop, shaadi/baraat fleet package, rain mode (crowd-reported flooded roads, capped fares), intercity seat booking, Urdu voice booking, fuel-indexed fares.

## Driver side
Low commission, daily payouts to JazzCash / Easypaisa, family health insurance after N rides, "Car Apna" lease-to-own, fuel discount cards. Verification: NADRA CNIC, police character certificate, live selfie before each shift, vehicle inspection.

## Rewards
Points per ride → mobile load, petrol, Daraz vouchers.

## Tech stack (decided – use this)
- **Monorepo:** Turborepo + pnpm workspaces
- **apps/passenger, apps/driver:** Expo (latest SDK) + TypeScript, Expo Router, EAS Build + EAS Update (OTA),
  react-native-maps (Google Maps on both Android and iOS), expo-location (background location in the driver app),
  TanStack Query, Zustand, React Hook Form + Zod, i18next (English + Urdu, RTL), Sentry
- **apps/admin:** Next.js + TypeScript (placeholder for now)
- **backend:** NestJS + TypeScript, PostgreSQL + PostGIS, Redis, Socket.IO (Redis adapter), BullMQ
- **packages/shared:** shared types, Zod schemas and the API client used by all apps
- **Local infra:** `docker-compose.yml` with PostgreSQL + PostGIS and Redis
- **Payments:** Cash first, then JazzCash / Easypaisa wallets

### Engineering priorities
- Optimise for **low-end Android phones and weak internet**: small bundles, few re-renders, cache with TanStack Query,
  retry/offline-tolerant requests, throttle location updates, avoid heavy animations.
- **Phone numbers stay masked** – never send a real phone number to the other party's app or log it.
- **Feature flags per city** – every new feature is switchable per city (e.g. Lahore on, Karachi off).

## Repo layout
```
/apps/passenger    Expo passenger app
/apps/driver       Expo driver app
/apps/admin        Next.js admin panel (placeholder)
/backend           NestJS API + Socket.IO server
/packages/shared   Shared types, Zod schemas, API client
/docs              Specs, decisions
docker-compose.yml PostgreSQL + PostGIS, Redis
```

## Version 1 scope (MVP – one city, e.g. Lahore)
- Phone OTP signup (passenger + driver)
- Driver onboarding with document upload + manual admin approval
- Book a ride (car + bike), fixed fare estimate, live tracking
- Masked calling, SOS button, share-trip link
- Female-driver option
- Ratings, complaints with tracked response time
- Cash payment
- Admin panel: approve drivers, view rides, handle complaints

## Conventions
- Commit small, descriptive commits. Never commit secrets – use `.env` files (gitignored).
- Write tests for fare calculation and matching logic.
- UI text must support English and Urdu (RTL).

## How we work
- **One feature per chunk.** Build it end to end (backend + both apps + tests + docs), commit, push, then
  **stop and ask** the owner before starting the next one.
- **After every chunk, update the Progress section below** (move the item to Done, set "Next up").
- Before declaring a chunk done: `pnpm typecheck`, `pnpm test`, `pnpm lint`, and
  `pnpm --filter @apniride/backend test:e2e` (needs `pnpm db:up`). Also run
  `npx expo export --platform android` in each app to confirm it bundles.
- Design notes live in `docs/` (auth.md, fares.md, rides.md). Keep them in sync with the code.

## Progress (last updated 2026-11-04)

### Done ✅
| Feature | Where | Notes |
| --- | --- | --- |
| Monorepo, docker-compose, `/health` | root, `backend/src/health` | Postgres + PostGIS, Redis |
| SQL migrations | `backend/migrations`, `pnpm db:migrate` | 0001 users/sessions, 0002 fare_rates, 0003 drivers/rides/ride_offers |
| Phone OTP sign-in (both apps) | `backend/src/auth`, `apps/*/src/app/sign-in, verify, complete-profile` | Dev SMS only (code shown in app + server log). See docs/auth.md |
| Fixed fare estimate (bike + car AC) | `backend/src/fares`, passenger `FareSheet` | **Lahore rates are placeholders, so the owner must set the real ones.** See docs/fares.md |
| Booking + dispatch (chunk 1 of rides) | `backend/src/rides`, `backend/src/drivers`, `backend/src/realtime` | Driver online → nearest driver gets a 15 s offer → accept → arrived → start → complete; cancel by either side; Socket.IO + BullMQ. See docs/rides.md |
| Passenger booking UI | `apps/passenger/src/app/index.tsx`, `RideStatusSheet` | Live status, cancel, "pay cash" |
| Driver ride UI | `apps/driver/src/app/index.tsx`, `OfferCard`, `ActiveRideCard`, `VehiclePicker` | Vibrates on offer, Google Maps navigation link |

Tests: 33 shared + 27 backend unit, 15 backend e2e (all passing at the last commit).
**Not yet tested by the owner on a real phone** for the sign-in, fare and booking flows.

### Next up ▶️
**Rides chunk 2: live tracking.** The passenger sees the driver's marker move on the map, with an ETA
("Bilal · 4 min away"). The driver location already reaches the server via `driver:location`
(`DriversService.updateLocation`). Still needed: forward it to the passenger's room while a ride is accepted /
arrived / in_progress (throttled), keep the last position in Redis for reconnects, plus a passenger map marker
and ETA.

### Still missing ❌ (V1 scope, rough order)
1. Live tracking (next up)
2. Driver onboarding: CNIC, licence, vehicle details + photos, document upload, gender (needed for the
   female-driver option), admin approval. Replaces `DRIVER_AUTO_APPROVE`.
3. Admin panel (`apps/admin` is a placeholder): approve drivers, view rides, handle complaints, edit fare rates
4. Masked calling (phone numbers never shared)
5. SOS button + share-trip link
6. Female-driver option for passengers
7. Ratings + complaints with tracked response time
8. Per-city feature flags (CLAUDE.md requires them; not built yet)
9. Real SMS provider (implement `SmsSender` in `backend/src/auth/sms.sender.ts`)
10. Development build (EAS) for background location and an offer sound while the driver app is closed

### Known limits / TODOs
- Expo Go only: no background location; offers only vibrate while the driver app is open.
- Road distance = straight line × 1.35 (no routing API yet).
- Driver cancellations / declines have no penalty yet.
- Auth screens are duplicated in both apps (`apps/*/src/app/sign-in.tsx` etc.).

### Local setup reminders
- Docker Desktop needs WSL 2. If it fails to start, run `wsl --update` as admin and reboot.
- Dev backend: `pnpm db:up && pnpm db:migrate && pnpm backend`. The laptop's LAN IP was `192.168.100.6`.
- `backend/.env` has dev-only flags: `OTP_DEV_ECHO=true`, `DRIVER_AUTO_APPROVE=true`. Never use them in production;
  env validation refuses them when `NODE_ENV=production`.
