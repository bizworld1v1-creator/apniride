import type { Ride } from '@apniride/shared';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui';
import { useEnter } from '@/lib/motion';
import { colors, radius, shadow, space, text } from '@/lib/theme';

/** Sheet for a ride that ended without a trip: cancelled, or no driver was free. */
export function RideEndedSheet({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const { t } = useTranslation();
  const enter = useEnter('sheet');
  const noDriver = ride.status === 'no_driver';
  return (
    <Animated.View style={[styles.sheet, shadow.sheet, enter]}>
      <Text style={text.h2} accessibilityLiveRegion="polite">
        {t(noDriver ? 'ride.noDriver' : 'ride.cancelled')}
      </Text>
      {noDriver ? <Text style={[text.body, styles.muted]}>{t('ride.noDriverBody')}</Text> : null}
      <Button variant="ink" label={t('ride.done')} onPress={onDone} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: space[5], gap: space[3.5] },
  muted: { color: colors.textSecondary },
});
