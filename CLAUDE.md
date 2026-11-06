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
- **apps/mobile:** ONE app for passengers and drivers, like inDrive (owner decision 2026-11-06): passenger mode and
  driver mode, switched in the app without a new OTP (`POST /auth/switch-role`). Expo (latest SDK) + TypeScript,
  Expo Router, EAS Build + EAS Update (OTA), react-native-maps (Google Maps on both Android and iOS), expo-location
  (background location in driver mode),
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
/apps/mobile       Expo app: passenger mode + driver mode
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
  from `packages/shared/src/theme.ts` (the mobile app,
  the admin CSS and the app icon/splash). Never hard-code them in a component. See docs/theme.md.

## How we work
- **One feature per chunk.** Build it end to end (backend + app (both modes) + admin if needed + tests + docs), commit, push, then
  **stop and ask** the owner before starting the next one.
- **After every chunk, update the Progress section below** (move the item to Done, set "Next up").
- Before declaring a chunk done: `pnpm typecheck`, `pnpm test`, `pnpm lint`, and
  `pnpm --filter @apniride/backend test:e2e` (needs `pnpm db:up`). Also run
  `npx expo export --platform android` in `apps/mobile` to confirm it bundles.
- Design notes live in `docs/` (auth.md, fares.md, rides.md, drivers.md, admin.md, running-on-devices.md, commands.md, theme.md, account.md). Keep them in sync with the code.

## Progress (last updated 2026-11-07, after new-design group 5: side-menu screens + registration; reskin complete)

