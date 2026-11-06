import type { AppMode, RideHistoryItem } from '@apniride/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, PressableScale } from '@/components/ui';
import { formatRupees } from '@/lib/fare';
import { bodyFont, displayFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, size, space } from '@/lib/theme';

const ICONS = { bike: 'bike', car: 'car' } as const;

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
    <PressableScale style={styles.row} onPress={onPress}>
      <View style={styles.iconBox}>
        <Icon name={ICONS[ride.vehicleType]} size={iconSize.md} color={colors.brand} />
      </View>
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
    </PressableScale>
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
    borderRadius: radius.card - space[2],
    padding: space[3.5],
    marginBottom: space[2.5],
  },
  iconBox: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.text },
  muted: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.textSecondary, marginTop: space[0.5] },
  status: { ...bodyFont('bold'), fontSize: fontSize.sm, marginTop: space[0.5] },
  completed: { color: colors.success },
  notCompleted: { color: colors.textSecondary },
  fare: { ...displayFont('extraBold'), fontSize: fontSize.xxl, color: colors.text },
  // Nobody paid for a cancelled ride.
  fareStruck: { color: colors.muted, textDecorationLine: 'line-through' },
});
