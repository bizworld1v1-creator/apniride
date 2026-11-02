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