### Done ✅
| Feature | Where | Notes |
| --- | --- | --- |
| Monorepo, docker-compose, `/health` | root, `backend/src/health` | Postgres + PostGIS, Redis |
| SQL migrations | `backend/migrations`, `pnpm db:migrate` | 0001 users/sessions, 0002 fare_rates, 0003 drivers/rides/ride_offers, 0004 driver onboarding, 0005 admins + audit log, 0006 profile photo + account deletion + saved places + history indexes |
| Phone OTP sign-in | `backend/src/auth`, `apps/mobile/src/app/welcome, sign-in, complete-profile` | Dev SMS only (code shown in app + server log). See docs/auth.md |
| Fixed fare estimate (bike + car AC) | `backend/src/fares`, passenger `FareScreen`, `lib/fare.ts` | **Lahore rates are placeholders, so the owner must set the real ones.** See docs/fares.md |
| Booking + dispatch (chunk 1 of rides) | `backend/src/rides`, `backend/src/drivers`, `backend/src/realtime` | Driver online → nearest driver gets a 15 s offer → accept → arrived → start → complete; cancel by either side; Socket.IO + BullMQ. See docs/rides.md |
| Passenger booking UI | `apps/mobile/src/components/PassengerHome.tsx`, `components/passenger/*` | Live status, cancel, "pay cash" (new design since group 3) |
| Driver ride UI | `apps/mobile/src/components/DriverHome.tsx`, `components/driver/*` | Vibrates on offer, Google Maps navigation link (new design since group 4) |
| Run on any device guide | `docs/running-on-devices.md`, `apps/mobile/src/lib/map-provider.ts` | Android/iPhone (Expo Go), emulator, simulator, tunnels, EAS APK. iPhone uses Apple Maps unless a build has an iOS Google key |
| Live tracking + ETA (chunk 2 of rides) | `backend/src/drivers/tracking.service.ts`, passenger `VehicleMarker`, `lib/driver-position.ts` | Driver position forwarded only to that ride's passenger; ETA to pickup, then to destination; "last updated" when stale |
| Driver onboarding + approval | `backend/src/drivers/onboarding.*`, `backend/src/admin`, `backend/src/storage`, `apps/mobile/src/app/onboarding*.tsx`, `DocumentRow`, `DriverStatusCard` | Gender, CNIC (one account per CNIC), licence, vehicle + 6 required photos (police certificate optional). incomplete → pending → approved / rejected (reason, fix, resubmit) / suspended. Reviewed in the admin panel. `DRIVER_AUTO_APPROVE` removed. See docs/drivers.md |
| Vehicle markers + smooth tracking | `apps/mobile/src/components/VehicleMarker.tsx`, `design/vehicles`, `packages/shared/src/tracking.ts`, `backend/src/drivers/nearby-drivers.*` | Top-down car / bike images that glide natively and turn with the heading; nearby drivers on the passenger map before booking (privacy-safe); driver sees own vehicle + ETA. See docs/rides.md |
| Admin panel | `apps/admin`, `backend/src/admin`, `pnpm admins` | Phone-OTP sign-in for numbers on the `admins` list only; tokens in httpOnly cookies on the Next.js server. Dashboard, drivers (photos, approve/reject/suspend), rides (detail + offers), fare rates (with example fares). Audit log of every change. English only. See docs/admin.md |
| Unified theme | `packages/shared/src/theme.ts`, `apps/mobile/src/lib/theme.ts`, admin `layout.tsx` + `globals.css` | One file for every colour, font size/weight, spacing step (`space[n]` = n × 4 px), corner, shadow, border, opacity and tap size (admin gets CSS variables). Brand: mobile app royal blue + yellow accent (both modes, since 2026-11-07), admin amber. See docs/theme.md |
| One app, two modes (like inDrive) | `apps/mobile` (`app/index.tsx`, `lib/mode.ts`, `ModeSwitch`, `RealtimeBridge`), `backend/src/auth` (`switch-role`) | `apps/passenger` + `apps/driver` merged into `apps/mobile` (`pnpm mobile`, package `pk.apniride.app`). "Driver mode" / "Passenger mode" button on the home card swaps the session without a new OTP; refused while online (`go_offline_first`) or with an active ride (`active_ride_exists`). Signs in to the last used mode. Driver texts under `driver.*` in i18n. A full ride test now needs two devices. See docs/auth.md |
| Side menu (like inDrive) | `apps/mobile/src/components/SideMenu.tsx`, `app/history/*`, `app/places/*`, `app/profile.tsx`, `app/settings.tsx`, `lib/account.ts`, `lib/language.ts`, `backend/src/users`, `backend/src/rides/history.service.ts` | ☰ on the home card: ride history (20 per page; driver mode adds cash today / 7 days / all time), saved places (Home / Work / up to 20, one-tap destinations when booking), profile (photo, name, delete account), settings (language incl. RTL after restart, help, 15 / 1122), mode switch, sign out (blocked while online / on a ride). No addresses (no geocoding). See docs/account.md |
| New design, group 1: theme + fonts + components | `packages/shared/src/theme.ts`, `apps/mobile/src/lib/fonts.ts`, `lib/motion.ts`, `components/ui/*`, `app/ui-preview.tsx` | From `ApniRide-design-handoff/` (2026-11-07): royal blue + yellow accent + ink, Bricolage Grotesque + Plus Jakarta Sans (system font in Urdu), pill buttons, round cards, reduce-motion-aware animations. Existing screens got the new colours; their layouts change in groups 2–5. Dev-only "UI preview" in Settings. See docs/theme.md |
| New design, group 2: welcome + sign-in | `app/welcome.tsx`, `components/welcome/SunScene.tsx`, `app/sign-in.tsx`, `components/auth/*`, `AuthLayout`, `design/splash` (`pnpm render:splash`) | Animated welcome screen ("Let's ride" → passenger, "Become a driver" → driver). Number + 6-digit code on one screen with an on-screen number pad, dev code in the speech bubble. `verify.tsx` removed. New native splash: yellow sun on blue (needs a new build). See docs/auth.md |
| New design, group 3: passenger home, booking, trip | `components/PassengerHome.tsx`, `components/passenger/*` (`HomeDashboard`, `PlacePickSheet`, `FareScreen`, `SearchingScreen`, `LiveTripSheet`, `TripComplete`, `RideEndedSheet`, `MapPin`, `CornerMask`, `RouteCard`), `lib/fare.ts` | One map stays mounted: rounded card on the dashboard (greeting, search pill, Ride/Moto tiles preselect the vehicle, Rickshaw/Intercity "Coming soon", 1–2 saved places, bottom nav Home/Trips/Wallet (soon)/Profile, avatar opens the side menu), full screen for picking places and the trip. Fare page shows the fixed fare (car/bike switch, Cash; JazzCash soon). Searching page (radar). Live trip: SOS (dials 15 / 1122), ETA + live dot, 4-step progress, driver initials; chat, call, plate, ride PIN, share trip "Coming soon". Trip complete: confetti, cash to pay; rating "Coming soon". No addresses: places show "Your location" / "Pin on the map" / saved-place names |
| Fixes after the owner's first look + passenger names the price | `packages/shared/src/fares.ts` (`offerRange`, `clampOffer`), `backend/src/rides/rides.service.ts`, `FareScreen`, `ui/Slider`, `ui/BackButton`, `auth/NumberPad`, `HomeDashboard` | Like inDrive: "Name your price" with slider and −20 / +20 / +50; lowest = fair price for the distance, highest = 2×; `offeredFare` on `POST /rides` (`offer_out_of_range`). Bigger number-pad keys (58 px). Service tiles grow with their text. One round back button everywhere (history, places, profile, settings, registration). See docs/fares.md |
| New design, group 4: driver mode | `components/DriverHome.tsx`, `components/driver/*` (`DriverDashboard`, `RequestSheet`, `ActiveRideSheet`), `DriverStatusCard`, `ModeSwitch`, `SosButton` | "Ready, {name}?" + "Passenger mode" pill; earnings card (today's cash + trips from the earnings API, 7 days; daily goal ring and rating "Coming soon"); dark online card with the power button (pulsing rings when online); map card with the driver's own vehicle (one map, full screen during a ride). Request sheet springs up: yellow countdown bar, passenger's price, pickup distance + trip, "Accept for Rs X", decline; counter-offers "Coming soon". Ride sheet: passenger, ETA, Google Maps navigation, one big step button, cash to collect. SOS in both modes. Server-status pill removed |
| New design, group 5: side-menu screens + registration | `components/SideMenu.tsx`, `PageLayout` (`Choice`, `pageStyles`), `HistoryRow`, `app/history/*`, `app/places/*`, `app/profile.tsx`, `app/settings.tsx`, `app/onboarding*.tsx`, `DocumentRow` | Side menu: blue account card, line icons, danger sign-out; opens from the avatar in both modes (☰ button removed). History: rows with vehicle icons, blue earnings card, empty state. Ride detail: rounded map + divided rows. Places: icon rows with Edit / ✕, drawn pin on the picker. Profile: photo card, white name field, phone card, red delete zone. Settings: pill choices, red 15 / 1122 call buttons. Registration: details card with tick, document cards with camera / gallery pills. No emoji icons or old buttons left. **The whole app now follows the design** |

Tests: 95 shared + 32 backend unit, 36 backend e2e (all passing at the last commit). The admin panel was clicked
through in Chrome (sign-in, approve, fares save, rides, sign-out) on 2026-11-04.
The owner tested sign-in, fares, booking and tracking on their phone (2026-11-04): all worked.
**Driver onboarding is not yet tested on a real phone** (camera, gallery, upload on mobile data).

### Next up ▶️
**New design** (`ApniRide-design-handoff/`, owner decisions 2026-11-07): reskin group by group, stop after each for
the owner to check on the phone. Features the design shows that we don't have (Rickshaw, Intercity, chat, ride PIN,
JazzCash, notifications, daily goal) appear greyed out with "Coming soon". Keep the 6-digit OTP and Urdu/RTL.
1. **Owner checks groups 1–5** on the phone. Group 5: side menu (from the avatar), ride history + detail,
   earnings card (driver), saved places + picker, profile (photo, name, delete account), settings (language, 15 /
   1122), driver registration (details form, document photos, send for review). Group 4 (driver mode, needs an approved driver): dashboard, power
   button on/off, a request from the other phone (bar, accept / decline), the ride sheet through to "collect cash",
   earnings updating after a ride. Group 3: dashboard (map card with nearby cars and the bouncing pin, tiles,
   saved places, bottom nav, avatar → side menu), booking (search → pin → fare page → book), searching page, live trip
   (needs a second phone in driver mode: SOS, ETA, steps), trip complete, cancel and "no driver". Check the map card's
   rounded corners on Android and that short phones fit without scrolling. Groups 1 + 2: Settings → "UI preview (dev only)"; sign out → welcome screen
   (sun, clouds, car, words bouncing in) → "Let's ride" → sign-in (number pad, green tick, code circles, auto check,
   resend, change number, Android back) → name screen for a new number. Also "Become a driver" lands in driver mode.
