/**
 * ApniRide theme: the ONE place to change how every app looks.
 *
 * Used by the mobile app (passenger + driver mode, via `src/lib/theme.ts`), the admin panel (as CSS variables,
 * see `themeCssVariables`) and the Expo app configs (icon + splash background).
 *
 * To restyle:
 *  - change a raw colour in `palette` to change it everywhere it is used, or
 *  - point a role in `baseColors` / `brands` at a different palette colour to change just that role.
 * Components must never hard-code colours, corner sizes or shadows: add a token here instead.
 */

/**
 * Raw colours. Components don't use these directly; they use the named roles below.
 * The blue / sun / ink look comes from the design handoff (`ApniRide-design-handoff/design/tokens.json`, 2026-11-07).
 */
export const palette = {
  white: '#FFFFFF',

  /** Brand royal blue and its tints. */
  royal: '#1E40AF',
  royalPressed: '#17338C',
  royalTint: '#E3EAFB',
  royalTint2: '#D6E0F7',
  royalTint3: '#B7C8EE',

  /** The one accent: CTA arrow circle, price strip, ride PIN, active nav pill. Never put white text on it. */
  sun: '#FFC83D',
  /** Online / verified fills. Too light for text: use `green700` for success text. */
  mint: '#1FC79A',
  mintSoft: '#D5F5EA',
  /** Destination marker. */
  coral: '#FF8A5B',
  /** SOS button, notification dot. Too light for small text: use `red700`. */
  danger: '#FF5A5F',

  /** Text, dark buttons, bottom nav. */
  ink: '#14132B',
  /** Secondary text (4.5:1 on white and on the background). */
  inkMuted: '#5B5A72',

  /** Soft blue-white app background. */
  mist: '#F2F5FC',
  /** Outline buttons, unselected chips. */
  line: '#DDE3EF',
  /** Progress tracks, list dividers. */
  lineLight: '#EBEFF7',
  /** Inactive dots / icons. */
  grey: '#C5CCDB',

  map: '#E1E8F6',
  mapPark: '#C9F0DF',

  green700: '#0B7A5C',
  green900: '#065F46',

  red50: '#FFF1F1',
  red100: '#FFE0E1',
  red700: '#C62828',
  red800: '#991B1B',

  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber500: '#F59E0B',
  amber700: '#B45309',
  amber800: '#92400E',
} as const;

/** Colour roles shared by every app. */
const baseColors = {
  /** Screen background behind cards. */
  background: palette.mist,
  /** Cards, sheets, inputs. */
  surface: palette.white,
  /** Subtle fill: progress-bar track, empty photo boxes, tiles inside a card. */
  surfaceMuted: palette.lineLight,

  text: palette.ink,
  /** Secondary text that still needs to be easy to read (taglines). */
  textSecondary: palette.inkMuted,
  /** Small helper text (server status). */
  textTertiary: palette.inkMuted,
  /** Hints, labels, placeholders. */
  muted: palette.inkMuted,

  border: palette.line,
  borderLight: palette.lineLight,

  /** Text / spinners on a coloured button (brand, success, danger). */
  onColor: palette.white,

  /** Dark buttons ("Send offer to drivers"), bottom nav, Ride PIN tile. */
  ink: palette.ink,
  /** The yellow accent and the text that goes on it (always ink, never white). */
  accent: palette.sun,
  onAccent: palette.ink,
  /** Pressed brand button; road band on the splash. */
  brandPressed: palette.royalPressed,
  /** Back and middle cards of the stacked offers deck, dashed route line. */
  brandTint2: palette.royalTint2,
  brandTint3: palette.royalTint3,
  /** White at 18 %: icon buttons on a blue background. */
  onBrandSubtle: 'rgba(255, 255, 255, 0.18)',
  /** White at 75 %: secondary text on a blue background. */
  onBrandMuted: 'rgba(255, 255, 255, 0.78)',

  /** Online / verified fills (power button, live dot, valid phone tick). */
  online: palette.mint,
  /** SOS button, notification dot. */
  danger: palette.danger,
  /** Destination square on the route connector. */
  destination: palette.coral,
  /** Inactive pager dots and icons; "Coming soon" tiles. */
  disabled: palette.grey,

  success: palette.green700,
  successSoft: palette.mintSoft,
  successText: palette.green900,

  error: palette.red700,
  errorSoft: palette.red50,
  errorSoftStrong: palette.red100,
  errorText: palette.red800,

  warning: palette.amber500,
  warningSoft: palette.amber100,
  warningText: palette.amber800,
  /** Warning text on white, e.g. "location last updated 2 min ago". */
  warningStrong: palette.amber700,

  infoSoft: palette.royalTint,
  /** "Checking…" grey dot. */
  neutral: palette.grey,

  /** Development-only banners (OTP code shown on screen). */
  devBg: palette.amber100,
  devText: palette.amber800,

  /** Map pins and drawn maps. */
  pickupPin: palette.royal,
  dropoffPin: palette.coral,
  map: palette.map,
  mapPark: palette.mapPark,

  /** Dims the screen behind the side menu and other overlays (ink at 45%). */
  overlay: 'rgba(20, 19, 43, 0.45)',
  /** Shadow colour of cards and sheets (iOS; Android uses `elevation`). */
  shadow: palette.royal,

  /** Expo splash screen background. */
  splash: palette.royal,
};

