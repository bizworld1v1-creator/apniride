import type { SavedPlace, VehicleType } from '@apniride/shared';
import { router } from 'expo-router';
import { type ComponentRef, type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { BottomNav, ComingSoonBadge, Icon, type IconName, IconButton, PressableScale } from '@/components/ui';
import { useAuth } from '@/lib/auth-store';
import { bodyFont, displayFont } from '@/lib/fonts';
import { useEnter, useReduceMotion } from '@/lib/motion';
import {
  borderWidth,
  colors,
  fontSize,
  iconSize,
  letterSpacing,
  opacity,
  radius,
  shadow,
  size,
  space,
  text,
  touch,
} from '@/lib/theme';
import { CornerMask } from './CornerMask';
import { CenterPin } from './MapPin';

/** Below this window height the dashboard tightens up so everything fits without scrolling. */
const COMPACT_HEIGHT = 720;

interface Props {
  /** Transparent hole where the parent draws the (one) map, so the map isn't loaded twice. */
  mapSlotRef: RefObject<ComponentRef<typeof View> | null>;
  onMapSlotLayout: () => void;
  places: SavedPlace[] | undefined;
  onSearch: (vehicle?: VehicleType) => void;
  onPlace: (place: SavedPlace) => void;
  onOpenMenu: () => void;
}

function greetingKey(hour: number) {
  if (hour < 12) return 'home.morning';
  if (hour < 17) return 'home.afternoon';
  return 'home.evening';
}

const PLACE_ORDER: Record<SavedPlace['kind'], number> = { home: 0, work: 1, other: 2 };
const PLACE_ICON: Record<SavedPlace['kind'], IconName> = { home: 'home', work: 'building', other: 'pin' };

/**
 * Passenger home (design: home.html): greeting, map card with the search pill, service tiles, saved places and the
 * bottom nav. No scrolling: on short phones the map card shrinks and fewer places show.
 */
export function HomeDashboard({ mapSlotRef, onMapSlotLayout, places, onSearch, onPlace, onOpenMenu }: Props) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;
  const header = useEnter('up', 0);
  const tiles = useEnter('up', 2);
  const placesIn = useEnter('up', 4);
  const nav = useEnter('up', 5);

  const shown = [...(places ?? [])].sort((a, b) => PLACE_ORDER[a.kind] - PLACE_ORDER[b.kind]).slice(0, compact ? 1 : 2);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} pointerEvents="box-none">
      <Animated.View style={[styles.header, header]}>
        <Pressable onPress={onOpenMenu} accessibilityRole="button" accessibilityLabel={t('menu.open')} hitSlop={touch.hitSlop}>
          <Avatar size={size.ctaArrow} />
        </Pressable>
        <Greeting />
        <IconButton
          icon="bell"
          label={`${t('common.notifications')}, ${t('common.comingSoon')}`}
          onPress={() => undefined}
          disabled
          style={styles.soon}
        />
      </Animated.View>

      {/* The map is drawn by the parent exactly under this box. */}
      <Pressable
        ref={mapSlotRef}
        onLayout={onMapSlotLayout}
        style={styles.mapSlot}
        onPress={() => onSearch()}
        accessibilityRole="button"
        accessibilityLabel={t('home.search')}
      >
        <CornerMask radius={radius.hero} color={colors.background} />
        <CenterPin bounce />
        <PressableScale style={[styles.search, shadow.card]} onPress={() => onSearch()} accessibilityLabel={t('home.search')}>
          <Icon name="search" size={iconSize.sm} color={colors.brand} />
          <Text style={styles.searchText}>{t('home.search')}</Text>
          <View style={styles.searchGo}>
            <Icon name="arrowRight" size={iconSize.sm} color={colors.onColor} />
          </View>
        </PressableScale>
      </Pressable>

      <Animated.View style={[styles.tiles, tiles]}>
        <View style={styles.tileRow}>
          <Tile tone="brand" icon="car" title={t('home.ride')} hint={t('home.rideHint')} onPress={() => onSearch('car')} compact={compact} />
          <Tile tone="accent" icon="bike" title={t('home.moto')} hint={t('home.motoHint')} onPress={() => onSearch('bike')} compact={compact} />
        </View>
        <View style={styles.tileRow}>
          <Tile tone="plain" icon="rickshaw" title={t('home.rickshaw')} hint={t('home.rickshawHint')} comingSoon compact={compact} />
          <Tile tone="plain" icon="globe" title={t('home.intercity')} hint={t('home.intercityHint')} comingSoon compact={compact} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.places, placesIn]}>
        {shown.length ? (
          shown.map((place, i) => (
            <PlaceRow
              key={place.id}
              icon={PLACE_ICON[place.kind]}
              title={place.label}
              hint={place.kind === 'other' ? t('home.savedPlace') : t(`places.${place.kind}`)}
              onPress={() => onPlace(place)}
              divider={i < shown.length - 1}
            />
          ))
        ) : (
          <PlaceRow icon="plus" title={t('home.addPlaces')} hint={t('home.addPlacesHint')} onPress={() => router.push('/places')} />
        )}
      </Animated.View>

      <Animated.View style={nav}>
        <BottomNav
          active="home"
          items={[
            { key: 'home', icon: 'home', label: t('home.nav.home') },
            { key: 'trips', icon: 'clock', label: t('home.nav.trips'), onPress: () => router.push('/history') },
            { key: 'wallet', icon: 'wallet', label: t('home.nav.wallet'), comingSoon: true },
            { key: 'profile', icon: 'user', label: t('home.nav.profile'), onPress: () => router.push('/profile') },
          ]}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function Greeting() {
  const { t } = useTranslation();
  const firstName = useAuth((s) => s.user?.name?.trim().split(/\s+/)[0] ?? '');
  return (
    <View style={styles.greeting}>
      <Text style={text.label}>{t(greetingKey(new Date().getHours()))}</Text>
      <Text style={styles.whereTo} numberOfLines={1}>
        {t('home.whereToName', { name: firstName })}
      </Text>
    </View>
  );
}

