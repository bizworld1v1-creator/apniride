# Commands cheat sheet

All commands run from the repo root (`F:\ApniRide\ride-app`) in PowerShell, unless it says otherwise.
Laptop LAN IP (Wi-Fi): `192.168.100.6`. If your Wi-Fi changes, check it with `ipconfig`.

## 1. Daily dev run

**One command (start Docker Desktop first):** `pnpm dev`. It does everything in the table below in one terminal
(database, migrations, backend, app, admin) and finds the Wi-Fi IP itself. Or run the parts one by one:

| Terminal | Command | What it does |
| --- | --- | --- |
| 1 | `pnpm db:up` | Starts Postgres + PostGIS and Redis in Docker (Docker Desktop must be open) |
| 1 | `pnpm db:migrate` | Applies new database migrations (safe to run every time) |
| 1 | `pnpm backend` | Starts the API on port **3000**. **The apps don't work without it.** |
| 2 | `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.100.6"; pnpm mobile` | The app (Expo, port 8081): passenger + driver mode. Scan the QR code with Expo Go |
| 3 | `pnpm admin` | Admin panel at http://localhost:3001 |

Check that the backend is up: open http://192.168.100.6:3000/health (on the laptop **or** on the phone).
It should show `"status":"ok"`.

> **"No internet connection" in the app** almost always means the backend isn't running or the phone can't
> reach the laptop. Start `pnpm backend`, then open the health link above on the phone.

### Stop everything
- `Ctrl + C` in each terminal
- `pnpm db:down` stops the Docker containers. Data is kept.

## 2. Dev sign-in code (OTP)

No real SMS is sent in development. `backend/.env` has `OTP_DEV_ECHO=true`, so:
- The **6-digit code is shown in the app** on the "enter code" screen, and
- it is also printed in the **backend terminal** (terminal 1).

Any Pakistani mobile number works, e.g. `03001234567`. Limits: a code lasts 5 min, 5 codes per number per
hour, 5 wrong tries per code. If you hit a limit, wait or use another number.

## 3. Admin panel

| Command | What it does |
| --- | --- |
| `pnpm admin` | Starts the panel at http://localhost:3001 (also part of `pnpm dev`) |

Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `backend/.env`. To change the password, edit it there and
restart the backend.

## 4. Testing a full ride on phones

1. Start everything from section 1.
2. Driver app: sign in, finish onboarding (documents + photos), submit.
3. Admin panel → Drivers → approve yourself.
4. Driver app: go **online**.
5. Passenger app (other phone, or the same phone with another number): pick a destination → book.
6. Driver gets the offer (15 s) → accept → arrived → start → complete.

### Shortcut: ready-made test drivers (skip onboarding + approval)

| Command | What it does |
| --- | --- |
| `pnpm dummy-driver` | Adds two **already approved** drivers: car `03000000001`, bike `03000000002` |
| `pnpm dummy-driver remove` | Deletes them (and their rides) |

On a **second device** (e.g. the Android emulator), sign in with `03000000001` (code is shown in the app) → tap
**Driver mode** → **Go online**. Then book a **car** ride on your phone in passenger mode with your own number. The driver must be within 5 km of the pickup, and the
driver device must have the app open on screen to get the offer (15 s to accept). Dev only: refuses to run with
`NODE_ENV=production`.

## 5. Checks before a commit ("chunk done")

| Command | What it checks |
| --- | --- |
| `pnpm typecheck` | TypeScript errors in all packages |
| `pnpm test` | Unit tests (shared + backend) |
| `pnpm lint` | Lint |
| `pnpm --filter @apniride/backend test:e2e` | Backend end-to-end tests (needs `pnpm db:up` first) |
| `cd apps/mobile; npx expo export --platform android` | The app bundles |

Run a single package's tests: `pnpm --filter @apniride/backend test` or `pnpm --filter @apniride/shared test`.
Watch mode while coding: `pnpm --filter @apniride/backend test:watch`.

## 6. Other ways to run the apps

| Command | When to use |
| --- | --- |
| `pnpm --filter @apniride/mobile start:tunnel` | Phone is on a different network (mobile data). Slower |
| `pnpm --filter @apniride/mobile android` | Open in an Android emulator |
| `pnpm --filter @apniride/mobile doctor` | Check Expo setup problems |
| `pnpm --filter @apniride/mobile build:preview` | Installable APK via EAS (free tier) |

More details: [running-on-devices.md](running-on-devices.md).

## 7. Fixes for common problems

| Problem | Fix |
| --- | --- |
| "No internet connection" in the app | Backend not running → `pnpm backend`. Phone on same Wi-Fi? Open the health link on the phone |
| Expo QR opens but can't load | Set `REACT_NATIVE_PACKAGER_HOSTNAME` (section 1); check the Windows firewall rule "ApniRide dev" (TCP 3000/8081) |
| Docker won't start | Run `wsl --update` as admin, then reboot |
| Backend says database error | `pnpm db:up`, then `pnpm db:migrate` |
| Port already in use | Another copy is running. Close the old terminal, or find it: `Get-NetTCPConnection -LocalPort 3000` |
| Car/bike marker images changed | `pnpm render:vehicles` |
