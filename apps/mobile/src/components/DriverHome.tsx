import { CITY_CENTERS, type DriverLocationUpdate, type LatLng } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveRideCard } from '@/components/ActiveRideCard';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { MenuButton } from '@/components/SideMenu';
import { OfferCard } from '@/components/OfferCard';
import { ServerStatus } from '@/components/ServerStatus';
import { VehicleMarker } from '@/components/VehicleMarker';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { PROFILE_KEY, useDriverCurrent, useDriverProfile } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { colors, elevation, fontSize, fontWeight, radius, space, touch } from '@/lib/theme';
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

/** Driver mode: registration status, going online, offers and the current ride. */
export function DriverHome() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const name = useAuth((s) => s.user?.name);
  const profile = useDriverProfile();
  const { data: current } = useDriverCurrent();

  const online = profile.data?.online ?? false;
  const offer = current?.offer ?? null;
  const ride = current?.ride ?? null;
  const onRide = !!ride && (ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in_progress');

  const toggle = useMutation({
    mutationFn: async () =>
      online ? api.driver.goOffline() : api.driver.goOnline({ location: await currentPosition() }),
    onSuccess: (p) => queryClient.setQueryData(PROFILE_KEY, p),
  });

  // The driver's own car / bike on the map (instead of the blue dot), turning with the road.
  const [me, setMe] = useState<DriverLocationUpdate | null>(null);
  const follow = useCallback((p: DriverLocationUpdate) => {
    setMe(p);
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
    toggle.error instanceof LocationDeniedError ? t('driver.locationDenied') : toggle.error ? errorMessage(t, toggle.error) : null;

  let bottom: ReactNode;
  if (profile.isPending) {
    bottom = <ActivityIndicator color={colors.brand} />;
  } else if (ride) {
    // Checked before the approval status: a driver suspended mid-ride can still finish it.
    bottom = <ActiveRideCard ride={ride} />;
  } else if (p && p.approvalStatus !== 'approved') {
    bottom = <DriverStatusCard status={p.approvalStatus} />;
  } else if (offer) {
    bottom = <OfferCard key={offer.rideId} offer={offer} />;
  } else {
    bottom = (
      <>
        {online ? <Text style={styles.waiting}>{t('driver.waitingForRides')}</Text> : null}
        {toggleError ? <Text style={styles.toggleError}>{toggleError}</Text> : null}
        <Pressable
          style={[styles.toggle, { backgroundColor: online ? colors.error : colors.success }]}
          onPress={() => toggle.mutate()}
          disabled={toggle.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: online, busy: toggle.isPending }}
        >
          {toggle.isPending ? (
            <ActivityIndicator color={colors.onColor} />
          ) : (
            <Text style={styles.toggleText}>{online ? t('driver.goOffline') : t('driver.goOnline')}</Text>
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
        // Our vehicle marker replaces the blue dot once we know the vehicle and have a position.
        showsUserLocation={(online || onRide) && !(me && p?.vehicleType)}
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      >
        {me && p?.vehicleType && (online || onRide) ? (
          <VehicleMarker
            location={{ latitude: me.latitude, longitude: me.longitude }}
            heading={me.heading}
            vehicleType={p.vehicleType}
            maxGlideMs={800}
          />
        ) : null}
        {shown ? (
          <>
            <Marker coordinate={shown.pickup} pinColor={colors.pickupPin} tracksViewChanges={false} />
            <Marker coordinate={shown.dropoff} pinColor={colors.dropoffPin} tracksViewChanges={false} />
          </>
        ) : null}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.headerRow}>
            {/* Go offline (and finish the ride) before switching mode or signing out, so a driver never
                vanishes from dispatch by accident. */}
            <MenuButton busy={online || onRide} />
            <Text style={styles.brand}>
              ApniRide <Text style={styles.badge}>· {t('mode.driverBadge')}</Text>
            </Text>
          </View>
          {name ? <Text style={styles.greeting}>{t('auth.greeting', { name })}</Text> : null}
          <View style={styles.statusRow}>
            <Text style={[styles.status, { color: online ? colors.success : colors.muted }]}>
              {online ? t('driver.online') : t('driver.offline')}
            </Text>
            {/* Part of the reviewed application now: changing vehicle means a new review (admin, later). */}
            {p?.vehicleType && p.approvalStatus === 'approved' ? (
              <Text style={styles.vehicle}>
                {ICONS[p.vehicleType]} {t(`driver.vehicle.${p.vehicleType}`)}
              </Text>
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
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: space[3] },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: space[4] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[3], elevation: elevation.low },
  badge: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.muted },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: fontSize.brand, fontWeight: fontWeight.bold, color: colors.brand },
  greeting: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, marginTop: space[1] },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space[0.5] },
  status: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  vehicle: { fontSize: fontSize.sm, color: colors.muted },
  waiting: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.md,
    paddingHorizontal: space[3.5],
    paddingVertical: space[1.5],
    borderRadius: radius.xl,
    marginBottom: space[2.5],
    elevation: elevation.low,
  },
  toggleError: {
    backgroundColor: colors.errorSoft,
    color: colors.error,
    fontSize: fontSize.md,
    padding: space[2.5],
    borderRadius: radius.md,
    marginBottom: space[2.5],
    textAlign: 'center',
  },
  toggle: { borderRadius: radius.lg, paddingVertical: space[4], alignItems: 'center', elevation: elevation.low, minHeight: touch.buttonLarge, justifyContent: 'center' },
  toggleText: { color: colors.onColor, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
});
