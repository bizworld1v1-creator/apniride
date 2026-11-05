# Theme (colours, text, spacing, corners, shadows)

Everything visual that we may want to restyle lives in **one file**: `packages/shared/src/theme.ts`.
Change it there and the passenger app, driver app, admin panel and app icon/splash backgrounds all follow.

## How it is built

| Token | What it is | Example | Admin CSS variable |
| --- | --- | --- | --- |
| `palette` | Raw colours, never used directly by screens | `teal700: '#0E7490'` | none |
| `baseColors` (roles) | What a colour is *for*, shared by every app | `surface`, `text`, `muted`, `success`, `pickupPin` | `--surface`, `--text-secondary` |
| `brands` | Per-app brand colours | passenger = teal, driver + admin = amber | `--brand`, `--brand-soft` |
| `fontSize` | Text sizes, small to large | `sm 13`, `base 15` (body), `xl 17` (buttons), `heading 24` | `--font-size-base` |
| `fontWeight` | `regular 400`, `medium 500`, `semibold 600`, `bold 700`, `extraBold 800` | `fontWeight.semibold` | `--font-weight-semibold` |
| `fontFamily` | `app` (phone system font for now), `web` (admin) | | `--font-family` |
| `letterSpacing` | `code 12` (OTP input) | | none |
| `iconSize` | Emoji sizes: `md 24`, `lg 28`, `xl 36` | map pin, vehicle icons | none |
| `space` | Padding / margin / gap. `space[n]` = n × `SPACE_UNIT` (4 px) | `space[4]` = 16 px, `space[0.5]` = 2 px | `--space-4`, `--space-0-5` |
| `radius` | Corner sizes | `sm 8`, `lg 12`, `xl 16`, `pill 20` | `--radius-lg` |
| `elevation` | Android shadow depth | `low 3`, `medium 6`, `high 8` | none |
| `borderWidth` | `thin 1`, `thick 2` (selected option) | | `--border-width-thin` |
| `touch` | Tap targets: `min 40`, `button 54`, `buttonLarge 56`, `hitSlop 8` | | none |
| `opacity` | `dim 0.7`, `disabled 0.5`, `faint 0.4` | | `--opacity-disabled` |

`getTheme(app)` merges the roles with that app's brand and returns all of the above.

## Who reads it

- **Passenger / driver apps:** `apps/*/src/lib/theme.ts` calls `getTheme('passenger' | 'driver')`. Components import
  only what they need, e.g. `import { colors, fontSize, space } from '@/lib/theme'`, and write
  `{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, padding: space[4] }`.
- **Expo config:** `apps/*/app.config.ts` imports `../../packages/shared/src/theme.ts` (with the `.ts` extension,
  because Expo's config loader runs in plain Node, which strips the types itself; needs Node 22.18+). It sets the
  Android adaptive-icon background and the splash background. These only change in a new build, not in Expo Go
  or an OTA update.
- **Admin panel:** `apps/admin/src/app/layout.tsx` injects `themeCssVariables('admin')` as a `:root { … }` block.
  `globals.css` only uses `var(--…)` (see the table for the names).

## Recipes

- **New brand colour for the passenger app:** change `brands.passenger.brand` (and `brandSoft`, the light
  background of a selected option).
- **One colour everywhere** (e.g. a different green): change it in `palette`.
- **Bigger or smaller text:** change the numbers in `fontSize` (e.g. `base` for all body text).
- **Tighter or roomier screens:** change `SPACE_UNIT` (4 → 5 makes every padding, margin and gap 25% bigger).
- **A custom font:** load it with `expo-font`, set `fontFamily.app`, and add it to the text styles; set `fontFamily.web`
  for the admin panel.
- **Rounder or sharper corners:** change `radius`.
- **A value a component needs but no token fits:** add a token here (with a comment saying what it is for), then use it
  in the app or as a `var(--…)` in the admin CSS.

## Rules

- No hex codes, `'white'`/`'red'` strings, or raw numbers for font size, font weight, padding/margin/gap, corners,
  shadows, borders, opacity or button heights in components or `globals.css`. `0` is fine.
- Exceptions are sizes tied to the element itself: the 6 px progress bar and its 3 px corner, the 8 px status dot,
  image/thumbnail sizes, vehicle marker art, admin column widths, and the map camera's `edgePadding`.
- Keep shadows small (`elevation`): low-end Android phones draw them slowly.
- Don't go below `fontSize.xs` (12): many users turn on large system text.
