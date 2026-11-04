# Admin panel

`apps/admin`: Next.js app for the ApniRide team. Approve drivers (with their photos on screen), look at rides,
set fare rates. English only for now (internal tool; see "Not done yet").

## Run it

```powershell
pnpm db:up; pnpm db:migrate; pnpm backend      # the API on :3000
pnpm admins add 03001234567 "Your Name"        # once: put your number on the admin list
pnpm admin                                     # the panel on http://localhost:3001
```

Sign in with that number. In development the code is shown on the login page (`OTP_DEV_ECHO=true`);
in production it comes by SMS. The panel reads the API address from `API_URL` (`apps/admin/.env.local`,
default `http://localhost:3000`).

## Who can sign in

- Admins sign in with **phone OTP**, role `admin`, through the same `/auth/otp/*` endpoints as the apps.
- Only numbers in the `admins` table can. Nobody becomes an admin by signing in: `pnpm admins add` is the only
  way in. For any other number the API answers exactly as usual but sends no SMS and stores no code, so
  the admin list can't be probed.
- `pnpm admins disable <phone>` locks an admin out **at once**: every admin request checks the table, so even a
  token they already have stops working. `pnpm admins enable <phone>` undoes it. `pnpm admins list` shows all.
- Admin sessions last **7 days** (apps: 60), then sign in again.

```
pnpm admins list
pnpm admins add     <phone> "<name>"
pnpm admins disable <phone>
pnpm admins enable  <phone>
```

`pnpm admins` talks to the database directly (`DATABASE_URL` in `backend/.env`); run it on the server or with a
tunnel to the production database.

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
- Roles (everyone is a full admin), adding admins from the panel, audit log page.
- Urdu for the panel.
- Search drivers / rides by phone or plate.
- Changing an approved driver's vehicle.