2. Then the rest of **inDrive-style bidding** (owner decision 2026-11-07). Done: the passenger names the price
   (fair price … 2×). Still to do: send the request to several drivers at once, drivers accept or counter-offer
   (Rs +100 / +200 / +300 pills in the driver design), the passenger picks from the offers deck (design: offers.html).
   Own chunk: backend matching, offers, apps, tests, docs/fares.md + docs/rides.md.
3. Still open from before: the owner tests the merged app + side menu on real phones (mode switch, history, places,
   profile photo, Urdu, account deletion, driver onboarding, vehicle markers glide), and decides what account
   deletion keeps (docs/account.md).

### Still missing ❌
Owner's rule (2026-11-05): **build the free things now; anything that costs money waits** but stays on the list.

**Free: V1 scope (build next, rough order)**
1. Female-driver option for passengers (gender is already collected and reviewed)
2. SOS button + share-trip link (SOS opens the phone dialer for 15 / 1122 and alerts admins; the link is a public
   web page showing the ride live, served by our own server)
3. Ratings + complaints with tracked response time (+ complaints page in the admin panel)
4. Per-city feature flags (required by the engineering rules; every new feature switchable per city)
5. Android development build for background location + an offer sound while the app is closed in driver mode (local or
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
- Expo Go only: no background location; offers only vibrate while the app is open in driver mode.
- One phone is in one mode at a time: testing a whole ride needs two devices (e.g. phone + Android emulator) with
  two numbers.
- Road distance and ETA = straight line × 1.35 (no routing/traffic API yet).
- No addresses anywhere (no geocoding API): saved places and ride history show pins and user-given names.
- The profile photo is only shown to the user themself (not yet to the other person on a ride).
- Driver cancellations / declines have no penalty yet.
- Admin panel: no roles (every admin can do everything), English only, admins added only by `pnpm admins`.
- Driver documents are on local disk (`backend/uploads/`); production with several servers needs S3-compatible
  storage behind `FileStorage`.
- Approved drivers can't change their vehicle in the app (needs a new review). Licence expiry is only checked at sign-up.

### Local setup reminders
- Docker Desktop needs WSL 2. If it fails to start, run `wsl --update` as admin and reboot.
- Phone can't reach the laptop: Windows had **Block rules for node.exe** (from a cancelled firewall popup); they were
  disabled on 2026-11-04. Allow rule "ApniRide dev" opens TCP 3000/8081/8082 on Private networks (8082 is no longer used). Use
  `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.100.6"` before `pnpm mobile` (WSL adapters confuse Expo's IP pick).
- **2026-11-04: the owner got the passenger app running on their phone via Expo Go** (first real-device test).
- Dev: **`pnpm dev`** runs everything (database, migrations, backend, app, admin; finds the Wi-Fi IP itself).
  Single parts: `pnpm backend`, `pnpm mobile`, `pnpm admin`. The laptop's LAN IP was `192.168.100.6`.
- `backend/.env` has the dev-only flag `OTP_DEV_ECHO=true` (refused when `NODE_ENV=production`).
- Admin panel: `pnpm admins add <phone> "<name>"` once, then `pnpm admin` → http://localhost:3001.
- The e2e tests share the dev database; they remove the test admins they create (`removeTestAdmins`).
