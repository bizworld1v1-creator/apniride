import type { FareOption, LatLng, VehicleType } from '@apniride/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { colors } from '@/lib/theme';

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
          {/* Booking is the next feature; the quote id is already kept on the server. */}
          <Pressable style={[styles.primary, styles.disabled]} disabled accessibilityRole="button">
            <Text style={styles.primaryText}>{t('ride.bookingSoon')}</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={onChangeDestination} hitSlop={8} accessibilityRole="button">
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
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 6 },
  center: { alignItems: 'center', paddingVertical: 16 },
  distance: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: '#ECFEFF' },
  icon: { fontSize: 28, marginEnd: 12 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  fare: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  fixed: { fontSize: 13, color: colors.muted, marginVertical: 8, textAlign: 'center' },
  error: { fontSize: 15, color: colors.error, textAlign: 'center', marginBottom: 12 },
  primary: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  primaryText: { color: colors.brandText, fontSize: 17, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: colors.brand, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  secondaryText: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  link: { color: colors.brand, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingTop: 12 },
});
