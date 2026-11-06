import type { ComponentRef, ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { ModeSwitch } from '@/components/ModeSwitch';
import { CornerMask } from '@/components/passenger/CornerMask';
import { ComingSoonBadge, Icon, PressableScale } from '@/components/ui';
import { useEarnings } from '@/lib/account';
import { useAuth } from '@/lib/auth-store';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { useEnter, useLoop } from '@/lib/motion';
import { borderWidth, colors, fontSize, iconSize, letterSpacing, opacity, radius, size, space, text, touch } from '@/lib/theme';

const RING = 96;
const RING_STROKE = 10;
const POWER = 64;

interface Props {
  mapSlotRef: RefObject<ComponentRef<typeof View> | null>;
  onMapSlotLayout: () => void;
  onOpenMenu: () => void;
  approved: boolean;
  online: boolean;
  toggling: boolean;
  onToggle: () => void;
  toggleError: string | null;
  /** Registration card for drivers who aren't approved yet. */
  statusCard: ReactNode;
  /** Mode switching is refused while online. */
  busy: boolean;
}

/**
 * Driver home (design: driver.html): "Ready, {name}?", the earnings card, the dark online card with the power button,
 * and the map card (the one map, drawn by the parent under the slot) with the driver's own vehicle.
 */
export function DriverDashboard({
  mapSlotRef,
  onMapSlotLayout,
  onOpenMenu,
  approved,
  online,
  toggling,
  onToggle,
  toggleError,
  statusCard,
  busy,
}: Props) {
  const { t } = useTranslation();
  const firstName = useAuth((s) => s.user?.name?.trim().split(/\s+/)[0] ?? '');
  const header = useEnter('up', 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} pointerEvents="box-none">
      <Animated.View style={[styles.header, header]}>
        <Pressable onPress={onOpenMenu} accessibilityRole="button" accessibilityLabel={t('menu.open')} hitSlop={touch.hitSlop}>
          <Avatar size={size.ctaArrow} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={text.label}>{t('mode.driverBadge')}</Text>
          <Text style={styles.ready} numberOfLines={1}>
            {t('driver.ready', { name: firstName })}
          </Text>
        </View>
        <ModeSwitch blocked={busy} compact />
      </Animated.View>

      {approved ? (
        <>
          <EarningsCard />
          <OnlineCard online={online} toggling={toggling} onToggle={onToggle} />
          {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}
        </>
      ) : (
        statusCard
      )}

      {/* The map is drawn by the parent exactly under this box. */}
      <View ref={mapSlotRef} onLayout={onMapSlotLayout} style={styles.mapSlot} pointerEvents="none">
        <CornerMask radius={radius.hero} color={colors.background} />
      </View>
    </SafeAreaView>
  );
}

function EarningsCard() {
  const { t } = useTranslation();
  const { data, isPending } = useEarnings();
  const enter = useEnter('pop', 1);
  const rupees = (n: number) => t('ride.fare', { amount: formatRupees(n) });

  return (
    <Animated.View style={[styles.card, styles.earnings, enter]}>
      {/* Daily goal: not built yet (owner decision: show it as "Coming soon"). */}
      <View style={[styles.ring, styles.dim]} accessible accessibilityLabel={`${t('driver.dailyGoal')}, ${t('common.comingSoon')}`}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={(RING - RING_STROKE) / 2}
            stroke={colors.borderLight}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        </Svg>
        <Text style={styles.ringLabel}>{t('driver.dailyGoal')}</Text>
        <ComingSoonBadge />
      </View>
      <View style={styles.flex}>
        <Text style={text.caption}>{t('driver.earnedToday')}</Text>
        {isPending ? (
          <ActivityIndicator color={colors.brand} style={styles.left} />
        ) : (
          <Text style={styles.earned} adjustsFontSizeToFit numberOfLines={1}>
            {rupees(data?.today.cash ?? 0)}
          </Text>
        )}
        <View style={styles.chips}>
          <Text style={styles.chip}>{t('driver.trips', { count: data?.today.rides ?? 0 })}</Text>
          <View style={[styles.chipBox, styles.dim]} accessible accessibilityLabel={`${t('driver.rating')}, ${t('common.comingSoon')}`}>
            <Icon name="star" size={iconSize.sm - space[1]} color={colors.text} filled />
            <Text style={styles.chipText}>—</Text>
          </View>
        </View>
        {data ? <Text style={[text.caption, styles.week]}>{t('driver.week', { fare: rupees(data.last7Days.cash) })}</Text> : null}
      </View>
    </Animated.View>
  );
}

