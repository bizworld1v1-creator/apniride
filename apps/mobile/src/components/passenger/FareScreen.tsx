import { ApiError, clampOffer, type LatLng, offerRange, type VehicleType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Button, Card, Chip, ComingSoonBadge, Icon, PressableScale, Slider } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatRupees, useFareEstimate } from '@/lib/fare';
import { bodyFont } from '@/lib/fonts';
import { useJelly } from '@/lib/motion';
import { setCurrentRide } from '@/lib/ride';
import { colors, fontSize, iconSize, opacity, radius, size, space, text, touch } from '@/lib/theme';
import { RouteCard } from './RouteCard';

/** Quick buttons under the slider (design: −Rs 20, +Rs 20, +Rs 50). */
const QUICK = [-20, 20, 50] as const;

/** How keen drivers will be, from the offer compared with the fair price: 2, 3 or 4 cars lit. */
function meterLevel(offer: number, fair: number): 2 | 3 | 4 {
  const ratio = offer / fair;
  if (ratio >= 1.25) return 4;
  if (ratio >= 1.1) return 3;
  return 2;
}
const METER = {
  2: ['ride.meterFair', 'ride.meterFairHint'],
  3: ['ride.meterMore', 'ride.meterMoreHint'],
  4: ['ride.meterRush', 'ride.meterRushHint'],
} as const;

/**
 * "Name your price" (design: fare.html, like inDrive). The passenger offers their own price: never below the fair
 * price for the distance (the recommended fare from the server), at most 2× (`offerRange` in packages/shared).
 * Drivers see the offered price. Counter-offers from drivers come with the full bidding chunk.
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
  const fair = option?.fare ?? 0;
  // The offer belongs to one fair price: a new vehicle or a refreshed quote starts again from the fair price.
  const [chosen, setChosen] = useState<{ fair: number; offer: number } | null>(null);
  const offer = chosen && chosen.fair === fair ? chosen.offer : fair;
  const range = offerRange(fair);
  const setOffer = (value: number) => setChosen({ fair, offer: clampOffer(fair, value) });
  const jelly = useJelly(offer);
  const rupees = (amount: number) => t('ride.fare', { amount: formatRupees(amount) });

  const book = useMutation({
    mutationFn: () => api.rides.book({ quoteId: data!.quoteId, vehicleType: option!.vehicleType, offeredFare: offer }),
    // The home screen switches to "finding your driver" as soon as there's a current ride.
    onSuccess: (ride) => setCurrentRide(queryClient, ride),
    onError: (err) => {
      // Quote older than 10 minutes: get a fresh fare; the passenger taps Send again.
      if (err instanceof ApiError && err.code === 'quote_expired') void refetch();
    },
  });

  const level = meterLevel(offer, fair || 1);
  const [meterTitle, meterHint] = METER[level];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={text.h2} accessibilityRole="header">
          {t('ride.nameYourPrice')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <RouteCard from={fromLabel} to={toLabel} km={data?.distanceKm} minutes={option?.durationMin} />

        {data ? (
          <View style={styles.vehicles} accessibilityRole="radiogroup">
            {data.options.map((o) => (
              <Chip
                key={o.vehicleType}
                label={t(`ride.${o.vehicleType}`)}
                selected={o.vehicleType === option?.vehicleType}
                onPress={() => setVehicle(o.vehicleType)}
              />
            ))}
          </View>
        ) : null}

        <Card tone="hero" index={1}>
          {isPending ? (
            <ActivityIndicator color={colors.onColor} style={styles.loading} accessibilityLabel={t('ride.calculating')} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorOnBlue}>{errorMessage(t, error)}</Text>
              <Button variant="light" label={t('ride.retry')} onPress={() => void refetch()} loading={isRefetching} />
            </View>
          ) : (
            <>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>{t('ride.yourOffer')}</Text>
                <Text style={styles.heroLabel}>{t('ride.fairPrice', { fare: rupees(fair) })}</Text>
              </View>
              <Animated.Text
                style={[text.priceHero, styles.price, { transform: [{ scale: jelly }] }]}
                adjustsFontSizeToFit
                numberOfLines={1}
                accessibilityLiveRegion="polite"
              >
                {rupees(offer)}
              </Animated.Text>
              <Slider
                min={range.min}
                max={range.max}
                value={offer}
                step={range.step}
                snap={(raw) => clampOffer(fair, raw)}
                onChange={setOffer}
                accessibilityLabel={t('ride.priceSlider')}
                valueText={rupees(offer)}
              />
              <View style={styles.rangeLabels}>
                <Text style={styles.heroLabel}>{rupees(range.min)}</Text>
                <Text style={styles.heroLabel}>{rupees(range.max)}</Text>
              </View>
              <View style={styles.quick}>
                {QUICK.map((delta) => {
                  const next = clampOffer(fair, offer + delta);
                  const label = `${delta < 0 ? '−' : '+'}${rupees(Math.abs(delta))}`;
                  return (
                    <PressableScale
                      key={delta}
                      style={[styles.quickButton, next === offer && styles.quickOff]}
                      onPress={() => setOffer(offer + delta)}
                      disabled={next === offer}
                      accessibilityLabel={t(delta < 0 ? 'ride.lower' : 'ride.raise', { fare: rupees(Math.abs(delta)) })}
                    >
                      <Text style={styles.quickText}>{label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        {option ? (
          <Card index={2}>
            <View style={styles.meter} accessible accessibilityLabel={`${t(meterTitle)}. ${t(meterHint)}`}>
              <View style={styles.cars}>
                {[1, 2, 3, 4].map((n) => (
                  <Icon key={n} name="car" size={iconSize.md} color={n <= level ? colors.brand : colors.disabled} />
                ))}
              </View>
              <View style={styles.flex}>
                <Text style={text.title}>{t(meterTitle)}</Text>
                <Text style={text.caption}>{t(meterHint)}</Text>
              </View>
            </View>
          </Card>
        ) : null}

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
          label={option ? t('ride.sendOffer', { fare: rupees(offer) }) : t('ride.calculating')}
          onPress={() => book.mutate()}
          loading={book.isPending}
          disabled={!option || isRefetching}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingVertical: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[4], gap: space[3.5] },
  vehicles: { flexDirection: 'row', gap: space[2] },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  heroLabel: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.onBrandMuted },
  loading: { marginVertical: space[10] },
  price: { color: colors.onColor, marginVertical: space[1] },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' },
  quick: { flexDirection: 'row', gap: space[2], marginTop: space[4] },
  quickButton: {
    flex: 1,
    minHeight: touch.min + space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.onBrandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOff: { opacity: opacity.faint },
  quickText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onColor },
  errorBox: { gap: space[3], marginTop: space[3] },
  errorOnBlue: { ...bodyFont('semibold'), fontSize: fontSize.base, color: colors.onColor },
  meter: { flexDirection: 'row', alignItems: 'center', gap: space[3.5] },
  cars: { flexDirection: 'row', gap: space[1] },
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
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, textAlign: 'center' },
  footer: { paddingHorizontal: space[5], paddingBottom: space[2], paddingTop: space[2] },
});
