# Running ApniRide on any device

The apps are Expo (React Native) apps. They run on **Android phones, iPhones, the Android emulator and the iOS
simulator**. They **don't run in a web browser**, because the map library (react-native-maps) has no web version.

Every option needs the **backend** running somewhere the device can reach (section 1).

## Which option do I need?

| I want to… | Use | Needs |
| --- | --- | --- |
| Try it on my Android phone, same Wi-Fi as the PC | [2. Expo Go (Android)](#2-android-phone-expo-go) | Expo Go app |
| Try it on an iPhone, same Wi-Fi as the PC | [3. Expo Go (iPhone)](#3-iphone-expo-go) | Expo Go app. **No Mac needed** |
| Run it on the PC without a phone | [4. Android emulator](#4-android-emulator-windows--mac--linux) / [5. iOS simulator](#5-ios-simulator-mac-only) | Android Studio / a Mac with Xcode |
| Phone on mobile data or a different Wi-Fi | [6. Tunnels](#6-phone-on-a-different-network-mobile-data-office-wi-fi) | Free tunnel (cloudflared) |
| Give testers an app to install, no PC connection | [7. Installable APK (EAS)](#7-installable-android-app-for-testers-eas-build) | Expo account, public backend |
| Set up on another computer | [8. New computer](#8-setting-up-on-another-computer-windows-mac-linux) | Node, pnpm, Git, Docker |

> **Lahore only.** Fares and going online only work inside the Lahore service area (35 km around Liberty
> Market). On an emulator or simulator, set its GPS to Lahore (see 4 and 5). Testers outside Lahore can still
> try the passenger app: deny location access and place the pickup pin on the map by hand, somewhere in Lahore.

---

## 1. Start the backend (always)

On the PC, from the repo root:

```bash
pnpm db:up        # Postgres + Redis in Docker (Docker Desktop must be running)
pnpm db:migrate   # create / update tables
pnpm backend      # API + Socket.IO on port 3000
```

Check http://localhost:3000/health → `"status":"ok"`.

The apps find the backend automatically: they use the **same computer that runs Metro**, on port 3000
(e.g. `http://192.168.100.6:3000`). To use a different backend, put `EXPO_PUBLIC_API_URL` in the app's `.env`
(section 6).

**Windows Firewall** (once). Phones must be allowed to reach ports 3000, 8081 and 8082. Click **Allow** when
Windows asks about Node.js, or run this in an **Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "ApniRide dev" -Direction Inbound -Protocol TCP -LocalPort 3000,8081,8082 -Action Allow -Profile Private
```

Also set your Wi-Fi to a **Private** network (Settings → Network → Wi-Fi → your network → Private).

**Quick test from the phone:** open `http://<PC IP>:3000/health` in the phone's browser. If that doesn't
load, the app can't reach the backend either. It's the firewall or the network, not the app.
Find the PC's IP with `ipconfig` (Windows) or `ipconfig getifaddr en0` (Mac).

---

## 2. Android phone (Expo Go)

1. Play Store → install **Expo Go** (keep it updated: it must support Expo **SDK 58**).
2. Phone and PC on the **same Wi-Fi**.
3. On the PC: `pnpm passenger` (passenger app, port 8081) or `pnpm driver` (driver app, port 8082).
   For both apps, run them in two terminals.
4. Expo Go → **Scan QR code** → scan the QR in the terminal. The first load takes about a minute.

Works fully: maps (Google), location, sign-in, booking and tracking. Shake the phone for the dev menu, or press
`r` in the terminal to reload.

## 3. iPhone (Expo Go)

1. App Store → install **Expo Go**.
2. Same Wi-Fi as the PC. Run `pnpm passenger` / `pnpm driver` as above.
3. Scan the QR with the **iPhone Camera app** (not inside Expo Go) → tap the banner → it opens in Expo Go.
4. Allow **Local Network** access when iOS asks. Without it the app can't reach Metro or the backend
   (Settings → Privacy & Security → Local Network → Expo Go).

On iPhone the map is **Apple Maps** (Google Maps on iOS needs our own build with a key; see
`apps/*/src/lib/map-provider.ts`). Everything else is the same. No Mac is needed for this.

## 4. Android emulator (Windows / Mac / Linux)

1. Install **Android Studio** → **Device Manager** → **Create device** → pick a phone → choose a system image
   **with "Google Play"** (needed for Google Maps) → Finish → ▶ start it.
2. Run `pnpm passenger` (or `pnpm driver`), then press **`a`** in the terminal. Expo installs Expo Go in the
   emulator and opens the app.
3. **Put the emulator in Lahore:** click **⋯ (Extended controls)** → **Location** → search "Liberty Market
   Lahore" or enter `31.5104, 74.3416` → **Set location**. Otherwise the emulator thinks it's in California and you get
   "outside service area".
4. If the app says "Server unreachable", create `apps/<app>/.env` with
   `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (10.0.2.2 = "the PC" from inside the emulator) and restart with
   `pnpm --filter @apniride/passenger start --clear`.

Tip: run the **driver app on the emulator** and the **passenger app on your phone** to test a whole ride with one
phone. Set the emulator's location close to where your phone is.

## 5. iOS simulator (Mac only)

1. Install **Xcode** from the App Store and open it once (it installs the simulators).
2. `pnpm passenger`, then press **`i`**.
3. **Put the simulator in Lahore:** simulator menu **Features → Location → Custom Location…** →
   latitude `31.5104`, longitude `74.3416`.

## 6. Phone on a different network (mobile data, office Wi-Fi)

You need two tunnels: one for **Metro** (the app code) and one for the **backend** (API + Socket.IO).

1. **Backend tunnel.** In a new terminal on the PC:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   It prints a public URL like `https://random-words.trycloudflare.com`. Free, no account. It changes every time
   you restart it.
2. **Point the app at it.** Create `apps/passenger/.env` (and/or `apps/driver/.env`). These files are gitignored:
   ```
   EXPO_PUBLIC_API_URL=https://random-words.trycloudflare.com
   ```
3. **Metro tunnel.** Start the app with `pnpm --filter @apniride/passenger start:tunnel --clear`
   (driver: `@apniride/driver`). The first time, Expo asks to install `@expo/ngrok`; say yes.
4. Scan the new QR code. It works on any network.

When you're back on the same Wi-Fi, **delete the `.env` line** (or the file) and restart with `--clear` so the app
auto-detects the PC again.

## 7. Installable Android app for testers (EAS Build)

For people who should install ApniRide like a normal app, without a PC, Expo Go or a QR code. EAS builds the
APK in Expo's cloud. No Android Studio is needed.

**Before you build:**
- The backend must be reachable from the internet: a server/VPS, or (for a quick test) the cloudflared URL from
  section 6, which only works while your PC is on.
- A **Google Maps Android API key**. Expo Go has its own, but our APK needs ours or the map is blank.
  Google Cloud Console → enable "Maps SDK for Android" → create an API key → restrict it to the app's package
  (`pk.apniride.passenger` / `pk.apniride.driver`) and the build's SHA-1 (shown on expo.dev → project →
  Credentials).

**Build:**
```bash
npm install -g eas-cli
eas login                                        # free Expo account
cd apps/passenger
eas init                                         # once per app
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-backend.example.com --environment preview --visibility plaintext
eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <your key> --environment preview --visibility sensitive
pnpm build:preview                               # ≈ 10–20 min in the cloud
```
When it finishes you get a **link + QR code**. Testers open it on their Android phone → download → install
(Android asks to allow "install unknown apps" once). Repeat in `apps/driver` for the driver app.

After that, JS-only changes can be pushed to installed apps without a new build: `pnpm update`
(EAS Update; run `eas update:configure` once first).

**iPhone builds** (TestFlight) need an Apple Developer account ($99/year): `eas build --platform ios`, then
`eas submit`. We haven't set this up yet.

## 8. Setting up on another computer (Windows, Mac, Linux)

1. Install **Node.js 22+**, **Git** and **Docker** (Docker Desktop on Windows/Mac: on Windows it needs WSL 2;
   if it says "unable to start", run `wsl --update` as admin and reboot. On Linux, Docker Engine).
2. `npm install -g pnpm`
3. ```bash
   git clone https://github.com/bizworld1v1-creator/apniride.git
   cd apniride
   pnpm install
   cp backend/.env.example backend/.env     # Windows PowerShell: copy backend\.env.example backend\.env
   ```
4. Then section 1 (backend) and any of sections 2–7.

`backend/.env.example` has working dev values (code shown in the app instead of SMS, drivers auto-approved).
Generate your own `JWT_SECRET` / `OTP_SECRET` for anything shared:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

---

## Testing a whole ride: device combinations

The driver must be **within 5 km of the pickup**, and both apps need to reach the same backend.

| Passenger app on | Driver app on | Notes |
| --- | --- | --- |
| Phone | Same phone | Run both in Expo Go and switch between them. The same number is fine in development |
| Phone A | Phone B | Both on the same Wi-Fi (or both via tunnels, section 6) |
| Phone | Android emulator | Set the emulator's location near the phone (section 4) |
| Emulator | Emulator / simulator | Give both a Lahore location a few hundred metres apart |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| QR scans but "Could not connect to development server" | Same Wi-Fi? Firewall (section 1)? Office/hotel Wi-Fi often blocks devices from seeing each other: use tunnels (section 6) |
| "Server unreachable" / "No internet connection" in the app | Open `http://<PC IP>:3000/health` on the phone. Fails → firewall/network. Works → check `EXPO_PUBLIC_API_URL` in `apps/<app>/.env` and restart with `--clear` |
| "Sorry, we only serve Lahore for now" / driver "outside our service area" | Device GPS isn't in Lahore. Emulator: set the location. Passenger: place the pickup pin in Lahore by hand |
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the Play Store / App Store |
| Map is blank in an EAS-built APK | Missing or restricted Google Maps key (section 7) |
| Driver never gets the ride | Same vehicle type (bike/car) as the booking? Driver online and within 5 km of the pickup? |
| The PC's IP changed (new Wi-Fi) | Nothing to do: the apps detect it from Metro. Just rescan the QR |
