import { useTranslation } from 'react-i18next';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import { Icon, PressableScale } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, shadow, size, space } from '@/lib/theme';

/** SOS: free and works today: the phone dialer with 15 (police) or 1122 (rescue). Admin alerts come later. */
export function SosButton() {
  const { t } = useTranslation();
  const sos = () =>
    Alert.alert(t('ride.sosTitle'), t('ride.sosBody'), [
      { text: t('ride.police'), onPress: () => void Linking.openURL('tel:15') },
      { text: t('ride.rescue'), onPress: () => void Linking.openURL('tel:1122') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  return (
    <PressableScale style={styles.sos} onPress={sos} accessibilityLabel={`${t('ride.sos')}, ${t('ride.sosTitle')}`}>
      <Icon name="shield" size={iconSize.sm} color={colors.onColor} />
      <Text style={styles.sosText}>{t('ride.sos')}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: size.iconButton,
    borderRadius: radius.pill,
    // Darker red than the design's #FF5A5F, so the white "SOS" passes 4.5:1 contrast.
    backgroundColor: colors.error,
    paddingHorizontal: space[4.5],
    ...shadow.card,
  },
  sosText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onColor },
});
