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
- **One theme:** colours, font sizes/weights, spacing, corners, shadows, borders, opacity and tap sizes come only
  from `packages/shared/src/theme.ts` (both apps, the
  admin CSS and the app icon/splash). Never hard-code them in a component. See docs/theme.md.

## How we work
- **One feature per chunk.** Build it end to end (backend + both apps + tests + docs), commit, push, then
  **stop and ask** the owner before starting the next one.
- **After every chunk, update the Progress section below** (move the item to Done, set "Next up").
- Before declaring a chunk done: `pnpm typecheck`, `pnpm test`, `pnpm lint`, and
  `pnpm --filter @apniride/backend test:e2e` (needs `pnpm db:up`). Also run
  `npx expo export --platform android` in each app to confirm it bundles.
- Design notes live in `docs/` (auth.md, fares.md, rides.md, drivers.md, admin.md, running-on-devices.md, theme.md). Keep them in sync with the code.

## Progress (last updated 2026-11-06, after the unified theme + text/spacing tokens)

### Done ✅
| Feature | Where | Notes |
| --- | --- | --- |
| Monorepo, docker-compose, `/health` | root, `backend/src/health` | Postgres + PostGIS, Redis |
| SQL migrations | `backend/migrations`, `pnpm db:migrate` | 0001 users/sessions, 0002 fare_rates, 0003 drivers/rides/ride_offers, 0004 driver onboarding, 0005 admins + audit log |
| Phone OTP sign-in (both apps) | `backend/src/auth`, `apps/*/src/app/sign-in, verify, complete-profile` | Dev SMS only (code shown in app + server log). See docs/auth.md |
| Fixed fare estimate (bike + car AC) | `backend/src/fares`, passenger `FareSheet` | **Lahore rates are placeholders, so the owner must set the real ones.** See docs/fares.md |
| Booking + dispatch (chunk 1 of rides) | `backend/src/rides`, `backend/src/drivers`, `backend/src/realtime` | Driver online → nearest driver gets a 15 s offer → accept → arrived → start → complete; cancel by either side; Socket.IO + BullMQ. See docs/rides.md |
| Passenger booking UI | `apps/passenger/src/app/index.tsx`, `RideStatusSheet` | Live status, cancel, "pay cash" |
| Driver ride UI | `apps/driver/src/app/index.tsx`, `OfferCard`, `ActiveRideCard` | Vibrates on offer, Google Maps navigation link |
| Run on any device guide | `docs/running-on-devices.md`, `apps/*/src/lib/map-provider.ts` | Android/iPhone (Expo Go), emulator, simulator, tunnels, EAS APK. iPhone uses Apple Maps unless a build has an iOS Google key |
| Live tracking + ETA (chunk 2 of rides) | `backend/src/drivers/tracking.service.ts`, passenger `VehicleMarker`, `lib/driver-position.ts` | Driver position forwarded only to that ride's passenger; ETA to pickup, then to destination; "last updated" when stale |
| Driver onboarding + approval | `backend/src/drivers/onboarding.*`, `backend/src/admin`, `backend/src/storage`, driver `app/onboarding*.tsx`, `DocumentRow`, `DriverStatusCard` | Gender, CNIC (one account per CNIC), licence, vehicle + 6 required photos (police certificate optional). incomplete → pending → approved / rejected (reason, fix, resubmit) / suspended. Reviewed in the admin panel. `DRIVER_AUTO_APPROVE` removed. See docs/drivers.md |
| Vehicle markers + smooth tracking | `apps/*/src/components/VehicleMarker.tsx`, `design/vehicles`, `packages/shared/src/tracking.ts`, `backend/src/drivers/nearby-drivers.*` | Top-down car / bike images that glide natively and turn with the heading; nearby drivers on the passenger map before booking (privacy-safe); driver sees own vehicle + ETA. See docs/rides.md |
| Admin panel | `apps/admin`, `backend/src/admin`, `pnpm admins` | Phone-OTP sign-in for numbers on the `admins` list only; tokens in httpOnly cookies on the Next.js server. Dashboard, drivers (photos, approve/reject/suspend), rides (detail + offers), fare rates (with example fares). Audit log of every change. English only. See docs/admin.md |
| Unified theme | `packages/shared/src/theme.ts`, `apps/*/src/lib/theme.ts`, admin `layout.tsx` + `globals.css` | One file for every colour, font size/weight, spacing step (`space[n]` = n × 4 px), corner, shadow, border, opacity and tap size in all three apps (admin gets CSS variables). Per-app brand colour (passenger teal, driver/admin amber). Looks exactly as before. See docs/theme.md |

Tests: 89 shared + 32 backend unit, 30 backend e2e (all passing at the last commit). The admin panel was clicked
through in Chrome (sign-in, approve, fares save, rides, sign-out) on 2026-11-04.
The owner tested sign-in, fares, booking and tracking on their phone (2026-11-04): all worked.
**Driver onboarding is not yet tested on a real phone** (camera, gallery, upload on mobile data).

