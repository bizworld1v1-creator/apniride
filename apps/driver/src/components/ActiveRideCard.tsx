import type { LatLng, Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRupees } from '@/components/OfferCard';
import { api } from '@/lib/api';
import { patchCurrent, useOwnEta } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { colors } from '@/lib/theme';

/** Opens Google Maps turn-by-turn navigation (free, already on every Android phone). */
function navigateTo(point: LatLng) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`;
  void Linking.openURL(url);
}

/** The ride the driver is doing: one big button for the next step. */
export function ActiveRideCard({ ride }: { ride: Ride }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: eta } = useOwnEta(ride.id);
  const passenger = ride.passenger.firstName || t('ride.passenger');
  const fare = t('offer.fare', { amount: formatRupees(ride.fare) });

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
    Alert.alert(t('ride.cancelTitle'), t('ride.cancelBody'), [
      { text: t('ride.keep'), style: 'cancel' },
      { text: t('ride.cancel'), style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  if (ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'no_driver') {
    const completed = ride.status === 'completed';
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{completed ? t('ride.completed') : t('ride.passengerCancelled')}</Text>
        {completed ? <Text style={styles.big}>{t('ride.collect', { fare })}</Text> : null}
        <Pressable style={styles.primary} onPress={done} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('ride.done')}</Text>
        </Pressable>
      </View>
    );
  }

  const title = {
    accepted: t('ride.goToPickup', { name: passenger }),
    arrived: t('ride.waiting', { name: passenger }),
    in_progress: t('ride.driving'),
  }[ride.status as 'accepted' | 'arrived' | 'in_progress'];
  const action = {
    accepted: t('ride.arrivedButton'),
    arrived: t('ride.startButton'),
    in_progress: t('ride.completeButton', { fare }),
  }[ride.status as 'accepted' | 'arrived' | 'in_progress'];
  const target = ride.status === 'in_progress' ? ride.dropoff : ride.pickup;
  const error = step.error ?? cancel.error;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>
        {fare} · {t('offer.trip', { km: ride.distanceKm, min: ride.durationMin })}
      </Text>
      {eta && ride.status !== 'arrived' ? (
        <Text style={styles.eta}>
          {t(ride.status === 'in_progress' ? 'ride.etaDropoff' : 'ride.etaPickup', { min: eta.etaMin, km: eta.distanceKm })}
        </Text>
      ) : null}

      <Pressable style={styles.navigate} onPress={() => navigateTo(target)} accessibilityRole="link">
        <Text style={styles.navigateText}>
          🧭 {ride.status === 'in_progress' ? t('ride.navigateDropoff') : t('ride.navigatePickup')}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{errorMessage(t, error)}</Text> : null}

      <Pressable
        style={[styles.primary, step.isPending && styles.dim]}
        onPress={() => step.mutate()}
        disabled={step.isPending || cancel.isPending}
        accessibilityRole="button"
      >
        {step.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{action}</Text>}
      </Pressable>

      {ride.status !== 'in_progress' ? (
        <Pressable onPress={confirmCancel} disabled={cancel.isPending} hitSlop={8} accessibilityRole="button">
          <Text style={styles.cancel}>{t('ride.cancel')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 8 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 4 },
  eta: { fontSize: 15, fontWeight: '600', color: colors.brand, marginTop: 4 },
  big: { fontSize: 30, fontWeight: '800', color: colors.text, marginVertical: 12 },
  navigate: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginVertical: 14 },
  navigateText: { fontSize: 16, fontWeight: '600', color: colors.text },
  error: { color: colors.error, fontSize: 14, marginBottom: 10, textAlign: 'center' },
  primary: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  primaryText: { color: colors.brandText, fontSize: 18, fontWeight: '700' },
  dim: { opacity: 0.7 },
  cancel: { color: colors.error, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingTop: 14 },
});
