# Project: Ride-Hailing App for Pakistan (working name: TBD)

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

## Proposed tech stack (confirm before building)
- **Mobile apps:** Flutter (one codebase for Android + iOS) – separate Passenger and Driver apps
- **Backend:** Node.js + TypeScript (NestJS), REST + WebSockets for live tracking
- **Database:** PostgreSQL + PostGIS (geo queries), Redis (live driver locations, matching)
- **Maps:** Google Maps Platform (consider cheaper alternatives later)
- **Payments:** Cash first, then JazzCash / Easypaisa wallets
- **Admin panel:** React (Next.js)
- **Infra:** Docker, deploy on a cloud VPS / AWS to start

## Repo layout (planned)
```
/apps/passenger    Flutter passenger app
/apps/driver       Flutter driver app
/apps/admin        Next.js admin panel
/backend           NestJS API + WebSocket server
/docs              Specs, decisions
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