/** Per-app brand colours. The mobile app has one brand for both modes; driver mode shows a "Driver mode" label. */
export const brands = {
  mobile: { brand: palette.royal, brandSoft: palette.royalTint, appIconBackground: palette.royal },
  admin: { brand: palette.amber700, brandSoft: palette.amber50, appIconBackground: palette.amber100 },
} as const;

export type AppName = keyof typeof brands;

/** Corner sizes. The design is very round: pill buttons and 28–36 px cards. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  /** Chips / tags with corners (not full pills), tiles inside a card. */
  chip: 14,
  xl: 16,
  /** Phone input. */
  input: 29,
  /** Cards. */
  card: 28,
  /** Blue hero card, map card. */
  hero: 32,
  /** Offer cards in the stacked deck. */
  stack: 34,
  /** Bottom sheets. */
  sheet: 36,
  /** Bottom sheet on the sign-in screen. */
  sheetLarge: 40,
  /** Fully rounded: buttons, chips, the bottom nav. */
  pill: 999,
} as const;

/** Android shadow depth (low-end phones: keep these small). */
export const elevation = {
  low: 3,
  medium: 6,
  high: 8,
} as const;

/**
 * Soft shadows (iOS; Android uses `elevation`). `card` = 0 8px 20px brand blue at 15 %,
 * `sheet` = 0 -6px 20px ink at 8 % (bottom sheets cast upwards).
 */
export const shadowSpec = {
  card: { opacity: 0.15, blur: 20, offsetY: 8 },
  sheet: { opacity: 0.08, blur: 20, offsetY: -6 },
} as const;

/** Text sizes (px). Low-end phones often have large system font scaling on, so don't go much smaller than `xs`. */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  /** Normal body text. */
  base: 15,
  lg: 16,
  /** Button labels. */
  xl: 17,
  xxl: 18,
  /** Card titles (driver ride card). */
  title: 19,
  /** App name in the map header. */
  brand: 20,
  /** App name on the sign-in screens. */
  brandLarge: 22,
  /** Screen titles. */
  heading: 24,
  /** OTP code input. */
  code: 28,
  /** Fare on the driver's active ride card. */
  amount: 30,
  /** Big numbers on the admin dashboard. */
  stat: 32,
  /** Fare on the driver's offer card. */
  amountLarge: 36,
  /** Big price on the offers card and the passenger's fare card. */
  price: 44,
  /** "ApniRide." on the splash. */
  wordmark: 64,
  /** The rider's offer on the "Name your price" card. */
  priceHero: 76,
} as const;