### Next up ▶️
1. **First: the owner tests** on real phones: driver onboarding, approving themselves in the admin panel
   (`pnpm admins add <their number>`, `pnpm admin`), then a ride with the new vehicle markers (glide + turning,
   nearby drivers before booking, driver ETA). The glide uses a native map command that hasn't run on a device
   yet: check the marker doesn't snap back or freeze. Fix bugs before new features.
2. Then (to be confirmed with the owner): the next **free** item from "Still missing", most likely the
   **female-driver option**. Paid items wait (see the paid table).

### Still missing ❌
Owner's rule (2026-11-05): **build the free things now; anything that costs money waits** but stays on the list.

**Free: V1 scope (build next, rough order)**
1. Female-driver option for passengers (gender is already collected and reviewed)
2. SOS button + share-trip link (SOS opens the phone dialer for 15 / 1122 and alerts admins; the link is a public
   web page showing the ride live, served by our own server)
3. Ratings + complaints with tracked response time (+ complaints page in the admin panel)
4. Per-city feature flags (required by the engineering rules; every new feature switchable per city)
5. Android development build for background location + an offer sound while the driver app is closed (local or
   EAS free tier). Without it, tracking pauses when the driver opens Google Maps or locks the phone.
   Driver → passenger live location is NOT wanted: like inDrive, the driver sees the pickup pin only.

**Free: after V1 (signature features + polish)**
6. Route-deviation / early-drop detection (signature #8), using the GPS we already collect
7. AC Guarantee (signature #1): "AC off" tap → automatic discount (ride credit, since rides are cash)
8. Scheduled rides + On-Time Promise (signature #5): compensation credit if pickup is late
9. Rickshaw as a vehicle type (fares, onboarding, dispatch, apps, marker)
10. Driver penalties for cancelling / declining; auto-suspend when a licence expires
11. Ammi Mode (signature #3), basic version (book for a family member, track them). The "driver calls them"
    part needs masked calling (paid, below)
12. Rewards points (no partner vouchers yet), Urdu for the admin panel, admin roles

**Paid: later (keep, don't build yet)**
| Item | Why it costs | Needed for |
| --- | --- | --- |
| Real SMS provider (implement `SmsSender`) | per SMS | **launch blocker**: OTP codes |
| Masked calling | telephony provider, per minute | V1 scope; Ammi Mode calls |
| Route line + road distance / traffic ETA | Google Directions / Distance Matrix per request (or our own OSRM server) | nicer maps, exact fares |
| Production hosting: server, managed Postgres/Redis, S3-compatible storage for documents | monthly | launch |
| App stores: Google Play ($25 once), Apple developer ($99/year) for iOS builds | fees | launch; iOS background location |
| Designer-made marker art (car, bike, rickshaw) | designer | polish |
| WhatsApp booking (signature #4) | WhatsApp Business API per conversation | no-app booking |
| Missed-call booking | telephony number | no-app booking |
| Trip Black Box audio (signature #2) | storage + encryption keys service | safety |
| JazzCash / Easypaisa payments + daily driver payouts | merchant fees | payments |
| NADRA CNIC / licence verification | paid government API | stronger driver checks |

### Known limits / TODOs
- Expo Go only: no background location; offers only vibrate while the driver app is open.
- Road distance and ETA = straight line × 1.35 (no routing/traffic API yet).
- Driver cancellations / declines have no penalty yet.
- Auth screens are duplicated in both apps (`apps/*/src/app/sign-in.tsx` etc.).
- Admin panel: no roles (every admin can do everything), English only, admins added only by `pnpm admins`.
- Driver documents are on local disk (`backend/uploads/`); production with several servers needs S3-compatible
  storage behind `FileStorage`.
- Approved drivers can't change their vehicle in the app (needs a new review). Licence expiry is only checked at sign-up.

### Local setup reminders
- Docker Desktop needs WSL 2. If it fails to start, run `wsl --update` as admin and reboot.
- Phone can't reach the laptop: Windows had **Block rules for node.exe** (from a cancelled firewall popup); they were
  disabled on 2026-11-04. Allow rule "ApniRide dev" opens TCP 3000/8081/8082 on Private networks. Use
  `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.100.6"` before `pnpm passenger` (WSL adapters confuse Expo's IP pick).
- **2026-11-04: the owner got the passenger app running on their phone via Expo Go** (first real-device test).
- Dev backend: `pnpm db:up && pnpm db:migrate && pnpm backend`. The laptop's LAN IP was `192.168.100.6`.
- `backend/.env` has the dev-only flag `OTP_DEV_ECHO=true` (refused when `NODE_ENV=production`).
- Admin panel: `pnpm admins add <phone> "<name>"` once, then `pnpm admin` → http://localhost:3001.
- The e2e tests share the dev database; they remove the test admins they create (`removeTestAdmins`).