function Tile({
  tone,
  icon,
  title,
  hint,
  onPress,
  comingSoon,
  compact,
}: {
  tone: 'brand' | 'accent' | 'plain';
  icon: IconName;
  title: string;
  hint: string;
  onPress?: () => void;
  comingSoon?: boolean;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const wiggle = useRef(new Animated.Value(0)).current;
  const fg = tone === 'brand' ? colors.onColor : colors.text;
  const iconColor = tone === 'brand' ? colors.accent : tone === 'accent' ? colors.onAccent : colors.brand;

  const doWiggle = () => {
    if (reduce) return;
    wiggle.setValue(0);
    Animated.timing(wiggle, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };
  const rotate = wiggle.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', '-8deg', '8deg', '0deg'] });

  return (
    <PressableScale
      style={[styles.tile, compact && styles.tileCompact, styles[tone], comingSoon && styles.tileSoon]}
      onPress={onPress}
      onPressIn={doWiggle}
      disabled={comingSoon}
      accessibilityLabel={comingSoon ? `${title}, ${t('common.comingSoon')}` : `${title}, ${hint}`}
    >
      <View style={styles.tileTop}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name={icon} size={iconSize.lg} color={iconColor} />
        </Animated.View>
        {comingSoon ? <ComingSoonBadge /> : null}
      </View>
      <View>
        <Text style={[styles.tileTitle, { color: fg }]}>{title}</Text>
        <Text style={[styles.tileHint, { color: tone === 'brand' ? colors.onBrandMuted : colors.textSecondary }]} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

function PlaceRow({
  icon,
  title,
  hint,
  onPress,
  divider,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable style={[styles.placeRow, divider && styles.divider]} onPress={onPress} accessibilityRole="button">
      <View style={styles.placeIcon}>
        <Icon name={icon} size={iconSize.sm} color={colors.brand} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.placeTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={text.caption} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <Icon name="chevronRight" size={iconSize.sm} color={colors.disabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2], gap: space[3] },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  greeting: { flex: 1 },
  whereTo: { ...displayFont('extraBold', letterSpacing.heading), fontSize: fontSize.brandLarge, color: colors.text },
  soon: { opacity: opacity.dim },
  mapSlot: { flex: 1, minHeight: size.mapCardMin, borderRadius: radius.hero, justifyContent: 'flex-end', padding: space[3] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: touch.button - space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingStart: space[4.5],
    paddingEnd: space[2],
  },
  searchText: { ...bodyFont('medium'), flex: 1, fontSize: fontSize.base, color: colors.textSecondary },
  searchGo: {
    width: size.ctaArrow - space[2],
    height: size.ctaArrow - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: { gap: space[3] },
  tileRow: { flexDirection: 'row', gap: space[3] },
  tile: {
    flex: 1,
    height: size.tile,
    borderRadius: radius.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3.5],
    justifyContent: 'space-between',
  },
  tileCompact: { height: size.tileCompact, paddingVertical: space[2.5] },
  brand: { backgroundColor: colors.brand },
  accent: { backgroundColor: colors.accent },
  plain: { backgroundColor: colors.surface },
  tileSoon: { opacity: opacity.dim },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileTitle: { ...bodyFont('bold'), fontSize: fontSize.lg },
  tileHint: { ...bodyFont('medium'), fontSize: fontSize.xs },
  places: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: space[4], paddingVertical: space[1] },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: touch.button - space[1] },
  divider: { borderBottomWidth: borderWidth.thin, borderBottomColor: colors.borderLight },
  placeIcon: {
    width: size.iconButton - space[2.5],
    height: size.iconButton - space[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeTitle: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.text },
});