/** Font weights. Strings, because React Native only accepts them as strings. */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extraBold: '800',
} as const;

/**
 * Font families (Google Fonts, bundled with the app and loaded by expo-font in `apps/mobile/src/lib/fonts.ts`).
 * `display` (Bricolage Grotesque) is for headlines, prices and numbers; `body` (Plus Jakarta Sans) for everything
 * else. React Native needs one family name per weight, so the names are listed per weight.
 * These fonts have no Urdu letters: in Urdu the app uses the phone's system font instead (see `fonts.ts`).
 */
export const fontFamily = {
  display: { bold: 'BricolageGrotesque_700Bold', extraBold: 'BricolageGrotesque_800ExtraBold' },
  body: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
  /** Admin panel: the computer's system font (the admin panel keeps its own look for now). */
  web: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Extra letter spacing (px). Negative = tighter. Never used for Urdu (it breaks joined letters). */
export const letterSpacing = {
  /** Spread-out digits of the OTP code input. */
  code: 12,
  /** Ride PIN digits. */
  pin: 4,
  /** Headings (24–32 px). */
  heading: -0.5,
  /** Large headings and prices (32–44 px). */
  tight: -1,
  /** Wordmark (64 px). */
  wordmark: -2.5,
  /** Hero price (76 px). */
  priceHero: -3,
} as const;

/** Emoji / icon sizes (px). */
export const iconSize = {
  /** Icons inside buttons and rows. */
  sm: 20,
  md: 24,
  lg: 28,
  xl: 36,
} as const;

/** Line-icon stroke width (px). The design uses 2–2.6 px rounded strokes. */
export const iconStroke = 2.2;

/** Fixed element sizes from the design (px). */
export const size = {
  /** Round icon button (back, bell, chat, call). */
  iconButton: 46,
  /** Yellow arrow circle inside the dark CTA. */
  ctaArrow: 48,
  /** Avatars: rows, offer card. */
  avatar: 56,
  avatarLarge: 68,
  /** Bottom nav bar height. */
  bottomNav: 68,
  /** Countdown ring on an offer card, and its stroke. */
  countdownRing: 56,
  countdownStroke: 5,
  /** Route connector: pickup dot and drop-off square. */
  routeDot: 12,
  /** Pager dots under the offer deck (the active one is wider). */
  pagerDot: 8,
  pagerDotActive: 24,
  /** Thin progress bars (trip steps, request countdown) and their corner. */
  progressBar: 8,
  /** Blue top area of the sign-in screens. */
  authHeader: 200,
  /** OTP digit circles (they shrink to fit 6 on a narrow phone). */
  otpCircle: 64,
} as const;

/**
 * Motion. Easing curves are cubic-bezier control points [x1, y1, x2, y2] (y > 1 = a springy overshoot);
 * use them with React Native's `Easing.bezier(...)`. Durations in ms. When the phone's "reduce motion" setting is on,
 * the app turns off loops and uses plain fades (`apps/mobile/src/lib/motion.ts`).
 */
export const motion = {
  easing: {
    /** Things popping in. */
    spring: [0.2, 0.9, 0.3, 1.3],
    /** Big things (sun, badge) popping in. */
    springBig: [0.2, 0.9, 0.3, 1.4],
    /** Bottom sheets sliding up. */
    sheet: [0.2, 0.9, 0.25, 1.05],
  },
  duration: { fast: 200, base: 600, enter: 700, sheet: 800, hero: 900 },
  /** Delay between items that pop in one after another. */
  stagger: 70,
  /** Buttons shrink to this when pressed. */
  pressScale: 0.94,
  /** Small keys (number pad) shrink more. */
  pressScaleSmall: 0.9,
} as const;

/**
 * Spacing for padding, margin and gap. Every step is a multiple of `SPACE_UNIT`:
 * `space[4]` = 4 × 4 = 16 px. Change `SPACE_UNIT` to make every screen tighter or roomier at once.
 */
export const SPACE_UNIT = 4;
const step = (n: number) => n * SPACE_UNIT;
export const space = {
  0.5: step(0.5),
  0.75: step(0.75),
  1: step(1),
  1.5: step(1.5),
  2: step(2),
  2.5: step(2.5),
  3: step(3),
  3.5: step(3.5),
  4: step(4),
  4.5: step(4.5),
  5: step(5),
  6: step(6),
  6.5: step(6.5),
  7: step(7),
  8: step(8),
  10: step(10),
  12: step(12),
  20: step(20),
} as const;

/** Border thickness (px). */
export const borderWidth = {
  thin: 1,
  /** Selected option outline. */
  thick: 2,
} as const;

/** Tap targets (px). Big buttons matter: drivers tap while the car is moving. */
export const touch = {
  /** Smallest tappable thing (accessibility minimum). */
  min: 44,
  /** Main pill button. */
  button: 60,
  /** Dark CTA with the yellow arrow; main button on the driver's ride screens. */
  buttonLarge: 62,
  /** Extra invisible tap area around small text links. */
  hitSlop: 8,
} as const;

/** See-through levels. */
export const opacity = {
  /** Something greyed out that still shows. */
  dim: 0.7,
  /** Disabled button. */
  disabled: 0.5,
  /** Disabled small link. */
  faint: 0.4,
} as const;

export function getTheme(app: AppName) {
  const brand = brands[app];
  const colors = {
    ...baseColors,
    brand: brand.brand,
    /** Background of a selected option (vehicle type, gender choice). */
    brandSoft: brand.brandSoft,
    /** Text on a brand-coloured button. */
    brandText: baseColors.onColor,
    appIconBackground: brand.appIconBackground,
  };
  return {
    colors,
    radius,
    elevation,
    shadowSpec,
    fontSize,
    fontWeight,
    fontFamily,
    letterSpacing,
    iconSize,
    iconStroke,
    size,
    motion,
    space,
    borderWidth,
    touch,
    opacity,
  };
}

export type Theme = ReturnType<typeof getTheme>;
export type ThemeColors = Theme['colors'];

/** `--kebab-case` CSS variable name for a colour role, e.g. `brandSoft` → `--brand-soft`. */
export function cssVariableName(role: string): string {
  return `--${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** CSS variable for a spacing step: `space[0.5]` → `--space-0-5`, `space[4]` → `--space-4`. */
export function spaceVariableName(stepKey: string | number): string {
  return `--space-${String(stepKey).replace('.', '-')}`;
}

/** The theme as a `:root { … }` CSS block, for the admin panel (and any future web page). */
export function themeCssVariables(app: AppName): string {
  const t = getTheme(app);
  const px = (prefix: string, values: Record<string, number>) =>
    Object.entries(values).map(([key, value]) => `${prefix}${cssVariableName(key).slice(2)}: ${value}px;`);
  const lines = [
    ...Object.entries(t.colors).map(([role, value]) => `${cssVariableName(role)}: ${value};`),
    ...px('--radius-', t.radius),
    ...px('--font-size-', t.fontSize),
    ...Object.entries(t.fontWeight).map(([key, value]) => `--font-weight${cssVariableName(key).slice(1)}: ${value};`),
    `--font-family: ${t.fontFamily.web};`,
    ...Object.entries(t.space).map(([key, value]) => `${spaceVariableName(key)}: ${value}px;`),
    ...px('--border-width-', t.borderWidth),
    ...Object.entries(t.opacity).map(([key, value]) => `--opacity${cssVariableName(key).slice(1)}: ${value};`),
  ];
  return `:root {\n  ${lines.join('\n  ')}\n}\n`;
}
