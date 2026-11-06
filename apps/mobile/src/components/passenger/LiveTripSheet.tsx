import type { Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/components/AuthLayout';
import { ComingSoonBadge, IconButton, Initials } from '@/components/ui';
import { api } from '@/lib/api';
import { type ReceivedPosition, useAgeSeconds } from '@/lib/driver-position';
import { errorMessage } from '@/lib/errors';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { easing, useEnter, useLoop, useReduceMotion } from '@/lib/motion';
import { setCurrentRide } from '@/lib/ride';
import { borderWidth, colors, fontSize, letterSpacing, motion, opacity, radius, shadow, size, space, text, touch } from '@/lib/theme';

/** Progress through the trip: 1 = assigned, 2 = on the way / waiting at pickup, 3 = picked up, 4 = arrived. */
const STEP: Partial<Record<Ride['status'], number>> = { accepted: 2, arrived: 2, in_progress: 3, completed: 4 };

/**
 * Floating sheet during a ride (design: trip.html): ETA + live dot, 4-step progress, the driver, and the parts that
 * aren't built yet (chat, masked call, plate, ride PIN, share trip) greyed out with "Coming soon".
 */
export function LiveTripSheet({ ride, driverPosition }: { ride: Ride; driverPosition: ReceivedPosition | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const enter = useEnter('sheet');
  const name = ride.driver?.firstName || t('ride.yourDriver');
  const fare = t('ride.fare', { amount: formatRupees(ride.fare) });
  const age = useAgeSeconds(driverPosition);
  const eta = driverPosition?.etaMin;
  // No update for over a minute (driver in a dead zone): say so instead of showing a stale ETA as live.
  const stale = !!driverPosition && age > 60;
  const live = !!driverPosition && !stale;

  const cancel = useMutation({
    mutationFn: () => api.rides.cancel(ride.id),
    onSuccess: (updated) => setCurrentRide(queryClient, updated),
  });
  const confirmCancel = () =>
    Alert.alert(t('ride.cancelTitle'), t('ride.cancelBody'), [
      { text: t('ride.keepRide'), style: 'cancel' },
      { text: t('ride.cancelRide'), style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  let title: string;
  let body: string | null = null;
  if (ride.status === 'arrived') {
    title = t('ride.arrived', { name });
    body = t('ride.arrivedBody');
  } else if (ride.status === 'in_progress') {
    title = eta !== undefined ? t('ride.etaDropoff', { count: Math.max(1, eta) }) : t('ride.inProgress');
    body = t('ride.payAtEnd', { fare });
  } else {
    title = eta === undefined ? t('ride.onTheWay', { name }) : eta <= 1 ? t('ride.almostThere') : t('ride.etaPickup', { count: eta });
  }

  const soon = (label: string) => `${label}, ${t('common.comingSoon')}`;

  return (
    <Animated.View style={[styles.sheet, shadow.sheet, enter]}>
      <View style={styles.titleRow}>
        <Text style={[text.h2, styles.flex]} accessibilityLiveRegion="polite">
          {title}
        </Text>
        {live ? <LiveDot label={t('ride.live')} /> : null}
      </View>
      {body ? <Text style={[text.body, styles.muted]}>{body}</Text> : null}
      {stale ? <Text style={styles.stale}>{t('ride.lastUpdated', { count: Math.round(age / 60) })}</Text> : null}

      <Steps step={STEP[ride.status] ?? 1} />

      <View style={styles.driverRow}>
        <Initials name={name} tint="sun" />
        <View style={styles.flex}>
          <Text style={text.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={text.caption}>{t(`ride.${ride.vehicleType}`)}</Text>
        </View>
        <IconButton icon="chat" label={soon(t('ride.chat'))} onPress={() => undefined} disabled tone="outline" style={styles.dim} />
        <IconButton icon="phone" label={soon(t('ride.call'))} onPress={() => undefined} disabled tone="brand" style={styles.dim} />
      </View>

      <View style={styles.tiles}>
        <View style={[styles.tile, styles.dim]} accessible accessibilityLabel={soon(t('ride.plate'))}>
          <Text style={text.caption}>{t('ride.plate')}</Text>
          <ComingSoonBadge />
        </View>
        <View style={[styles.tile, styles.pinTile, styles.dim]} accessible accessibilityLabel={soon(t('ride.ridePin'))}>
          <Text style={[text.caption, styles.pinLabel]}>{t('ride.ridePin')}</Text>
          <Text style={styles.pinDigits}>• • • •</Text>
        </View>
      </View>

      <View style={styles.shareRow}>
        <Text style={styles.fareText}>
          {fare} · {t('ride.cash')}
        </Text>
        <View style={[styles.share, styles.dim]} accessible accessibilityLabel={soon(t('ride.shareTrip'))}>
          <Text style={styles.shareText}>{t('ride.shareTrip')}</Text>
        </View>
      </View>

      {cancel.isError ? <Text style={styles.error}>{errorMessage(t, cancel.error)}</Text> : null}
      {ride.status === 'accepted' || ride.status === 'arrived' ? (
        <TextLink label={t('ride.cancelRide')} onPress={confirmCancel} disabled={cancel.isPending} />
      ) : null}
    </Animated.View>
  );
}

function LiveDot({ label }: { label: string }) {
  const pulse = useLoop(900);
  return (
    <View style={styles.liveWrap} accessible accessibilityLabel={label}>
      <Animated.View
        style={[
          styles.liveHalo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          },
        ]}
      />
      <View style={styles.liveDot} />
    </View>
  );
}

/** Four-step progress bar that grows when the step changes. */
function Steps({ step }: { step: number }) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const fill = useRef(new Animated.Value(step / 4)).current;
  useEffect(() => {
    const anim = Animated.timing(fill, {
      toValue: step / 4,
      duration: reduce ? 0 : motion.duration.base,
      easing: easing.sheet,
      // Width can't run on the native driver; it's one bar, a few times per ride.
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [step, reduce, fill]);

  const labels = [t('ride.stepAssigned'), t('ride.stepOnTheWay'), t('ride.stepPickedUp'), t('ride.stepArrived')];
  return (
    <View accessible accessibilityLabel={labels.slice(0, step).join(', ')}>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <View style={styles.stepLabels}>
        {labels.map((label, i) => (
          <Text key={label} style={[styles.stepLabel, i < step && styles.stepLabelOn]} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const LIVE = space[3];

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: space[5], gap: space[3.5] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  muted: { color: colors.textSecondary, marginTop: -space[2] },
  stale: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.warningStrong },
  liveWrap: { width: LIVE * 2, height: LIVE * 2, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: LIVE, height: LIVE, borderRadius: LIVE / 2, backgroundColor: colors.online },
  liveDot: { width: LIVE, height: LIVE, borderRadius: LIVE / 2, backgroundColor: colors.online },
  track: { height: size.progressBar, borderRadius: size.progressBar / 2, backgroundColor: colors.borderLight, overflow: 'hidden' },
  bar: { height: size.progressBar, borderRadius: size.progressBar / 2, backgroundColor: colors.brand },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[1.5] },
  stepLabel: { ...bodyFont('bold'), fontSize: fontSize.xs, color: colors.textSecondary },
  stepLabelOn: { color: colors.brand },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dim: { opacity: opacity.dim },
  tiles: { flexDirection: 'row', gap: space[3] },
  tile: { flex: 1, borderRadius: radius.card - space[2], backgroundColor: colors.background, padding: space[3.5], gap: space[1] },
  pinTile: { backgroundColor: colors.ink },
  pinLabel: { color: colors.onBrandMuted },
  pinDigits: { ...displayFont('extraBold'), fontSize: fontSize.xxl, letterSpacing: letterSpacing.pin, color: colors.accent },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  fareText: { ...bodyFont('bold'), flex: 1, fontSize: fontSize.base, color: colors.text },
  share: {
    minHeight: touch.min,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    paddingHorizontal: space[4],
    justifyContent: 'center',
  },
  shareText: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.text },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
});
