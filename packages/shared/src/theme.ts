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

/** Raw colours. Components don't use these directly; they use the named roles below. */
export const palette = {
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',

  teal700: '#0E7490',
  cyan50: '#ECFEFF',
  sky50: '#E6F4FE',

  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber500: '#F59E0B',
  amber700: '#B45309',
  amber800: '#92400E',

  green100: '#DCFCE7',
  green600: '#16A34A',
  green800: '#166534',

  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red600: '#DC2626',
  red800: '#991B1B',

  blue50: '#EFF6FF',
} as const;

/** Colour roles shared by every app. */
const baseColors = {
  /** Screen background behind cards. */
  background: palette.gray50,
  /** Cards, sheets, inputs. */
  surface: palette.white,
  /** Subtle fill: progress-bar track, empty photo boxes. */
  surfaceMuted: palette.gray100,

  text: palette.gray900,
  /** Secondary text that still needs to be easy to read (taglines). */
  textSecondary: palette.gray700,
  /** Small helper text (server status). */
  textTertiary: palette.gray600,
  /** Hints, labels, placeholders. */
  muted: palette.gray500,

  border: palette.gray300,
  borderLight: palette.gray200,

  /** Text / spinners on a coloured button (brand, success, danger). */
  onColor: palette.white,

  success: palette.green600,
  successSoft: palette.green100,
  successText: palette.green800,

  error: palette.red600,
  errorSoft: palette.red50,
  errorSoftStrong: palette.red100,
  errorText: palette.red800,

  warning: palette.amber500,
  warningSoft: palette.amber100,
  warningText: palette.amber800,
  /** Warning text on white, e.g. "location last updated 2 min ago". */
  warningStrong: palette.amber700,

  infoSoft: palette.blue50,
  /** "Checking…" grey dot. */
  neutral: palette.gray400,

  /** Development-only banners (OTP code shown on screen). */
  devBg: palette.amber100,
  devText: palette.amber800,

  /** Map pins. Android only knows a few pin hues, so keep these as simple colour names or hex. */
  pickupPin: 'green',
  dropoffPin: 'red',

  /** Expo splash screen background. */
  splash: palette.white,
};

/** Per-app brand colours. The mobile app has one brand for both modes; driver mode shows a "Driver mode" label. */
export const brands = {
  mobile: { brand: palette.teal700, brandSoft: palette.cyan50, appIconBackground: palette.sky50 },
  admin: { brand: palette.amber700, brandSoft: palette.amber50, appIconBackground: palette.amber100 },
} as const;

export type AppName = keyof typeof brands;

/** Corner sizes. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 20,
} as const;

/** Android shadow depth (low-end phones: keep these small). */
export const elevation = {
  low: 3,
  medium: 6,
  high: 8,
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
 * Font families. The apps use the phone's system font (fast, has Urdu glyphs, no download). To use a custom font,
 * load it with expo-font and set `app` here, then use `fontFamily.app` in the shared text styles.
 */
export const fontFamily = {
  app: undefined as string | undefined,
  web: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Extra letter spacing (px). */
export const letterSpacing = {
  /** Spread-out digits of the OTP code input. */
  code: 12,
} as const;

/** Emoji / icon sizes (px). */
export const iconSize = {
  md: 24,
  lg: 28,
  xl: 36,
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
  7: step(7),
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
  /** Smallest row of tappable buttons. */
  min: 40,
  /** Main button on the sign-in screens. */
  button: 54,
  /** Main button on the driver's ride screens. */
  buttonLarge: 56,
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
    fontSize,
    fontWeight,
    fontFamily,
    letterSpacing,
    iconSize,
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
