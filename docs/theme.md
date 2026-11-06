# Theme (colours, text, spacing, corners, shadows)

Everything visual that we may want to restyle lives in **one file**: `packages/shared/src/theme.ts`.
Change it there and the mobile app (passenger + driver mode), the admin panel and the app icon/splash backgrounds all
follow.

**Look (since 2026-11-07):** the mobile app follows the design handoff in `ApniRide-design-handoff/`
(`design/DESIGN_SPEC.md`, `design/tokens.json`, `prototype/screens/*.html`): royal blue `#1E40AF`, one yellow accent
`#FFC83D` (always with ink text, never white), ink `#14132B` for text and dark buttons, blue-white background
`#F2F5FC`, pill buttons, 28–36 px cards, Bricolage Grotesque for headlines/prices and Plus Jakarta Sans for the rest.
The admin panel keeps its amber brand and system font for now.

## How it is built

| Token | What it is | Example | Admin CSS variable |
| --- | --- | --- | --- |
| `palette` | Raw colours, never used directly by screens | `royal: '#1E40AF'`, `sun`, `ink`, `mint`, `coral` | none |
| `baseColors` (roles) | What a colour is *for*, shared by every app | `surface`, `text`, `muted`, `ink`, `accent` + `onAccent`, `online`, `danger`, `destination`, `pickupPin` | `--surface`, `--text-secondary` |
| `brands` | Per-app brand colours | mobile app = royal blue, admin = amber | `--brand`, `--brand-soft` |
| `fontSize` | Text sizes, small to large | `sm 13`, `base 15` (body), `xl 17` (buttons), `heading 24`, `price 44`, `wordmark 64`, `priceHero 76` | `--font-size-base` |
| `fontWeight` | `regular 400`, `medium 500`, `semibold 600`, `bold 700`, `extraBold 800` | `fontWeight.semibold` | `--font-weight-semibold` |
| `fontFamily` | `display` (Bricolage Grotesque 700/800), `body` (Plus Jakarta Sans 400–700), one name per weight; `web` (admin) | | `--font-family` |
| `letterSpacing` | `code 12` (OTP), `pin 4`, `heading -0.5`, `tight -1`, `wordmark -2.5`, `priceHero -3` | | none |
| `iconSize` / `iconStroke` | Icon sizes `sm 20`, `md 24`, `lg 28`, `xl 36`; line width 2.2 | | none |
| `size` | Fixed element sizes: `iconButton 46`, `ctaArrow 48`, `avatar 56`, `bottomNav 68`, `countdownRing 56`, `routeDot 12`, pager dots | | none |
| `shadowSpec` | Soft shadows: `card` (blue 15 %), `sheet` (ink 8 %, upwards) | `shadow.card` in the app | none |
| `motion` | Easing curves (bezier points), durations, `stagger 70`, press scales | `easing.spring` in the app | none |
| `space` | Padding / margin / gap. `space[n]` = n × `SPACE_UNIT` (4 px) | `space[4]` = 16 px, `space[0.5]` = 2 px | `--space-4`, `--space-0-5` |
| `radius` | Corner sizes | `lg 12`, `chip 14`, `card 28`, `hero 32`, `stack 34`, `sheet 36`, `pill 999` | `--radius-lg` |
| `elevation` | Android shadow depth | `low 3`, `medium 6`, `high 8` | none |
| `borderWidth` | `thin 1`, `thick 2` (selected option) | | `--border-width-thin` |
| `touch` | Tap targets: `min 44`, `button 60`, `buttonLarge 62`, `hitSlop 8` | | none |
| `opacity` | `dim 0.7`, `disabled 0.5`, `faint 0.4` | | `--opacity-disabled` |

`getTheme(app)` merges the roles with that app's brand and returns all of the above.

## Who reads it

- **Mobile app:** `apps/mobile/src/lib/theme.ts` calls `getTheme('mobile')` (one brand for both modes). Components import
  only what they need, e.g. `import { colors, fontSize, space } from '@/lib/theme'`, and write
  `{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, padding: space[4] }`.
