/**
 * ApniRide theme: the ONE place to change how every app looks.
 *
 * Used by the passenger app, the driver app (both via `src/lib/theme.ts`), the admin panel (as CSS variables,
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

/** Per-app brand colours. The passenger and driver apps are told apart by colour. */
export const brands = {
  passenger: { brand: palette.teal700, brandSoft: palette.cyan50, appIconBackground: palette.sky50 },
  driver: { brand: palette.amber700, brandSoft: palette.amber50, appIconBackground: palette.amber100 },
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
  return { colors, radius, elevation };
}

export type Theme = ReturnType<typeof getTheme>;
export type ThemeColors = Theme['colors'];

/** `--kebab-case` CSS variable name for a colour role, e.g. `brandSoft` → `--brand-soft`. */
export function cssVariableName(role: string): string {
  return `--${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** The theme as a `:root { … }` CSS block, for the admin panel (and any future web page). */
export function themeCssVariables(app: AppName): string {
  const { colors, radius: r } = getTheme(app);
  const lines = [
    ...Object.entries(colors).map(([role, value]) => `${cssVariableName(role)}: ${value};`),
    ...Object.entries(r).map(([size, value]) => `--radius-${size}: ${value}px;`),
  ];
  return `:root {\n  ${lines.join('\n  ')}\n}\n`;
}
