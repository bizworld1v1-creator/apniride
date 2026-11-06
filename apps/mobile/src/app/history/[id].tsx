import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { formatRupees } from '@/lib/fare';
import { formatDateTime, otherPerson, statusStyle } from '@/components/HistoryRow';
import { CornerMask } from '@/components/passenger/CornerMask';
import { PageLayout, pageStyles } from '@/components/PageLayout';
import { findHistoryItem } from '@/lib/account';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { useMode } from '@/lib/mode';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, radius, size, space, text } from '@/lib/theme';

/** One finished ride, from the already-loaded history list (no extra download). */
export default function RideDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mode = useMode();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const ride = id ? findHistoryItem(queryClient, mode, id) : undefined;

  if (!ride) {
    return (
      <PageLayout title={t('history.detailTitle')}>
        <Text style={pageStyles.muted}>{t('history.notFound')}</Text>
      </PageLayout>
    );
  }

  const who = otherPerson(t, mode, ride);
  const rows: [string, string][] = [
    [t('history.booked'), formatDateTime(ride.createdAt, i18n.language)],
    ...(ride.endedAt ? [[t('history.ended'), formatDateTime(ride.endedAt, i18n.language)] as [string, string]] : []),
    [t('history.vehicle'), t(`ride.${ride.vehicleType}`)],
    [t('history.fare'), `${t('ride.fare', { amount: formatRupees(ride.fare) })}${ride.status === 'completed' ? ` · ${t('history.paidCash')}` : ''}`],
    ['', t('history.trip', { km: ride.distanceKm.toFixed(1), min: ride.durationMin })],
  ];

  return (
    <PageLayout title={t('history.detailTitle')}>
      <View style={styles.mapBox}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          // Android "lite mode": a still picture of the map, much lighter than a live map on low-end phones.
          liteMode={Platform.OS === 'android'}
          initialRegion={{
            latitude: (ride.pickup.latitude + ride.dropoff.latitude) / 2,
            longitude: (ride.pickup.longitude + ride.dropoff.longitude) / 2,
            latitudeDelta: Math.abs(ride.pickup.latitude - ride.dropoff.latitude) * 1.8 + 0.01,
            longitudeDelta: Math.abs(ride.pickup.longitude - ride.dropoff.longitude) * 1.8 + 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          <Marker coordinate={ride.pickup} pinColor={colors.pickupPin} tracksViewChanges={false} />
          <Marker coordinate={ride.dropoff} pinColor={colors.dropoffPin} tracksViewChanges={false} />
        </MapView>
        <CornerMask radius={radius.card} color={colors.background} />
      </View>

      <Text style={[styles.status, statusStyle(ride.status)]}>{t(`history.status.${ride.status}`)}</Text>
      {ride.status === 'cancelled' && ride.cancelledBy ? (
        <Text style={pageStyles.muted}>{t(`history.cancelledBy.${ride.cancelledBy}`)}</Text>
      ) : null}
      {who ? <Text style={styles.who}>{who}</Text> : null}

      <View style={[pageStyles.card, styles.rows]}>
        {rows.map(([label, value], i) => (
          <View key={label + value} style={[styles.row, i < rows.length - 1 && styles.divider]}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  mapBox: { height: size.mapCardMin + space[12], borderRadius: radius.card, overflow: 'hidden', marginBottom: space[4] },
  status: { ...text.h2 },
  who: { ...text.body, marginTop: space[1] },
  rows: { marginTop: space[4] },
  row: { gap: space[0.5], paddingVertical: space[3] },
  divider: { borderBottomWidth: borderWidth.thin, borderBottomColor: colors.borderLight },
  label: { ...text.caption },
  value: { ...bodyFont('semibold'), fontSize: fontSize.base, color: colors.text },
});
