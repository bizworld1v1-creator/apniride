import { counterOffers } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton, PressableScale, RouteConnector } from '@/components/ui';
import { api } from '@/lib/api';
import { patchCurrent, type ReceivedOffer, setOffer } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { useEnter, useReduceMotion } from '@/lib/motion';
import { borderWidth, colors, fontSize, letterSpacing, opacity, radius, shadow, size, space, text, touch } from '@/lib/theme';

/**
 * Incoming ride request (design: driver.html, like inDrive). The driver accepts the passenger's price or taps a
 * counter-offer (+10 / 20 / 30 %, `counterOffers` in packages/shared); either sends a bid. Then the passenger chooses
 * among the drivers who answered: the sheet waits, and either the ride starts (ride update) or the request closes.
 */
export function RequestSheet({ offer }: { offer: ReceivedOffer }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const secondsLeft = useSecondsLeft(offer);
  const enter = useEnter('sheet');
  const rupees = (n: number) => t('ride.fare', { amount: formatRupees(n) });
  const [sending, setSending] = useState<number | null>(null);

  const bid = useMutation({
    mutationFn: (fare: number) => api.driver.bid(offer.rideId, { fare }),
    onMutate: (fare) => setSending(fare),
    // The same request, now with our bid: the sheet switches to "waiting for the passenger".
    onSuccess: (updated) => setOffer(queryClient, updated),
    onError: () => setTimeout(() => patchCurrent(queryClient, { offer: null }), 2500),
    onSettled: () => setSending(null),
  });
  const decline = useMutation({
    mutationFn: () => api.driver.decline(offer.rideId),
    onSettled: () => patchCurrent(queryClient, { offer: null }),
  });

  // Time's up on this phone: hide it (the server closes it by itself).
  useEffect(() => {
    if (secondsLeft <= 0 && !bid.isPending) patchCurrent(queryClient, { offer: null });
  }, [secondsLeft, bid.isPending, queryClient]);

  const busy = bid.isPending || decline.isPending;
  const waiting = !!offer.bid;
  const fare = rupees(offer.fare);

  return (
    <Animated.View style={[styles.sheet, shadow.sheet, enter]} accessibilityLiveRegion="polite">
      {/* A new bar when the bid is sent: it then counts down the passenger's time to choose. */}
      <CountdownBar key={waiting ? 'bid' : 'request'} offer={offer} />

      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.badge}>{t('driver.newRequest', { km: offer.pickupDistanceKm })}</Text>
          {offer.passengerFirstName ? (
            <Text style={[text.title, styles.name]} numberOfLines={1}>
              {offer.passengerFirstName}
            </Text>
          ) : null}
          <Text style={text.caption}>{t('driver.offer.cash')}</Text>
        </View>
        <View style={styles.price}>
          <Text style={text.caption}>{t('driver.riderOffers')}</Text>
          <Text style={styles.fare} adjustsFontSizeToFit numberOfLines={1}>
            {fare}
          </Text>
          <Text style={styles.seconds}>{secondsLeft}s</Text>
        </View>
      </View>

      <View style={styles.route}>
        <RouteConnector />
        <View style={styles.routeText}>
          <Text style={styles.routeLine}>{t('driver.pickupPoint', { km: offer.pickupDistanceKm })}</Text>
          <Text style={styles.routeLine}>{t('driver.tripLength', { km: offer.distanceKm, min: offer.durationMin })}</Text>
        </View>
      </View>

      {waiting ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.brand} />
          <View style={styles.flex}>
            <Text style={text.title}>{t('driver.youOffered', { fare: rupees(offer.bid!.fare) })}</Text>
            <Text style={text.caption}>
              {offer.passengerFirstName
                ? t('driver.waitingChoice', { name: offer.passengerFirstName })
                : t('driver.waitingChoiceNoName')}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.counterBlock}>
            <View style={styles.counterHead}>
              <Text style={text.label}>{t('driver.counterOffer')}</Text>
              <Text style={text.caption}>{t('driver.counterHint')}</Text>
            </View>
            <View style={styles.counters}>
              {counterOffers(offer.fare).map((amount) => (
                <PressableScale
                  key={amount}
                  style={[styles.counter, busy && styles.dim]}
                  onPress={() => bid.mutate(amount)}
                  disabled={busy}
                  accessibilityLabel={`${t('driver.counterOffer')}: ${rupees(amount)}`}
                >
                  {sending === amount ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <Text style={styles.counterText}>{rupees(amount)}</Text>
                  )}
                </PressableScale>
              ))}
            </View>
          </View>

          {bid.isError ? <Text style={styles.error}>{errorMessage(t, bid.error)}</Text> : null}

          <View style={styles.actions}>
            <IconButton
              icon="x"
              label={t('driver.offer.decline')}
              tone="outline"
              onPress={() => decline.mutate()}
              disabled={busy}
              diameter={touch.buttonLarge}
            />
            <Button
              variant="primary"
              label={t('driver.acceptFor', { fare })}
              onPress={() => bid.mutate(offer.fare)}
              loading={sending === offer.fare}
              disabled={busy}
              style={styles.flex}
            />
          </View>
        </>
      )}
    </Animated.View>
  );
}

/** Yellow bar that empties smoothly until `expiresInSeconds` runs out (one native animation, no re-renders). */
function CountdownBar({ offer }: { offer: ReceivedOffer }) {
  const reduce = useReduceMotion();
  const total = offer.expiresInSeconds * 1000;
  const left = Math.max(0, offer.receivedAt + total - Date.now());
  const progress = useRef(new Animated.Value(total > 0 ? left / total : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: true });
    if (!reduce) anim.start();
    return () => anim.stop();
    // Runs once per request / bid (the parent changes the key).
  }, []);

  return (
    <View style={styles.track}>
      {/* Shrinks towards the left edge (transformOrigin), on the native driver. */}
      <Animated.View style={[styles.bar, { transform: [{ scaleX: progress }] }]} />
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
  flex: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.stack,
    borderWidth: borderWidth.thick,
    borderColor: colors.brand,
    padding: space[5],
    gap: space[3],
  },
  track: { height: size.progressBar, borderRadius: size.progressBar / 2, backgroundColor: colors.borderLight, overflow: 'hidden' },
  bar: { height: '100%', width: '100%', backgroundColor: colors.accent, transformOrigin: 'left' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  badge: {
    ...bodyFont('bold'),
    alignSelf: 'flex-start',
    fontSize: fontSize.xs,
    color: colors.brand,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space[2.5],
    paddingVertical: space[1],
    overflow: 'hidden',
  },
  name: { marginTop: space[2] },
  price: { alignItems: 'flex-end', maxWidth: '55%' },
  fare: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.stat, color: colors.brand },
  seconds: { ...bodyFont('bold'), fontSize: fontSize.sm, color: colors.textSecondary },
  route: { flexDirection: 'row', gap: space[3], backgroundColor: colors.background, borderRadius: radius.card - space[1.5], padding: space[3.5] },
  routeText: { flex: 1, justifyContent: 'space-between', gap: space[3] },
  routeLine: { ...bodyFont('semibold'), fontSize: fontSize.md, color: colors.text },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.brandSoft,
    borderRadius: radius.card - space[1.5],
    padding: space[4],
  },
  counterBlock: { gap: space[1.5] },
  counterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counters: { flexDirection: 'row', gap: space[2] },
  counter: {
    flex: 1,
    minHeight: touch.min,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.text },
  dim: { opacity: opacity.dim },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
});
