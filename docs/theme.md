# Theme (colours, corners, shadows)

Everything visual that we may want to restyle lives in **one file**: `packages/shared/src/theme.ts`.
Change it there and the passenger app, driver app, admin panel and app icon/splash backgrounds all follow.

## How it is built

| Layer | What it is | Example |
| --- | --- | --- |
| `palette` | Raw colours, never used directly by screens | `teal700: '#0E7490'` |
| `baseColors` (roles) | What a colour is *for*, shared by every app | `surface`, `text`, `muted`, `success`, `error`, `pickupPin` |
| `brands` | Per-app brand colours | passenger = teal, driver + admin = amber |
| `radius` | Corner sizes | `sm 8`, `lg 12`, `xl 16`, `pill 20` |
| `elevation` | Android shadow depth | `low 3`, `medium 6`, `high 8` |

`getTheme(app)` merges the roles with that app's brand and returns `{ colors, radius, elevation }`.

## Who reads it

- **Passenger / driver apps:** `apps/*/src/lib/theme.ts` calls `getTheme('passenger' | 'driver')`. Components keep
  importing `colors`, `radius`, `elevation` from `@/lib/theme`.
- **Expo config:** `apps/*/app.config.ts` imports `../../packages/shared/src/theme.ts` (with the `.ts` extension,
  because Expo's config loader runs in plain Node, which strips the types itself; needs Node 22.18+). It sets the
  Android adaptive-icon background and the splash background. These only change in a new build, not in Expo Go
  or an OTA update.
- **Admin panel:** `apps/admin/src/app/layout.tsx` injects `themeCssVariables('admin')` as a `:root { … }` block.
  `globals.css` only uses `var(--…)`: role `brandSoft` becomes `--brand-soft`, and radius `lg` becomes `--radius-lg`.

## Recipes

- **New brand colour for the passenger app:** change `brands.passenger.brand` (and `brandSoft`, the light
  background of a selected option).
- **One colour everywhere** (e.g. a different green): change it in `palette`.
- **Rounder or sharper corners:** change `radius`.
- **A colour a component needs but no role fits:** add a role to `baseColors` (with a comment saying what it is for),
  then use `colors.newRole` in the app or `var(--new-role)` in the admin CSS.

## Rules

- No hex codes, `'white'`/`'red'` strings, raw `borderRadius` numbers or raw `elevation` numbers in components or
  `globals.css`. The only exception is a size tied to an element's own size (e.g. the 6 px progress bar uses a 3 px corner).
- Font sizes are not in the theme yet: they are still set per screen.
- Keep shadows small (`elevation`): low-end Android phones draw them slowly.
