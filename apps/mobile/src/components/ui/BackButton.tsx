import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { shadow } from '@/lib/theme';
import { IconButton } from './IconButton';

/**
 * The one back button of the app: a round white button with a chevron (design: 46 px icon button). Use `overMap`
 * on a map so it lifts off with a soft shadow, and `onBlue` on a blue header.
 */
export function BackButton({
  onPress,
  overMap,
  onBlue,
  style,
}: {
  onPress?: () => void;
  overMap?: boolean;
  onBlue?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  return (
    <IconButton
      icon="chevronLeft"
      label={t('common.back')}
      tone={onBlue ? 'onBrand' : 'light'}
      onPress={onPress ?? (() => router.back())}
      style={[overMap && shadow.card, style]}
    />
  );
}
