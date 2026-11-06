# Side menu: ride history, profile, settings, saved places

The side menu (like inDrive's) opens from the ☰ button in driver mode and from your avatar (top left) on the passenger
home. The passenger home's bottom nav also links Trips (history) and Profile. Both modes:

| Item | Passenger mode | Driver mode |
| --- | --- | --- |
| Account (photo, name, masked number) | ✓, opens Profile | ✓, opens Profile |
| Ride history | Finished rides | **Rides and earnings**: cash today / last 7 days / all time, then the rides |
| Saved places | ✓ | not shown (places are for booking) |
| Profile | Photo, name, delete account | + link to the driver registration |
| Settings and help | Language, help, emergency numbers (15 / 1122), version | same |
| Driver mode / Passenger mode | Greyed out while a ride is going on | Greyed out while online or on a ride |
| Sign out | ✓ | Greyed out while online or on a ride |

The menu is a plain React Native `Modal` (fade), not a drawer library: no gesture / animation packages, which keeps
low-end phones fast. It opens from the start side, so it is on the right in Urdu (RTL).

Code: `apps/mobile/src/components/SideMenu.tsx`, screens in `apps/mobile/src/app/{history,places}/`, `profile.tsx`,
`settings.tsx`, data hooks in `lib/account.ts`, language in `lib/language.ts`.

## API

| Endpoint | Mode | Notes |
| --- | --- | --- |
| `GET /rides/history?cursor=` | passenger | Completed, cancelled and "no driver" rides, newest first, 20 per page |
| `GET /driver/rides/history?cursor=` | driver | Completed and cancelled rides of this driver |
| `GET /driver/earnings` | driver | `{ today, last7Days, allTime }` each `{ rides, cash }`. Completed rides, Pakistan days |
| `GET /me/photo` | both | The user's own photo (Bearer token). `?v=<photoUpdatedAt>` lets the phone cache it |
| `PUT /me/photo` | both | multipart `file`, JPEG/PNG (checked from the bytes), ≤ 5 MB. The app sends ~512 px |
| `DELETE /me/photo` | both | |
| `DELETE /me` | both | Deletes the account (see below). 409 `go_offline_first` / `active_ride_exists` |
| `GET /me/places` | both | Home, then Work, then the rest |
| `POST /me/places` | both | `{ kind: home/work/other, label, location }`. A second Home / Work replaces the first. Max 20 |
| `PUT /me/places/:id`, `DELETE /me/places/:id` | both | Only your own places; delete is idempotent |

History items are the normal `Ride` plus `endedAt`. First names only, never phone numbers.
**Pagination** is keyset on `(created_at, id)`. The cursor carries `created_at` in exact microseconds (a JS `Date`
would round to milliseconds and could skip or repeat rides between pages).

The history list refreshes itself when a ride ends (the socket's `ride:update`), and on pull-down.
The detail screen uses the ride already in the list and shows a still map (Android "lite mode": cheap on low-end
phones). There are **no addresses**: we don't geocode (that's a paid Google API), so places and rides show pins
and the names the passenger gave.

## Deleting an account

Required by the Play Store. `DELETE /me`, after a confirmation dialog in the app:

- Refused while the user is online as a driver or has a ride going on. Admins can't delete themselves in the app.
- **Removed:** phone number, name, profile photo, saved places, driver document photos, every session (all phones).
- **Kept:** the ride records (with an empty name and no number), for safety and complaints. The driver row
  (CNIC, licence, vehicle) stays, set to `suspended` with the note "Account deleted by the user", so a removed driver
  can't sign up again with the same CNIC (`cnic_taken`). **The owner should confirm this policy** before launch and
  mention it in the privacy policy.
- The same phone number can sign up again later, as a brand-new account.
- The admin panel shows "deleted account" instead of the number.

## Language

Settings → Language: **Phone language** (default), English or اردو. Text changes at once. The right-to-left layout
needs the app to be closed and reopened (React Native only applies `I18nManager.forceRTL` on start); the screen
says so. The choice is kept in SecureStore (`apniride.language`) and applied before the splash screen hides.

## Not done yet

- The profile photo is only shown to the user. Showing it to the other person on a ride (and using the driver's
  reviewed selfie for drivers) comes with ratings.
- Per-city feature flags (still missing, see CLAUDE.md): the menu items aren't switchable per city yet.
- Changing the phone number, help chat / support contact, and notification settings (no push notifications yet).
