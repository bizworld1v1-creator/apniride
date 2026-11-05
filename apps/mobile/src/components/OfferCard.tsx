import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { patchCurrent, type ReceivedOffer } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { borderWidth, colors, elevation, fontSize, fontWeight, opacity, radius, space, touch } from '@/lib/theme';

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
      <Text style={styles.label}>{t('driver.offer.newRide', { seconds: secondsLeft })}</Text>
      <Text style={styles.fare}>{t('driver.offer.fare', { amount: formatRupees(offer.fare) })}</Text>
      <Text style={styles.cash}>{t('driver.offer.cash')}</Text>

      <View style={styles.rows}>
        <Text style={styles.row}>📍 {t('driver.offer.pickupAway', { km: offer.pickupDistanceKm })}</Text>
        <Text style={styles.row}>
          🏁 {t('driver.offer.trip', { km: offer.distanceKm, min: offer.durationMin })}
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
          <Text style={styles.declineText}>{t('driver.offer.decline')}</Text>
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
            <Text style={styles.acceptText}>{t('driver.offer.accept')}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space[4], elevation: elevation.high, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: 3, marginBottom: space[3], overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.brand },
  label: { fontSize: fontSize.md, color: colors.muted, fontWeight: fontWeight.semibold },
  fare: { fontSize: fontSize.amountLarge, fontWeight: fontWeight.extraBold, color: colors.text, marginTop: space[1] },
  cash: { fontSize: fontSize.sm, color: colors.muted },
  rows: { marginTop: space[3], gap: space[1] },
  row: { fontSize: fontSize.lg, color: colors.text },
  error: { color: colors.error, fontSize: fontSize.md, marginTop: space[2.5], textAlign: 'center' },
  buttons: { flexDirection: 'row', marginTop: space[4], gap: space[2.5] },
  button: { flex: 1, borderRadius: radius.lg, paddingVertical: space[4], alignItems: 'center', justifyContent: 'center', minHeight: touch.buttonLarge },
  decline: { borderWidth: borderWidth.thin, borderColor: colors.border },
  declineText: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text },
  accept: { backgroundColor: colors.success, flex: 2 },
  acceptText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onColor },
  dim: { opacity: opacity.dim },
});
