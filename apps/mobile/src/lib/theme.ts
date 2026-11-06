// Colours, text, spacing, corners and shadows come from the one shared theme: packages/shared/src/theme.ts.
import { getTheme } from '@apniride/shared';

export const theme = getTheme('mobile');
export const {
  colors,
  radius,
  elevation,
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
  shadowSpec,
} = theme;

/** Soft blue card shadow (iOS) + elevation (Android). Keep to cards and sheets: shadows are slow on low-end phones. */
export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: shadowSpec.card.opacity,
    shadowRadius: shadowSpec.card.blur,
    shadowOffset: { width: 0, height: shadowSpec.card.offsetY },
    elevation: elevation.medium,
  },
  sheet: {
    shadowColor: colors.ink,
    shadowOpacity: shadowSpec.sheet.opacity,
    shadowRadius: shadowSpec.sheet.blur,
    shadowOffset: { width: 0, height: shadowSpec.sheet.offsetY },
    elevation: elevation.high,
  },
} as const;

export { type as text } from './fonts';
