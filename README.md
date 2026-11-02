# ApniRide

Trust-first ride-hailing app for Pakistan. *Thanda safar, mehfooz safar, waqt pe safar.*

See [CLAUDE.md](CLAUDE.md) for the product vision, signature features, v1 scope and tech stack.

## Repo layout

```
apps/passenger     Expo (React Native) passenger app
apps/driver        Expo (React Native) driver app
apps/admin         Next.js admin panel (placeholder)
backend            NestJS API (+ Socket.IO later)
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
```

## Run the backend

```bash
pnpm backend          # builds packages/shared, then the API on http://localhost:3000
```

Check it: open http://localhost:3000/health. You should get `"status":"ok"` with a PostGIS version.
If Docker isn't running you'll get HTTP 503 with `"status":"degraded"`.

## Run the apps on your Android phone (Expo Go)

1. Put your **phone and PC on the same Wi-Fi**.
2. Start the backend (above) so the apps can show "Server connected".
3. In a new terminal, from the repo root:
   - Passenger app: `pnpm passenger` (Metro on port 8081)
   - Driver app: `pnpm driver` (Metro on port 8082). You can run both at once in two terminals.
4. A QR code appears in the terminal. Open **Expo Go** on the phone → **Scan QR code** → scan it.
5. The first load takes a minute. Allow location when asked. You should see a map of Lahore,
   your blue location dot, and a green "Server connected" dot.

The apps find the backend automatically at `http://<your PC's IP>:3000`.
To point them somewhere else, set `EXPO_PUBLIC_API_URL` in `apps/<app>/.env`.

### Troubleshooting

- **Windows Firewall prompt**: when Node.js asks, allow it on **Private networks**. If you missed it, allow
  inbound TCP ports 8081, 8082 and 3000 for Node.js. Also make sure your Wi-Fi is set to a *Private* network.
- **QR code won't connect** (office/hotel Wi-Fi blocks devices from seeing each other): use
  `pnpm --filter @apniride/passenger start:tunnel`. Note that in tunnel mode the phone can't reach your local
  backend, so the app will say "Server unreachable" unless you set `EXPO_PUBLIC_API_URL` to a public URL.
- **"Server unreachable"** but the map works: check http://localhost:3000/health on the PC, then open
  `http://<your PC's IP>:3000/health` in the phone's browser. If that fails, it's the firewall.
- **"Project is incompatible with this version of Expo Go"**: update Expo Go from the Play Store.
- Press `r` in the Metro terminal to reload, or shake the phone for the dev menu.
- Phone language set to **Urdu** → the apps show Urdu text with a right-to-left layout.

### What needs a development build (not Expo Go)

Expo Go is enough for the map and foreground location. These need our own build via EAS:
**background location** in the driver app, your own **Google Maps API key**, push notifications, and
any library that isn't bundled in Expo Go.

```bash
npm install -g eas-cli
eas login                                   # free Expo account
cd apps/driver
eas init                                    # links the app to your Expo account (once per app)
pnpm build:dev                              # cloud build → install the APK on the phone from the link/QR
pnpm start:dev-client                       # then open the installed dev build instead of Expo Go
```

`pnpm build:preview` makes an installable test APK. `pnpm update` ships an over-the-air (EAS Update) JS update
(run `eas update:configure` once first). Google Maps keys for builds go in `GOOGLE_MAPS_ANDROID_API_KEY` /
`GOOGLE_MAPS_IOS_API_KEY` (in `apps/<app>/.env` or as EAS environment variables). Never commit them.

## Useful commands (repo root)

| Command | What it does |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres + PostGIS and Redis |
| `pnpm backend` | Backend in watch mode |
| `pnpm passenger` / `pnpm driver` | Expo dev server for each app |
| `pnpm --filter @apniride/admin dev` | Admin placeholder on http://localhost:3001 |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit tests (shared + backend) |
| `pnpm build` | Build shared, backend, admin |

## Status

- [x] Product brief
- [x] Monorepo (Turborepo + pnpm)
- [x] Backend skeleton with `/health` (Postgres + PostGIS, Redis)
- [x] Passenger app: map screen
- [x] Driver app: map screen + go-online toggle
- [ ] Admin panel (placeholder only)
- [ ] Phone OTP signup
- [ ] Booking, matching, live tracking (Socket.IO)
