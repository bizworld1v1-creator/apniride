import { CITY_CENTERS, type LatLng } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveRideCard } from '@/components/ActiveRideCard';
import { OfferCard } from '@/components/OfferCard';
import { ServerStatus } from '@/components/ServerStatus';
import { VehiclePicker } from '@/components/VehiclePicker';
import { api, signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { PROFILE_KEY, useDriverCurrent, useDriverProfile } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { colors } from '@/lib/theme';
import { useLocationSharing } from '@/lib/use-location-sharing';

const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
const ICONS = { bike: '🏍️', car: '🚗' } as const;

class LocationDeniedError extends Error {}

async function currentPosition(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationDeniedError();
  // A fix from the last minute is good enough and instant; otherwise ask the GPS.
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export default function DriverHomeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const name = useAuth((s) => s.user?.name);
  const profile = useDriverProfile();
  const { data: current } = useDriverCurrent();
  const [changingVehicle, setChangingVehicle] = useState(false);

  const online = profile.data?.online ?? false;
  const offer = current?.offer ?? null;
  const ride = current?.ride ?? null;
  const onRide = !!ride && (ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in_progress');

  const toggle = useMutation({
    mutationFn: async () =>
      online ? api.driver.goOffline() : api.driver.goOnline({ location: await currentPosition() }),
    onSuccess: (p) => queryClient.setQueryData(PROFILE_KEY, p),
  });

  const follow = useCallback((p: LatLng) => {
    mapRef.current?.animateCamera({ center: p }, { duration: 400 });
  }, []);
  // Keep sharing during a ride even if the driver went offline: the passenger is tracking them.
  useLocationSharing(online || onRide, follow);

  // Show the whole trip when an offer or ride appears.
  const focusId = offer?.rideId ?? ride?.id;
  useEffect(() => {
    const target = offer ?? ride;
    if (!target) return;
    mapRef.current?.fitToCoordinates([target.pickup, target.dropoff], {
      edgePadding: { top: 160, right: 60, bottom: 420, left: 60 },
      animated: true,
    });
    // Only when a different offer/ride appears, not on every status change.
  }, [focusId]);

  const p = profile.data;
  const shown = offer ?? ride;
  const toggleError =
    toggle.error instanceof LocationDeniedError ? t('locationDenied') : toggle.error ? errorMessage(t, toggle.error) : null;

  let bottom: ReactNode;
  if (profile.isPending) {
    bottom = <ActivityIndicator color={colors.brand} />;
  } else if (p && (!p.vehicleType || changingVehicle)) {
    bottom = <VehiclePicker current={p.vehicleType} onDone={() => setChangingVehicle(false)} />;
  } else if (p && p.approvalStatus !== 'approved') {
    bottom = (
      <View style={styles.sheet}>
        <Text style={styles.sheetText}>{t('vehicle.pending')}</Text>
      </View>
    );
  } else if (ride) {
    bottom = <ActiveRideCard ride={ride} />;
  } else if (offer) {
    bottom = <OfferCard key={offer.rideId} offer={offer} />;
  } else {
    bottom = (
      <>
        {online ? <Text style={styles.waiting}>{t('waitingForRides')}</Text> : null}
        {toggleError ? <Text style={styles.toggleError}>{toggleError}</Text> : null}
        <Pressable
          style={[styles.toggle, { backgroundColor: online ? '#DC2626' : '#16A34A' }]}
          onPress={() => toggle.mutate()}
          disabled={toggle.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: online, busy: toggle.isPending }}
        >
          {toggle.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.toggleText}>{online ? t('goOffline') : t('goOnline')}</Text>
          )}
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={MAP_PROVIDER}
        initialRegion={{ ...CITY_CENTERS.LHE, ...DELTA }}
        showsUserLocation={online || onRide}
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      >
        {shown ? (
          <>
            <Marker coordinate={shown.pickup} pinColor="green" tracksViewChanges={false} />
            <Marker coordinate={shown.dropoff} pinColor="red" tracksViewChanges={false} />
          </>
        ) : null}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>{t('appName')}</Text>
            {/* Go offline before signing out, so a driver never vanishes mid-shift by accident. */}
            <Pressable onPress={() => void signOut()} disabled={online || onRide} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.signOut, (online || onRide) && styles.signOutDisabled]}>{t('auth.signOut')}</Text>
            </Pressable>
          </View>
          {name ? <Text style={styles.greeting}>{t('auth.greeting', { name })}</Text> : null}
          <View style={styles.statusRow}>
            <Text style={[styles.status, { color: online ? '#16A34A' : colors.muted }]}>
              {online ? t('online') : t('offline')}
            </Text>
            {p?.vehicleType ? (
              <Pressable
                onPress={() => setChangingVehicle(true)}
                disabled={online || onRide}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.vehicle}>
                  {ICONS[p.vehicleType]} {t(`vehicle.${p.vehicleType}`)}
                  {online || onRide ? '' : ` · ${t('vehicle.change')}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <ServerStatus />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        {bottom}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: 12 },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 20, fontWeight: '700', color: colors.brand },
  signOut: { fontSize: 13, color: colors.muted },
  signOutDisabled: { opacity: 0.4 },
  greeting: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  status: { fontSize: 15, fontWeight: '600' },
  vehicle: { fontSize: 13, color: colors.muted },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 6 },
  sheetText: { fontSize: 15, color: colors.text, textAlign: 'center' },
  waiting: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 3,
  },
  toggleError: {
    backgroundColor: '#FEF2F2',
    color: colors.error,
    fontSize: 14,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  toggle: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', elevation: 3, minHeight: 56, justifyContent: 'center' },
  toggleText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
