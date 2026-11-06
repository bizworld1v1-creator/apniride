import { ApiError, type LatLng, type VehicleType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ComingSoonBadge, Icon, IconButton, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatRupees, useFareEstimate } from '@/lib/fare';
import { bodyFont } from '@/lib/fonts';
import { useJelly } from '@/lib/motion';
import { setCurrentRide } from '@/lib/ride';
import { colors, fontSize, iconSize, opacity, radius, size, space, text, touch } from '@/lib/theme';
import { RouteCard } from './RouteCard';

const VEHICLE_ICON = { car: 'car', bike: 'bike' } as const;

/**
 * "Your fare" page (design: fare.html). Until fare bidding is built (owner decision 2026-11-07), the blue card shows
 * our fixed fare instead of a price slider, and the passenger picks car or bike there.
 */
export function FareScreen({
  pickup,
  dropoff,
  fromLabel,
  toLabel,
  initialVehicle = 'car',
  onBack,
}: {
  pickup: LatLng;
  dropoff: LatLng;
  fromLabel: string;
  toLabel: string;
  initialVehicle?: VehicleType;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch, isRefetching } = useFareEstimate(pickup, dropoff);
  const [vehicle, setVehicle] = useState<VehicleType>(initialVehicle);
  const option = data?.options.find((o) => o.vehicleType === vehicle) ?? data?.options[0];
  const jelly = useJelly(option?.fare);

  const book = useMutation({
    mutationFn: (vehicleType: VehicleType) => api.rides.book({ quoteId: data!.quoteId, vehicleType }),
    // The home screen switches to "finding your driver" as soon as there's a current ride.
    onSuccess: (ride) => setCurrentRide(queryClient, ride),
    onError: (err) => {
      // Quote older than 10 minutes: get a fresh fare; the passenger taps Book again.
      if (err instanceof ApiError && err.code === 'quote_expired') void refetch();
    },
  });

  const fare = option ? t('ride.fare', { amount: formatRupees(option.fare) }) : '';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={onBack} />
        <Text style={text.h2} accessibilityRole="header">
          {t('ride.yourFare')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <RouteCard from={fromLabel} to={toLabel} km={data?.distanceKm} minutes={option?.durationMin} />

        <Card tone="hero" index={1}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{t('ride.fixedLabel')}</Text>
            <Text style={styles.heroLabel}>{t('ride.noBargain')}</Text>
          </View>
          {isPending ? (
            <ActivityIndicator color={colors.onColor} style={styles.loading} accessibilityLabel={t('ride.calculating')} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorOnBlue}>{errorMessage(t, error)}</Text>
              <Button variant="light" label={t('ride.retry')} onPress={() => void refetch()} loading={isRefetching} />
            </View>
          ) : (
            <>
              <Animated.Text
                style={[text.priceHero, styles.price, { transform: [{ scale: jelly }] }]}
                adjustsFontSizeToFit
                numberOfLines={1}
                accessibilityLiveRegion="polite"
              >
                {fare}
              </Animated.Text>
              <View style={styles.vehicles} accessibilityRole="radiogroup">
                {data.options.map((o) => {
                  const on = o.vehicleType === vehicle;
                  return (
                    <PressableScale
                      key={o.vehicleType}
                      style={[styles.vehicle, on && styles.vehicleOn]}
                      onPress={() => setVehicle(o.vehicleType)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${t(`ride.${o.vehicleType}`)}, ${t('ride.fare', { amount: formatRupees(o.fare) })}`}
                    >
                      <Icon name={VEHICLE_ICON[o.vehicleType]} size={iconSize.sm} color={on ? colors.text : colors.onColor} />
                      <Text style={[styles.vehicleText, on && styles.vehicleTextOn]}>{t(`ride.${o.vehicleType}`)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Text style={styles.hint}>{t(`ride.${vehicle}Hint`)}</Text>
            </>
          )}
        </Card>

        <Card index={2}>
          <Text style={text.body}>{t('ride.fixedFare')}</Text>
        </Card>

        <View style={styles.payRow}>
          <View style={styles.pay} accessible accessibilityLabel={`${t('ride.payWith')}: ${t('ride.cash')}`}>
            <View style={styles.cashDot} />
            <Text style={styles.payText}>{t('ride.cash')}</Text>
          </View>
          <View
            style={[styles.pay, styles.paySoon]}
            accessible
            accessibilityLabel={`${t('ride.jazzcash')}, ${t('common.comingSoon')}`}
          >
            <Text style={styles.payText}>{t('ride.jazzcash')}</Text>
            <ComingSoonBadge />
          </View>
        </View>

        {book.isError ? <Text style={styles.error}>{errorMessage(t, book.error)}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          variant="ink"
          label={option ? t('ride.book', { vehicle: t(`ride.${vehicle}`), fare }) : t('ride.calculating')}
          onPress={() => book.mutate(vehicle)}
          loading={book.isPending}
          disabled={!option || isRefetching}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingVertical: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[4], gap: space[3.5] },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  heroLabel: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.onBrandMuted },
  loading: { marginVertical: space[10] },
  price: { color: colors.onColor, marginVertical: space[2] },
  vehicles: { flexDirection: 'row', gap: space[2] },
  vehicle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: touch.min,
    borderRadius: radius.pill,
    backgroundColor: colors.onBrandSubtle,
  },
  vehicleOn: { backgroundColor: colors.surface },
  vehicleText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onColor },
  vehicleTextOn: { color: colors.text },
  hint: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.onBrandMuted, marginTop: space[3] },
  errorBox: { gap: space[3], marginTop: space[3] },
  errorOnBlue: { ...bodyFont('semibold'), fontSize: fontSize.base, color: colors.onColor },
  payRow: { flexDirection: 'row', gap: space[3] },
  pay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: touch.button - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
  },
  paySoon: { opacity: opacity.dim, justifyContent: 'space-between' },
  cashDot: { width: size.pagerDot + space[0.5], height: size.pagerDot + space[0.5], borderRadius: radius.pill, backgroundColor: colors.online },
  payText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.text },
  error: { ...bodyFont('medium'), fontSize: fontSize.base, color: colors.error, textAlign: 'center' },
  footer: { paddingHorizontal: space[5], paddingBottom: space[2], paddingTop: space[2] },
});
