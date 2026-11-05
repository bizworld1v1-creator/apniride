import type { FareOption, LatLng, VehicleType } from '@apniride/shared';
import { ApiError } from '@apniride/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { setCurrentRide } from '@/lib/ride';
import { borderWidth, colors, elevation, fontSize, fontWeight, iconSize, opacity, radius, space, touch } from '@/lib/theme';

const ICONS: Record<VehicleType, string> = { bike: '🏍️', car: '🚗' };

// ~11 m: tiny map nudges reuse the cached quote instead of hitting the network again.
const round = (p: LatLng) => [Math.round(p.latitude * 1e4) / 1e4, Math.round(p.longitude * 1e4) / 1e4];

export function useFareEstimate(pickup: LatLng, dropoff: LatLng) {
  return useQuery({
    queryKey: ['fare', ...round(pickup), ...round(dropoff)],
    queryFn: () => api.fares.estimate({ pickup, dropoff }),
    // A quote is valid for 10 minutes on the server; refresh a bit before that.
    staleTime: 8 * 60_000,
    retry: false,
  });
}

export function formatRupees(amount: number) {
  return amount.toLocaleString('en-PK');
}

/** Bottom sheet with a fixed fare per vehicle type. */
export function FareSheet({
  pickup,
  dropoff,
  onChangeDestination,
}: {
  pickup: LatLng;
  dropoff: LatLng;
  onChangeDestination: () => void;
}) {
  const { t } = useTranslation();
  const { data, error, isPending, refetch, isRefetching } = useFareEstimate(pickup, dropoff);
  const [selected, setSelected] = useState<VehicleType>('car');
  const queryClient = useQueryClient();

  const book = useMutation({
    mutationFn: (vehicleType: VehicleType) => api.rides.book({ quoteId: data!.quoteId, vehicleType }),
    // The home screen switches to the ride status sheet as soon as there's a current ride.
    onSuccess: (ride) => setCurrentRide(queryClient, ride),
    onError: (err) => {
      // Quote older than 10 minutes: get a fresh fare; the passenger taps Book again.
      if (err instanceof ApiError && err.code === 'quote_expired') void refetch();
    },
  });
  const selectedFare = data?.options.find((o) => o.vehicleType === selected)?.fare;

  return (
    <View style={styles.sheet}>
      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>{t('ride.calculating')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMessage(t, error)}</Text>
          <Pressable style={styles.secondary} onPress={() => void refetch()} disabled={isRefetching}>
            <Text style={styles.secondaryText}>{t('ride.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.distance}>{t('ride.distance', { km: data.distanceKm })}</Text>
          {data.options.map((option) => (
            <OptionRow
              key={option.vehicleType}
              option={option}
              selected={option.vehicleType === selected}
              onPress={() => setSelected(option.vehicleType)}
            />
          ))}
          <Text style={styles.fixed}>{t('ride.fixedFare')}</Text>
          {book.isError ? <Text style={styles.error}>{errorMessage(t, book.error)}</Text> : null}
          <Pressable
            style={[styles.primary, (book.isPending || isRefetching) && styles.disabled]}
            onPress={() => book.mutate(selected)}
            disabled={book.isPending || isRefetching}
            accessibilityRole="button"
          >
            {book.isPending ? (
              <ActivityIndicator color={colors.brandText} />
            ) : (
              <Text style={styles.primaryText}>
                {t('ride.book', {
                  vehicle: t(`ride.${selected}`),
                  fare: t('ride.fare', { amount: formatRupees(selectedFare ?? 0) }),
                })}
              </Text>
            )}
          </Pressable>
        </>
      )}
      <Pressable onPress={onChangeDestination} hitSlop={touch.hitSlop} accessibilityRole="button">
        <Text style={styles.link}>{t('ride.changeDestination')}</Text>
      </Pressable>
    </View>
  );
}

function OptionRow({ option, selected, onPress }: { option: FareOption; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={styles.icon}>{ICONS[option.vehicleType]}</Text>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{t(`ride.${option.vehicleType}`)}</Text>
        <Text style={styles.muted}>
          {t(`ride.${option.vehicleType}Hint`)} · {t('ride.minutes', { count: option.durationMin })}
        </Text>
      </View>
      <Text style={styles.fare}>{t('ride.fare', { amount: formatRupees(option.fare) })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space[4], elevation: elevation.medium },
  center: { alignItems: 'center', paddingVertical: space[4] },
  distance: { fontSize: fontSize.sm, color: colors.muted, marginBottom: space[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: 'transparent',
    marginBottom: space[1.5],
    backgroundColor: colors.background,
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  icon: { fontSize: iconSize.lg, marginEnd: space[3] },
  optionText: { flex: 1 },
  optionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  fare: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.muted, marginTop: space[0.5] },
  fixed: { fontSize: fontSize.sm, color: colors.muted, marginVertical: space[2], textAlign: 'center' },
  error: { fontSize: fontSize.base, color: colors.error, textAlign: 'center', marginBottom: space[3] },
  primary: { backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: space[4], alignItems: 'center' },
  disabled: { opacity: opacity.disabled },
  primaryText: { color: colors.brandText, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
  secondary: { borderWidth: borderWidth.thin, borderColor: colors.brand, borderRadius: radius.md, paddingVertical: space[2.5], paddingHorizontal: space[6] },
  secondaryText: { color: colors.brand, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  link: { color: colors.brand, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center', paddingTop: space[3] },
});
