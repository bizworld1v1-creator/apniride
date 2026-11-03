import type { Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRupees } from '@/components/FareSheet';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { setCurrentRide } from '@/lib/ride';
import { colors } from '@/lib/theme';

const ICONS = { bike: '🏍️', car: '🚗' } as const;

/** Bottom sheet for a booked ride, from "finding a driver" to "pay cash". */
export function RideStatusSheet({ ride }: { ride: Ride }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = ride.driver?.firstName || t('ride.yourDriver');
  const fare = t('ride.fare', { amount: formatRupees(ride.fare) });

  const cancel = useMutation({
    mutationFn: () => api.rides.cancel(ride.id),
    onSuccess: (updated) => setCurrentRide(queryClient, updated),
  });
  const dismiss = () => setCurrentRide(queryClient, null);

  const confirmCancel = () =>
    Alert.alert(t('ride.cancelTitle'), t('ride.cancelBody'), [
      { text: t('ride.keepRide'), style: 'cancel' },
      { text: t('ride.cancelRide'), style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  const canCancel = ride.status === 'searching' || ride.status === 'accepted' || ride.status === 'arrived';
  const finished = ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'no_driver';

  let title: string;
  let body: string | null = null;
  switch (ride.status) {
    case 'searching':
      title = ride.cancelledBy === 'driver' ? t('ride.driverCancelledSearching') : t('ride.searching');
      break;
    case 'accepted':
      title = t('ride.onTheWay', { name });
      break;
    case 'arrived':
      title = t('ride.arrived', { name });
      body = t('ride.arrivedBody');
      break;
    case 'in_progress':
      title = t('ride.inProgress');
      body = t('ride.payAtEnd', { fare });
      break;
    case 'completed':
      title = t('ride.completed');
      body = t('ride.payNow', { fare, name });
      break;
    case 'cancelled':
      title = t('ride.cancelled');
      break;
    case 'no_driver':
      title = t('ride.noDriver');
      body = t('ride.noDriverBody');
      break;
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.titleRow}>
        {ride.status === 'searching' ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
        <Text style={styles.title} accessibilityLiveRegion="polite">
          {title}
        </Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      <View style={styles.summary}>
        <Text style={styles.icon}>{ICONS[ride.vehicleType]}</Text>
        <Text style={styles.summaryText}>{t(`ride.${ride.vehicleType}`)}</Text>
        <Text style={styles.fare}>{fare}</Text>
      </View>

      {cancel.isError ? <Text style={styles.error}>{errorMessage(t, cancel.error)}</Text> : null}

      {finished ? (
        <Pressable style={styles.primary} onPress={dismiss} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('ride.done')}</Text>
        </Pressable>
      ) : canCancel ? (
        <Pressable
          style={styles.secondary}
          onPress={confirmCancel}
          disabled={cancel.isPending}
          accessibilityRole="button"
        >
          {cancel.isPending ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.secondaryText}>{t('ride.cancelRide')}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginEnd: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, marginTop: 6 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginVertical: 14,
  },
  icon: { fontSize: 24, marginEnd: 10 },
  summaryText: { flex: 1, fontSize: 15, color: colors.text },
  fare: { fontSize: 17, fontWeight: '700', color: colors.text },
  error: { color: colors.error, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  primary: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: colors.brandText, fontSize: 17, fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.error, fontSize: 16, fontWeight: '600' },
});
