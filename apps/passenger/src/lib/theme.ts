// Colours, text, spacing, corners and shadows come from the one shared theme: packages/shared/src/theme.ts.
import { getTheme } from '@apniride/shared';

export const theme = getTheme('passenger');
export const {
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
} = theme;
