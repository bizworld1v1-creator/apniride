# ApniRide

Trust-first ride-hailing app for Pakistan. *Thanda safar, mehfooz safar, waqt pe safar.*

See [CLAUDE.md](CLAUDE.md) for the product vision, signature features, v1 scope and tech stack.

📱 **Run it on any device** (Android, iPhone, emulator, simulator, other networks, installable APK):
see [docs/running-on-devices.md](docs/running-on-devices.md).

## Repo layout

```
apps/mobile        Expo (React Native) app: passenger + driver mode in one app (like inDrive)
apps/admin         Next.js admin panel
backend            NestJS API + Socket.IO
packages/shared    Shared types, Zod schemas, API client
docker-compose.yml PostgreSQL + PostGIS, Redis
```

Turborepo + pnpm workspaces. Run everything from the repo root.

## Prerequisites (one-time)

| Tool | Install |
| --- | --- |
| Node.js 22+ | https://nodejs.org |
| pnpm | `npm install -g pnpm` |
| Git | https://git-scm.com/downloads |
| Docker Desktop | https://www.docker.com/products/docker-desktop — on Windows it needs WSL 2: run `wsl --install --no-distribution` in an **Administrator** PowerShell, then restart |
| Expo Go (on your Android phone) | Play Store → "Expo Go" (keep it updated: it must support the app's Expo SDK, currently 58) |

You do **not** need Android Studio or Java: we use Expo Go for daily development and EAS (cloud) for real builds.

## First-time setup

```bash
git clone https://github.com/bizworld1v1-creator/apniride.git
cd apniride
pnpm install
cp backend/.env.example backend/.env
pnpm db:up            # starts Postgres + PostGIS and Redis in Docker
pnpm db:migrate       # creates the database tables (run again after pulling new migrations)
```

`backend/.env.example` has placeholder `JWT_SECRET` / `OTP_SECRET` values that work locally. For anything
shared, generate real ones: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

**Docker says "Docker Desktop is unable to start"?** Usually WSL 2 is missing or outdated. Open PowerShell
**as Administrator**, run `wsl --update`, restart the PC, then start Docker Desktop again.

## Run the backend

```bash
pnpm backend          # builds packages/shared, then the API on http://localhost:3000
```

Check it: open http://localhost:3000/health. You should get `"status":"ok"` with a PostGIS version.
If Docker isn't running you'll get HTTP 503 with `"status":"degraded"`.

## Run the app on your Android phone (Expo Go)

This is the quickest path. For iPhone, emulators, mobile data or an installable APK, see
[docs/running-on-devices.md](docs/running-on-devices.md).

1. Put your **phone and PC on the same Wi-Fi**.
2. Start the backend (above) so the app can show "Server connected".
3. In a new terminal, from the repo root: `pnpm mobile` (Metro on port 8081).
4. A QR code appears in the terminal. Open **Expo Go** on the phone → **Scan QR code** → scan it.
5. The first load takes a minute. You land on **Sign in**: type any Pakistani mobile number
   (e.g. `0300 1234567`) → **Send code**.
6. No real SMS is sent in development. The code appears in a yellow **Dev code** box on the screen and in
   the backend terminal (`[dev] to +92 3•• ••• 4567: ApniRide code: 123456`). Type it in and it signs in
   automatically.
7. First time only: enter your name. Then allow location when asked. You should see a map of Lahore,
   your blue location dot, and a green "Server connected" dot. You stay signed in after closing the app.
8. Tap **Where to?**, drag the map so the 📍 pin is on your destination, then **Confirm destination**. You get a
   fixed fare for Bike and Car (AC).
9. **Driver mode**: tap the **Driver mode** button in the top card (no new code needed). The first time, you see
   "Become an ApniRide driver" and can register. **Passenger mode** switches back. Switching is blocked while you
   are online as a driver or have a ride going on.

### Try a whole ride (passenger + driver)

One app means one mode per phone at a time, so use **two devices** (two phones, or your phone + the Android
emulator, see [docs/running-on-devices.md](docs/running-on-devices.md)) with **two different numbers**. Open the same
QR code from `pnpm mobile` on both. The driver number must be an approved driver (register in driver mode and
approve it in the admin panel).

1. **Driver phone** (driver mode): **Go online**. You'll see "Waiting for ride requests…".
2. **Passenger phone**: Where to? → pick a destination → choose the **same vehicle type** as the driver → **Book**.
3. **Driver phone**: it vibrates and shows the offer with a 15-second countdown → **Accept**.
4. **Passenger phone**: you see the driver's 🚗/🏍️ marker on the map and "Arriving in N min". Walk or drive a bit
   with the driver phone to see it move (it updates every 5 s / 25 m).
5. **Driver phone**: **I've arrived** → **Start ride** → **Complete ride**. The passenger phone follows each step
   live (once on board: "About N min to your destination") and ends with "Please pay Rs … in cash".

The driver must be within 5 km of the pickup (the passenger's GPS position), so keep the two devices near each other.
If nobody accepts within 2 minutes, the passenger sees "No drivers available".

The app finds the backend automatically at `http://<your PC's IP>:3000`.
To point it somewhere else, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`.

### Troubleshooting

- **Windows Firewall prompt**: when Node.js asks, allow it on **Private networks**. If you missed it, allow
  inbound TCP ports 8081 and 3000 for Node.js. Also make sure your Wi-Fi is set to a *Private* network.
- **QR code won't connect** (office/hotel Wi-Fi blocks devices from seeing each other): use
  `pnpm --filter @apniride/mobile start:tunnel`. Note that in tunnel mode the phone can't reach your local
  backend, so the app will say "Server unreachable" unless you set `EXPO_PUBLIC_API_URL` to a public URL.
- **"Server unreachable"** but the map works: check http://localhost:3000/health on the PC, then open
  `http://<your PC's IP>:3000/health` in the phone's browser. If that fails, it's the firewall.
- **"Project is incompatible with this version of Expo Go"**: update Expo Go from the Play Store.
- Press `r` in the Metro terminal to reload, or shake the phone for the dev menu.
- Phone language set to **Urdu** → the app shows Urdu text with a right-to-left layout.
- **"Please wait … before asking for another code"**: you can request a code once a minute and 5 times an hour
  per number. Use a different number while testing, or reset with
  `docker exec apniride-redis redis-cli --scan --pattern "otp:*" | xargs docker exec apniride-redis redis-cli del`.
- **Sign-in says "Something went wrong"**: the backend can't reach Redis/Postgres (is Docker running?) or the
  tables are missing (run `pnpm db:migrate`).

### What needs a development build (not Expo Go)

Expo Go is enough for the map and foreground location. These need our own build via EAS:
**background location** in driver mode, your own **Google Maps API key**, push notifications, and
any library that isn't bundled in Expo Go.

```bash
npm install -g eas-cli
eas login                                   # free Expo account
cd apps/mobile
eas init                                    # links the app to your Expo account (once)
pnpm build:dev                              # cloud build → install the APK on the phone from the link/QR
pnpm start:dev-client                       # then open the installed dev build instead of Expo Go
```

`pnpm build:preview` makes an installable test APK. `pnpm update` ships an over-the-air (EAS Update) JS update
(run `eas update:configure` once first). Google Maps keys for builds go in `GOOGLE_MAPS_ANDROID_API_KEY` /
`GOOGLE_MAPS_IOS_API_KEY` (in `apps/mobile/.env` or as EAS environment variables). Never commit them.

## Useful commands (repo root)

| Command | What it does |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres + PostGIS and Redis |
| `pnpm db:migrate` | Apply new SQL migrations from `backend/migrations` |
| `pnpm backend` | Backend in watch mode |
| `pnpm mobile` | Expo dev server for the app (passenger + driver mode) |
| `pnpm admin` | Admin panel on http://localhost:3001 |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit tests (shared + backend) |
| `pnpm --filter @apniride/backend test:e2e` | API tests against real Postgres + Redis (needs `pnpm db:up`) |
| `pnpm build` | Build shared, backend, admin |

## Status

- [x] Product brief
- [x] Monorepo (Turborepo + pnpm)
- [x] Backend skeleton with `/health` (Postgres + PostGIS, Redis)
- [x] One mobile app with passenger + driver mode (switch without a new code)
- [x] Admin panel (see [docs/admin.md](docs/admin.md))
- [x] Phone OTP signup – passenger + driver (dev SMS only; see [docs/auth.md](docs/auth.md))
- [x] Fixed fare estimate: bike + car (AC), per-city rates, 10-min quotes (see [docs/fares.md](docs/fares.md))
- [x] Booking + dispatch: driver goes online, nearest driver gets a 15 s offer, accept → arrived → start → complete, cancel by either side (see [docs/rides.md](docs/rides.md))
- [x] Live driver tracking on the passenger map with ETA (only during the passenger's own ride)
- [ ] Real SMS provider