function OnlineCard({ online, toggling, onToggle }: { online: boolean; toggling: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const enter = useEnter('pop', 2);
  const wave = useLoop(2200, { pingPong: false, enabled: online });
  const ring = (shift: number) => {
    const p = Animated.modulo(Animated.add(wave, shift), 1);
    return {
      opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }],
    };
  };

  return (
    <Animated.View style={[styles.card, styles.online, enter]}>
      <PressableScale
        onPress={onToggle}
        disabled={toggling}
        accessibilityRole="switch"
        accessibilityState={{ checked: online, busy: toggling }}
        accessibilityLabel={online ? t('driver.goOffline') : t('driver.goOnline')}
        style={styles.power}
      >
        {online ? (
          <>
            <Animated.View style={[styles.wave, ring(0)]} />
            <Animated.View style={[styles.wave, ring(0.5)]} />
          </>
        ) : null}
        <View style={[styles.powerCore, { backgroundColor: online ? colors.online : colors.disabled }]}>
          {toggling ? <ActivityIndicator color={colors.ink} /> : <Icon name="power" color={colors.ink} strokeWidth={2.8} />}
        </View>
      </PressableScale>
      <View style={styles.flex}>
        <Text style={styles.onlineTitle} accessibilityLiveRegion="polite">
          {online ? t('driver.online') : t('driver.offline')}
        </Text>
        <Text style={styles.onlineHint}>{online ? t('driver.onlineHint') : t('driver.offlineHint')}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[3], gap: space[3.5] },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  ready: { ...displayFont('extraBold', letterSpacing.heading), fontSize: fontSize.heading, color: colors.text },
  card: { borderRadius: radius.hero, padding: space[5] },
  earnings: { backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space[4.5] },
  dim: { opacity: opacity.dim },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', gap: space[1] },
  ringLabel: { ...bodyFont('semibold'), fontSize: fontSize.xs, color: colors.textSecondary },
  left: { alignSelf: 'flex-start', marginVertical: space[2] },
  earned: { ...displayFont('extraBold', letterSpacing.tight), fontSize: fontSize.amount, color: colors.text },
  chips: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
  chip: {
    ...bodyFont('semibold'),
    fontSize: fontSize.xs,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: space[2.5],
    paddingVertical: space[1.5],
    overflow: 'hidden',
  },
  chipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: space[2.5],
  },
  chipText: { ...bodyFont('semibold'), fontSize: fontSize.xs, color: colors.text },
  week: { marginTop: space[2] },
  online: { backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[4.5] },
  power: { width: POWER, height: POWER, alignItems: 'center', justifyContent: 'center' },
  wave: {
    position: 'absolute',
    width: POWER,
    height: POWER,
    borderRadius: POWER / 2,
    borderWidth: borderWidth.thick,
    borderColor: colors.online,
  },
  powerCore: {
    width: POWER - space[3],
    height: POWER - space[3],
    borderRadius: POWER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineTitle: { ...bodyFont('bold'), fontSize: fontSize.xl, color: colors.onColor },
  onlineHint: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.onBrandMuted, marginTop: space[0.5] },
  error: {
    ...bodyFont('medium'),
    backgroundColor: colors.errorSoft,
    color: colors.error,
    fontSize: fontSize.md,
    padding: space[2.5],
    borderRadius: radius.lg,
    textAlign: 'center',
    overflow: 'hidden',
  },
  mapSlot: { flex: 1, minHeight: size.mapCardMin, borderRadius: radius.hero },
});
