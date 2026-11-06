import type { LatLng, Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/components/AuthLayout';
import { Button, Icon, Initials, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { patchCurrent, useOwnEta } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { useEnter } from '@/lib/motion';
import { borderWidth, colors, fontSize, iconSize, letterSpacing, radius, shadow, space, text, touch } from '@/lib/theme';

/** Opens Google Maps turn-by-turn navigation (free, already on every Android phone). */
function navigateTo(point: LatLng) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`;
  void Linking.openURL(url);
}

/** The ride the driver is doing: who, how far, Google Maps navigation and one big button for the next step. */
export function ActiveRideSheet({ ride }: { ride: Ride }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const enter = useEnter('sheet');
  const { data: eta } = useOwnEta(ride.id);
  const passenger = ride.passenger.firstName || t('driver.ride.passenger');
  const fare = t('ride.fare', { amount: formatRupees(ride.fare) });

  const step = useMutation({
    mutationFn: () => {
      if (ride.status === 'accepted') return api.driver.arrived(ride.id);
      if (ride.status === 'arrived') return api.driver.start(ride.id);
      return api.driver.complete(ride.id);
    },
    onSuccess: (updated) => patchCurrent(queryClient, { ride: updated }),
  });
  const cancel = useMutation({
    mutationFn: () => api.driver.cancel(ride.id),
    onSuccess: () => patchCurrent(queryClient, { ride: null }),
  });
  const done = () => patchCurrent(queryClient, { ride: null });

  const confirmCancel = () =>
    Alert.alert(t('driver.ride.cancelTitle'), t('driver.ride.cancelBody'), [
      { text: t('driver.ride.keep'), style: 'cancel' },
      { text: t('driver.ride.cancel'), style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  if (ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'no_driver') {
    const completed = ride.status === 'completed';
    return (
      <Animated.View style={[styles.sheet, shadow.sheet, enter]}>
        <Text style={text.h2} accessibilityLiveRegion="polite">
          {completed ? t('driver.ride.completed') : t('driver.ride.passengerCancelled')}
        </Text>
        {completed ? (
          <View style={styles.collect}>
            <Text style={[text.label, styles.collectLabel]}>{t('driver.ride.collectCash')}</Text>
            <Text style={styles.collectFare}>{fare}</Text>
          </View>
        ) : null}
        <Button variant="ink" label={t('driver.ride.done')} onPress={done} />
      </Animated.View>
    );
  }

  const status = ride.status as 'accepted' | 'arrived' | 'in_progress';
  const title = {
    accepted: t('driver.ride.goToPickup', { name: passenger }),
    arrived: t('driver.ride.waiting', { name: passenger }),
    in_progress: t('driver.ride.driving'),
  }[status];
  const action = {
    accepted: t('driver.ride.arrivedButton'),
    arrived: t('driver.ride.startButton'),
    in_progress: t('driver.ride.completeButton', { fare }),
  }[status];
  const target = status === 'in_progress' ? ride.dropoff : ride.pickup;
  const error = step.error ?? cancel.error;

  return (
    <Animated.View style={[styles.sheet, shadow.sheet, enter]}>
      <View style={styles.row}>
        <Initials name={passenger} tint="brand" />
        <View style={styles.flex}>
          <Text style={text.title} accessibilityLiveRegion="polite">
            {title}
          </Text>
          {eta && status !== 'arrived' ? (
            <Text style={styles.eta}>
              {t(status === 'in_progress' ? 'driver.ride.etaDropoff' : 'driver.ride.etaPickup', {
                min: eta.etaMin,
                km: eta.distanceKm,
              })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.fare}>{fare}</Text>
      </View>

      <Text style={text.caption}>
        {t('ride.cash')} · {t('driver.offer.trip', { km: ride.distanceKm, min: ride.durationMin })}
      </Text>

      <PressableScale style={styles.navigate} onPress={() => navigateTo(target)} accessibilityRole="link">
        <Icon name="pin" size={iconSize.sm} color={colors.brand} />
        <Text style={styles.navigateText}>
          {status === 'in_progress' ? t('driver.ride.navigateDropoff') : t('driver.ride.navigatePickup')}
        </Text>
        <Icon name="arrowRight" size={iconSize.sm} color={colors.brand} />
      </PressableScale>

      {error ? <Text style={styles.error}>{errorMessage(t, error)}</Text> : null}

      <Button
        variant={status === 'in_progress' ? 'ink' : 'primary'}
        label={action}
        onPress={() => step.mutate()}
        loading={step.isPending}
        disabled={cancel.isPending}
      />

      {status !== 'in_progress' ? (
        <TextLink label={t('driver.ride.cancel')} onPress={confirmCancel} disabled={cancel.isPending} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: space[5], gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  eta: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.brand, marginTop: space[0.5] },
  fare: { ...displayFont('extraBold', letterSpacing.heading), fontSize: fontSize.heading, color: colors.text },
  navigate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    minHeight: touch.button - space[1],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    paddingHorizontal: space[4.5],
  },
  navigateText: { ...bodyFont('bold'), flex: 1, fontSize: fontSize.base, color: colors.text },
  collect: { backgroundColor: colors.accent, borderRadius: radius.card - space[1.5], padding: space[4], gap: space[0.5] },
  collectLabel: { color: colors.onAccent },
  collectFare: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.price, color: colors.onAccent },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
});
