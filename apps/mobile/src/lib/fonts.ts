import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { I18nManager, StyleSheet, type TextStyle } from 'react-native';
import { getTheme } from '@apniride/shared';

const { fontFamily, fontSize, fontWeight, letterSpacing, colors } = getTheme('mobile');

/** Font files, loaded once in `app/_layout.tsx` (only the weights we use, to keep the app small). */
export const fontAssets = {
  [fontFamily.display.bold]: BricolageGrotesque_700Bold,
  [fontFamily.display.extraBold]: BricolageGrotesque_800ExtraBold,
  [fontFamily.body.regular]: PlusJakartaSans_400Regular,
  [fontFamily.body.medium]: PlusJakartaSans_500Medium,
  [fontFamily.body.semibold]: PlusJakartaSans_600SemiBold,
  [fontFamily.body.bold]: PlusJakartaSans_700Bold,
};

/**
 * Urdu: the Google fonts have no Urdu letters and tight letter spacing breaks joined letters, so the app uses the
 * phone's own font instead. The layout is right-to-left exactly when the app runs in Urdu (it restarts on change).
 */
export const useSystemFont = I18nManager.isRTL;

type BodyWeight = keyof typeof fontFamily.body;
type DisplayWeight = keyof typeof fontFamily.display;

/** Font for body text (Plus Jakarta Sans) at a weight. Use instead of `fontWeight` in new styles. */
export function bodyFont(weight: BodyWeight = 'medium'): TextStyle {
  return useSystemFont ? { fontWeight: fontWeight[weight] } : { fontFamily: fontFamily.body[weight] };
}

/** Font for headlines, prices and numbers (Bricolage Grotesque), with optional tighter letter spacing. */
export function displayFont(weight: DisplayWeight = 'extraBold', spacing?: number): TextStyle {
  if (useSystemFont) return { fontWeight: fontWeight[weight] };
  return { fontFamily: fontFamily.display[weight], letterSpacing: spacing };
}

/** Ready-made text styles from the design's type scale (`tokens.json` → `type`). */
export const type = StyleSheet.create({
  wordmark: { ...displayFont('extraBold', letterSpacing.wordmark), fontSize: fontSize.wordmark, color: colors.text },
  priceHero: { ...displayFont('extraBold', letterSpacing.priceHero), fontSize: fontSize.priceHero, color: colors.text },
  price: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.price, color: colors.text },
  h1: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.stat, color: colors.text },
  h2: { ...displayFont('extraBold', letterSpacing.heading), fontSize: fontSize.heading, color: colors.text },
  title: { ...bodyFont('bold'), fontSize: fontSize.xl, color: colors.text },
  body: { ...bodyFont('medium'), fontSize: fontSize.base, color: colors.text },
  label: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.textSecondary },
  caption: { ...bodyFont('medium'), fontSize: fontSize.xs, color: colors.textSecondary },
});
