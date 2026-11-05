import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { patchCurrent, type ReceivedOffer } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { colors, elevation, radius } from '@/lib/theme';

export const formatRupees = (n: number) => n.toLocaleString('en-PK');

/** New ride request: big fare, distances, Accept / Decline with a countdown. */
export function OfferCard({ offer }: { offer: ReceivedOffer }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const secondsLeft = useSecondsLeft(offer);

  const accept = useMutation({
    mutationFn: () => api.driver.accept(offer.rideId),
    onSuccess: (ride) => patchCurrent(queryClient, { offer: null, ride }),
    onError: () => setTimeout(() => patchCurrent(queryClient, { offer: null }), 2500),
  });
  const decline = useMutation({
    mutationFn: () => api.driver.decline(offer.rideId),
    onSettled: () => patchCurrent(queryClient, { offer: null }),
  });

  // Time's up on this phone: hide it (the server moves on to the next driver by itself).
  useEffect(() => {
    if (secondsLeft <= 0 && !accept.isPending && !accept.isSuccess) patchCurrent(queryClient, { offer: null });
  }, [secondsLeft, accept.isPending, accept.isSuccess, queryClient]);

  const busy = accept.isPending || decline.isPending;
  const progress = Math.max(0, Math.min(1, secondsLeft / Math.max(1, offer.expiresInSeconds)));

  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.label}>{t('offer.newRide', { seconds: secondsLeft })}</Text>
      <Text style={styles.fare}>{t('offer.fare', { amount: formatRupees(offer.fare) })}</Text>
      <Text style={styles.cash}>{t('offer.cash')}</Text>

      <View style={styles.rows}>
        <Text style={styles.row}>📍 {t('offer.pickupAway', { km: offer.pickupDistanceKm })}</Text>
        <Text style={styles.row}>
          🏁 {t('offer.trip', { km: offer.distanceKm, min: offer.durationMin })}
        </Text>
        {offer.passengerFirstName ? (
          <Text style={styles.row}>👤 {offer.passengerFirstName}</Text>
        ) : null}
      </View>

      {accept.isError ? <Text style={styles.error}>{errorMessage(t, accept.error)}</Text> : null}

      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.decline]}
          onPress={() => decline.mutate()}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.declineText}>{t('offer.decline')}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.accept, busy && styles.dim]}
          onPress={() => accept.mutate()}
          disabled={busy}
          accessibilityRole="button"
        >
          {accept.isPending ? (
            <ActivityIndicator color={colors.onColor} />
          ) : (
            <Text style={styles.acceptText}>{t('offer.accept')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function useSecondsLeft(offer: ReceivedOffer) {
  const deadline = offer.receivedAt + offer.expiresInSeconds * 1000;
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [left]);
  return left;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, elevation: elevation.high, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.brand },
  label: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  fare: { fontSize: 36, fontWeight: '800', color: colors.text, marginTop: 4 },
  cash: { fontSize: 13, color: colors.muted },
  rows: { marginTop: 12, gap: 4 },
  row: { fontSize: 16, color: colors.text },
  error: { color: colors.error, fontSize: 14, marginTop: 10, textAlign: 'center' },
  buttons: { flexDirection: 'row', marginTop: 16, gap: 10 },
  button: { flex: 1, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  decline: { borderWidth: 1, borderColor: colors.border },
  declineText: { fontSize: 17, fontWeight: '600', color: colors.text },
  accept: { backgroundColor: colors.success, flex: 2 },
  acceptText: { fontSize: 18, fontWeight: '700', color: colors.onColor },
  dim: { opacity: 0.7 },
});
