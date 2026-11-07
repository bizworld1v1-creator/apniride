# Admin panel

`apps/admin`: Next.js app for the ApniRide team. Approve drivers (with their photos on screen), look at rides,
set fare rates. English only for now (internal tool; see "Not done yet").

## Run it

1. `pnpm dev` (or the single parts: `pnpm db:up; pnpm db:migrate; pnpm backend`, then `pnpm admin`).
2. Open **http://localhost:3001**.
3. Sign in with **`ADMIN_USERNAME`** and **`ADMIN_PASSWORD`** from `backend/.env`.
4. **Drivers** → open the pending request → check the photos → **Approve** (or Reject with a reason).

No commands, no phone number, no SMS. The panel reads the API address from `API_URL`
(`apps/admin/.env.local`, default `http://localhost:3000`).

## Who can sign in

- **One admin.** It signs in with the username + password in `backend/.env` (`POST /auth/admin/login`). The
  admin row (and a user row with no phone number, name "Admin") is created on the first sign-in.
- Phone OTP never opens the panel: `/auth/otp/*` only accepts the `passenger` and `driver` roles. Older
  phone-based admins (from before 2026-11-07) can't get in any more.
- **Change the password:** edit `ADMIN_PASSWORD` in `backend/.env` and restart the backend. Every admin request
  checks a fingerprint of the username + password the session was opened with, so the old session stops working
  at once. Changing `ADMIN_USERNAME` does the same (and starts a new admin row; the audit log keeps the old one).
- `ADMIN_PASSWORD` must be at least 8 characters, **12 in production** (the server refuses to start otherwise).
  Not set: the panel shows "admin login is not set up".
- **10 wrong tries per IP in 15 minutes**, then that IP waits (HTTP 429), even with the right password.
  The password is compared in constant time and never logged.
- Admin sessions last **7 days** (apps: 60), then sign in again.

## How the session is kept safe

- The browser never sees a token. The Next.js server keeps them in **httpOnly cookies** (`secure` in
  production, `SameSite=Lax`) and calls the API itself. Page scripts can't read them, so an XSS bug can't steal
  a session.
- Pages can't write cookies, so an expired access token sends the browser to `/auth/refresh`, which swaps
  the refresh token and comes back to the same page (`src/proxy.ts` tells the server which page that was).
- Form buttons are Next.js Server Functions, which only accept requests from the panel's own origin (CSRF).
- Document photos go through `/api/documents/:driverId/:type`, which adds the token on the server and sends
  `Cache-Control: no-store`. They are never public URLs.
- Every page sends `X-Frame-Options: DENY` (no clickjacking on Approve) and `noindex`.

## Audit log

Every change goes to `admin_audit_log` (who, what, which record, details):

| Action | Details |
| --- | --- |
| `driver.approve` · `driver.reject` · `driver.suspend` | the reason given (reject / suspend) |
| `fare_rate.update` | rates before and after |

The driver page shows its history ("4 Nov, 11:08 pm: Sana approved"). Never put CNIC numbers or photos in
`details`.

## Pages

| Page | What |
| --- | --- |
| `/` Dashboard | Drivers waiting for review, drivers online now, rides in progress; today's rides, completed, cancelled, no-driver, cash fares |
| `/drivers` | Tabs per status. Waiting for review is oldest first: review in that order |
| `/drivers/:id` | Details, a warning when the CNIC's last digit doesn't match the gender, all photos, Approve / Reject / Suspend / Reinstate (reject and suspend need a reason the driver sees), history |
| `/rides` | Newest first, filter by status, 50 per page ("Older »") |
| `/rides/:id` | Fare, both people with phone numbers, map links, timeline, every driver it was offered to and their answer |
| `/fares` | Edit base / per km / per minute / minimum / average speed and on/off per city + vehicle, with example fares for 3, 8 and 15 km. New quotes use the change within a minute; quoted fares never change |

Admins see **full phone numbers** (to call drivers and passengers for support). The apps never do.

## API (`/admin/*`, admin token)

| | |
| --- | --- |
| `GET /admin/me`, `GET /admin/stats` | |
| `GET /admin/drivers?status=` · `GET /admin/drivers/:id` · `GET /admin/drivers/:id/documents/:type` | See [drivers.md](drivers.md) |
| `POST /admin/drivers/:id/approve` · `reject {reason}` · `suspend {reason}` | |
| `GET /admin/rides?status=&before=&limit=` · `GET /admin/rides/:id` | |
| `GET /admin/fare-rates` · `PUT /admin/fare-rates/:city/:vehicleType` | `{ baseFare, perKm, perMin, minimumFare, avgSpeedKmh, active }`, whole rupees; minimum ≥ base |

A non-admin token gets `403 not_admin`.

## Not done yet

- Complaints (comes with ratings + complaints).
- More than one admin, roles, audit log page.
- Urdu for the panel.
- Search drivers / rides by phone or plate.
- Changing an approved driver's vehicle.