- **Expo config:** `apps/mobile/app.config.ts` imports `../../packages/shared/src/theme.ts` (with the `.ts` extension,
  because Expo's config loader runs in plain Node, which strips the types itself; needs Node 22.18+). It sets the
  Android adaptive-icon background and the splash background. These only change in a new build, not in Expo Go
  or an OTA update.
- **Admin panel:** `apps/admin/src/app/layout.tsx` injects `themeCssVariables('admin')` as a `:root { … }` block.
  `globals.css` only uses `var(--…)` (see the table for the names).

## Fonts, motion and components (mobile app)

- **Fonts:** `apps/mobile/src/lib/fonts.ts` bundles the six font files (no download) and `app/_layout.tsx` loads them
  behind the splash screen. Use the ready-made styles `text.h1`, `text.h2`, `text.title`, `text.body`, `text.label`,
  `text.caption`, `text.price`, `text.priceHero`, `text.wordmark` (from `@/lib/theme`), or `bodyFont('bold')` /
  `displayFont('extraBold', letterSpacing.tight)` for custom styles. Don't set `fontWeight` together with a custom
  font family (Android then picks a wrong face).
- **Urdu:** these fonts have no Urdu letters, and letter spacing breaks joined Urdu letters. When the app runs
  right-to-left (Urdu), `bodyFont` / `displayFont` return the system font with a `fontWeight` and no letter spacing.
- **Motion:** `apps/mobile/src/lib/motion.ts`: `useEnter(from, index)` (pop / slide in, staggered), `useLoop` (gentle
  loops), `useJelly(value)` (bounce when a price changes), `useReduceMotion()`. Native driver only (transform and
  opacity). With the phone's "reduce motion" setting on, loops stop and things only fade.
- **Shared components:** `apps/mobile/src/components/ui/`: `Button` (`ink` with the yellow arrow, `light`, `primary`,
  `outline`, `danger`), `IconButton` (needs a `label` for screen readers), `Card` (`plain` / `hero`), `Chip`,
  `RouteConnector`, `BottomNav`, `CountdownRing`, `Initials`, `ComingSoonBadge`, `PressableScale`, `Icon` (Lucide
  line icons; only the ones we use are copied in, to keep the app small).
- **Preview:** in development, Settings → "UI preview (dev only)" shows every component on one screen.

## Recipes

- **New brand colour for the mobile app:** change `brands.mobile.brand` (and `brandSoft`, the light
  background of a selected option).
- **One colour everywhere** (e.g. a different green): change it in `palette`.
- **Bigger or smaller text:** change the numbers in `fontSize` (e.g. `base` for all body text).
- **Tighter or roomier screens:** change `SPACE_UNIT` (4 → 5 makes every padding, margin and gap 25% bigger).
- **A different font:** add its files to `fontAssets` in `apps/mobile/src/lib/fonts.ts` and change the names in
  `fontFamily`; set `fontFamily.web` for the admin panel.
- **Rounder or sharper corners:** change `radius`.
- **A value a component needs but no token fits:** add a token here (with a comment saying what it is for), then use it
  in the app or as a `var(--…)` in the admin CSS.

## Rules

- No hex codes, `'white'`/`'red'` strings, or raw numbers for font size, font weight, padding/margin/gap, corners,
  shadows, borders, opacity or button heights in components or `globals.css`. `0` is fine.
- Never white text on the yellow accent: use `colors.onAccent` (ink). `danger` and `online` are fills; for red or
  green *text* use `error` / `success` (they pass 4.5:1 contrast).
- Exceptions are sizes tied to the element itself: the 6 px progress bar and its 3 px corner, the 8 px status dot,
  image/thumbnail sizes, vehicle marker art, admin column widths, and the map camera's `edgePadding`.
- Keep shadows small (`elevation`): low-end Android phones draw them slowly.
- Don't go below `fontSize.xs` (12): many users turn on large system text.
