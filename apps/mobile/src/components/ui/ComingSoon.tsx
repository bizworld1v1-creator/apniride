import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, radius, space } from '@/lib/theme';

/** Small "Coming soon" tag for features the design shows but the app doesn't have yet (owner decision 2026-11-07). */
export function ComingSoonBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{t('common.comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: space[2.5],
    paddingVertical: space[0.5],
  },
  text: { ...bodyFont('bold'), fontSize: fontSize.xs, color: colors.textSecondary },
});
