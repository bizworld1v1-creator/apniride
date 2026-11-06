import type { AppMode, RideHistoryItem } from '@apniride/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRupees } from '@/lib/fare';
import { borderWidth, colors, fontSize, fontWeight, radius, space } from '@/lib/theme';

const ICONS = { bike: '🏍️', car: '🚗' } as const;

/** "6 Nov 2026, 9:41 pm" in the app's language, always in Pakistan time. */
export function formatDateTime(iso: string, language: string): string {
  try {
    return new Intl.DateTimeFormat(language === 'ur' ? 'ur-PK' : 'en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Karachi',
    }).format(new Date(iso));
  } catch {
    // No Intl time-zone support on this phone: use its own format.
    return new Date(iso).toLocaleString();
  }
}

/** The other person on the ride, first name only. */
export function otherPerson(t: TFunction, mode: AppMode, ride: RideHistoryItem): string | null {
  if (mode === 'passenger') return ride.driver?.firstName ? t('history.withDriver', { name: ride.driver.firstName }) : null;
  return ride.passenger.firstName ? t('history.withPassenger', { name: ride.passenger.firstName }) : null;
}

export function statusStyle(status: RideHistoryItem['status']) {
  return status === 'completed' ? styles.completed : styles.notCompleted;
}

/** One finished ride in the history list. */
export function HistoryRow({ ride, mode, onPress }: { ride: RideHistoryItem; mode: AppMode; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const who = otherPerson(t, mode, ride);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.icon}>{ICONS[ride.vehicleType]}</Text>
      <View style={styles.flex}>
        <Text style={styles.date}>{formatDateTime(ride.createdAt, i18n.language)}</Text>
        <Text style={styles.muted}>
          {t('history.trip', { km: ride.distanceKm.toFixed(1), min: ride.durationMin })}
          {who ? ` · ${who}` : ''}
        </Text>
        <Text style={[styles.status, statusStyle(ride.status)]}>{t(`history.status.${ride.status}`)}</Text>
      </View>
      <Text style={[styles.fare, ride.status !== 'completed' && styles.fareStruck]}>
        {t('ride.fare', { amount: formatRupees(ride.fare) })}
      </Text>
    </Pressable>
  );
}

export const historyIcons = ICONS;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.borderLight,
    padding: space[3],
    marginBottom: space[2],
  },
  icon: { fontSize: fontSize.heading },
  date: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.muted, marginTop: space[0.5] },
  status: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: space[0.5] },
  completed: { color: colors.success },
  notCompleted: { color: colors.muted },
  fare: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  // Nobody paid for a cancelled ride.
  fareStruck: { color: colors.muted, textDecorationLine: 'line-through' },
});
