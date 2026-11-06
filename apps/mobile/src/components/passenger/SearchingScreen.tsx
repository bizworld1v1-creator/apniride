import type { Ride } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextLink } from '@/components/AuthLayout';
import { Icon } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { useEnter, useLoop } from '@/lib/motion';
import { setCurrentRide } from '@/lib/ride';
import { colors, fontSize, iconSize, radius, size, space, text } from '@/lib/theme';
import { RouteCard } from './RouteCard';

const RADAR = 120;

/**
 * "Finding your driver" (design: offers.html header). With fixed fares the request goes to one driver at a time, so
 * there is no offer deck yet: that comes with fare bidding.
 */
export function SearchingScreen({ ride, fromLabel, toLabel }: { ride: Ride; fromLabel: string; toLabel: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const title = useEnter('up', 1);

  const cancel = useMutation({
    mutationFn: () => api.rides.cancel(ride.id),
    onSuccess: (updated) => setCurrentRide(queryClient, updated),
  });
  const confirmCancel = () =>
    Alert.alert(t('ride.cancelTitle'), t('ride.cancelBody'), [
      { text: t('ride.keepRide'), style: 'cancel' },
      { text: t('ride.cancelRequest'), style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.farePill}>
          <Text style={styles.fareLabel}>{t('ride.yourFare')}</Text>
          <Text style={styles.fareValue}>{t('ride.fare', { amount: formatRupees(ride.fare) })}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Radar vehicle={ride.vehicleType} />
        <Animated.View style={[styles.words, title]}>
          <Text style={[text.h1, styles.centerText]} accessibilityLiveRegion="polite">
            {ride.cancelledBy === 'driver' ? t('ride.driverCancelledSearching') : t('ride.searching')}
          </Text>
          <View style={styles.hintRow}>
            <Text style={[text.body, styles.muted]}>{t('ride.findingHint')}</Text>
          </View>
          <HoppingDots />
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <RouteCard from={fromLabel} to={toLabel} km={ride.distanceKm} minutes={ride.durationMin} index={2} />
        {cancel.isError ? <Text style={styles.error}>{errorMessage(t, cancel.error)}</Text> : null}
        <TextLink label={t('ride.cancelRequest')} onPress={confirmCancel} disabled={cancel.isPending} />
      </View>
    </SafeAreaView>
  );
}

/** Yellow circle with the vehicle and two pulsing rings. */
function Radar({ vehicle }: { vehicle: Ride['vehicleType'] }) {
  const pulse = useLoop(1400, { pingPong: false });
  const ring = (delay: number) => {
    const p = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
    };
  };
  return (
    <View style={styles.radar} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ring, ring(0)]} />
      <Animated.View style={[styles.ring, ring(0.5)]} />
      <View style={styles.core}>
        <Icon name={vehicle === 'bike' ? 'bike' : 'car'} size={iconSize.xl} color={colors.onAccent} />
      </View>
    </View>
  );
}

/** Three dots hopping one after another ("more coming"). */
function HoppingDots() {
  const hop = useLoop(900, { pingPong: false });
  const dot = (i: number, color: string) => {
    const p = Animated.modulo(Animated.add(hop, 1 - i / 3), 1);
    return (
      <Animated.View
        key={i}
        style={[
          styles.dot,
          { backgroundColor: color },
          { transform: [{ translateY: p.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: [0, -6, 0, 0] }) }] },
        ]}
      />
    );
  };
  return (
    <View style={styles.dots} accessible={false}>
      {dot(0, colors.brand)}
      {dot(1, colors.accent)}
      {dot(2, colors.online)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space[5], paddingVertical: space[2] },
  farePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space[4],
    paddingVertical: space[2.5],
  },
  fareLabel: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.text },
  fareValue: { ...displayFont('extraBold'), fontSize: fontSize.xxl, color: colors.brand },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[6], gap: space[6] },
  words: { alignItems: 'center', gap: space[2] },
  centerText: { textAlign: 'center' },
  hintRow: { alignItems: 'center' },
  muted: { color: colors.textSecondary, textAlign: 'center' },
  radar: { width: RADAR, height: RADAR, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: RADAR, height: RADAR, borderRadius: RADAR / 2, backgroundColor: colors.accent },
  core: {
    width: size.avatarLarge,
    height: size.avatarLarge,
    borderRadius: size.avatarLarge / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: space[1.5], marginTop: space[2] },
  dot: { width: size.pagerDot, height: size.pagerDot, borderRadius: size.pagerDot / 2 },
  bottom: { paddingHorizontal: space[5], paddingBottom: space[2], gap: space[2] },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
});
