import type { Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Button, CountdownRing, IconButton, Initials } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { easing, useReduceMotion } from '@/lib/motion';
import { type ReceivedBid, secondsLeftOf, setCurrentRide } from '@/lib/ride';
import { colors, fontSize, letterSpacing, motion, radius, shadow, size, space, text, touch } from '@/lib/theme';

/** The two tinted cards that peek out behind the active one. */
const PEEK = space[3];

/**
 * Drivers' offers as a stacked card deck (design: offers.html, like inDrive). The active card deals in from below;
 * skip (✕) or a lapsed timer brings the next one. "Ride with {name}" chooses that driver at their price.
 * Shows `fallback` (the radar) while no offer is live.
 */
export function OffersDeck({ ride, bids, fallback }: { ride: Ride; bids: ReceivedBid[]; fallback: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  // One tick per second for the countdown rings (only this deck re-renders).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = bids.filter((b) => secondsLeftOf(b, now) > 0);
  // Skipped cards go to the back of the queue instead of disappearing, so a passenger can still come back to them.
  const ordered = [...live.filter((b) => !skipped.has(b.bidId)), ...live.filter((b) => skipped.has(b.bidId))];
  const active = ordered[0];

  const choose = useMutation({
    mutationFn: (bidId: string) => api.rides.choose(ride.id, { bidId }),
    onSuccess: (updated) => setCurrentRide(queryClient, updated),
    // The bid lapsed or the driver left: show the fresh list.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['ride', ride.id, 'bids'] }),
  });

  if (!active) return <>{fallback}</>;

  const skip = () =>
    setSkipped((s) => {
      const next = new Set(s);
      next.add(active.bidId);
      // Everything skipped: start the round again.
      return live.every((b) => next.has(b.bidId)) ? new Set() : next;
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={text.h1} accessibilityLiveRegion="polite">
          {t('ride.offersIn', { count: ordered.length })}
        </Text>
        <Text style={[text.caption, styles.more]}>{t('ride.moreComing')}</Text>
      </View>
      <View style={styles.deck}>
        {ordered.length > 2 ? <View style={[styles.peek, styles.peekBack]} /> : null}
        {ordered.length > 1 ? <View style={[styles.peek, styles.peekMiddle]} /> : null}
        <DealtCard key={active.bidId}>
          <BidCard
            bid={active}
            secondsLeft={secondsLeftOf(active, now)}
            busy={choose.isPending}
            onSkip={ordered.length > 1 ? skip : undefined}
            onChoose={() => choose.mutate(active.bidId)}
            error={choose.isError ? errorMessage(t, choose.error) : null}
          />
        </DealtCard>
      </View>

      <View style={styles.dots} accessible accessibilityLabel={t('ride.offerOf', { index: 1, count: ordered.length })}>
        {ordered.map((b, i) => (
          <View key={b.bidId} style={[styles.dot, i === 0 && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/** Slides up from below with a slight turn and a spring (design: "deals in"). Plain fade with reduce motion. */
function DealtCard({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(p, {
      toValue: 1,
      duration: reduce ? motion.duration.fast : motion.duration.enter,
      easing: reduce ? easing.standard : easing.spring,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [p, reduce]);
  const style = reduce
    ? { opacity: p }
    : {
        opacity: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) },
          { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '0deg'] }) },
        ],
      };
  return <Animated.View style={style}>{children}</Animated.View>;
}

function BidCard({
  bid,
  secondsLeft,
  busy,
  onSkip,
  onChoose,
  error,
}: {
  bid: ReceivedBid;
  secondsLeft: number;
  busy: boolean;
  onSkip?: () => void;
  onChoose: () => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const name = bid.driver.firstName || t('ride.yourDriver');
  const counter = bid.kind === 'counter';

  return (
    <View style={[styles.card, shadow.card]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Initials name={name} tint="mint" size={size.avatarLarge} />
        <View style={styles.flex}>
          <Text style={text.h2} numberOfLines={1}>
            {name}
          </Text>
          <Text style={text.caption}>{t('driver.pickupPoint', { km: bid.pickupDistanceKm })}</Text>
        </View>
        <CountdownRing secondsLeft={secondsLeft} total={bid.expiresInSeconds} />
      </View>

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={text.caption}>{t('ride.vehicleLabel')}</Text>
          <Text style={styles.tileValue} numberOfLines={1}>
            {bid.driver.vehicle ?? '—'}
          </Text>
        </View>
        <View style={styles.tile}>
          <Text style={text.caption}>{t('ride.arrivesIn')}</Text>
          <Text style={styles.tileValue}>{t('ride.minShort', { count: Math.max(1, bid.etaMin) })}</Text>
        </View>
      </View>

      <View style={styles.strip}>
        <Text style={styles.stripLabel}>{counter ? t('ride.counterOffer') : t('ride.acceptedYourPrice')}</Text>
        <Text style={styles.stripPrice} adjustsFontSizeToFit numberOfLines={1}>
          {t('ride.fare', { amount: formatRupees(bid.fare) })}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {onSkip ? (
          <IconButton icon="x" label={t('ride.skipOffer')} tone="outline" onPress={onSkip} disabled={busy} diameter={touch.buttonLarge} />
        ) : null}
        <Button
          variant="primary"
          label={t('ride.rideWith', { name })}
          onPress={onChoose}
          loading={busy}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space[4], alignSelf: 'stretch' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] },
  more: { color: colors.textSecondary },
  deck: { paddingTop: PEEK * 2 },
  peek: { position: 'absolute', height: space[20], borderRadius: radius.stack },
  peekBack: { top: 0, left: space[8], right: space[8], backgroundColor: colors.brandTint2 },
  peekMiddle: { top: PEEK, left: space[4], right: space[4], backgroundColor: colors.brandTint3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.stack, padding: space[5], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3.5] },
  tiles: { flexDirection: 'row', gap: space[2.5] },
  tile: { flex: 1, backgroundColor: colors.background, borderRadius: radius.card - space[2], padding: space[3.5], gap: space[0.5] },
  tileValue: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.text },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    backgroundColor: colors.accent,
    borderRadius: radius.card - space[1],
    paddingHorizontal: space[4.5],
    paddingVertical: space[4],
  },
  stripLabel: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onAccent, flexShrink: 1 },
  stripPrice: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.amountLarge, color: colors.onAccent },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[1.5] },
  dot: { width: size.pagerDot, height: size.pagerDot, borderRadius: size.pagerDot / 2, backgroundColor: colors.disabled },
  dotActive: { width: size.pagerDotActive, backgroundColor: colors.brand },
});
