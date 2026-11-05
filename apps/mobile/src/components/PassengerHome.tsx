import { CITY_CENTERS, type LatLng } from '@apniride/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FareSheet } from '@/components/FareSheet';
import { ModeSwitch } from '@/components/ModeSwitch';
import { RideStatusSheet } from '@/components/RideStatusSheet';
import { ServerStatus } from '@/components/ServerStatus';
import { VehicleMarker } from '@/components/VehicleMarker';
import { signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDriverPosition } from '@/lib/driver-position';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { useNearbyDrivers } from '@/lib/nearby-drivers';
import { useCurrentRide } from '@/lib/ride';
import { colors, elevation, fontSize, fontWeight, iconSize, radius, space, touch } from '@/lib/theme';

const DELTA = { latitudeDelta: 0.03, longitudeDelta: 0.03 };

/** home → (pickup, only without GPS) → dropoff → quote */
type Step = 'home' | 'pickup' | 'dropoff' | 'quote';

/** Passenger mode: book a ride and follow it. */
export function PassengerHome() {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  // The map centre lives in a ref: updating it while the user drags must not re-render the screen.
  const centerRef = useRef<LatLng>(CITY_CENTERS.LHE);
  const [locationGranted, setLocationGranted] = useState(false);
  const [gpsPickup, setGpsPickup] = useState<LatLng | null>(null);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [step, setStep] = useState<Step>('home');
  const name = useAuth((s) => s.user?.name);
  const { data: ride } = useCurrentRide();
  const rideId = ride?.id;
  const { data: driverPosition } = useDriverPosition(ride);
  const hasDriverPosition = !!driverPosition;
  // Where to look for nearby drivers: the area the passenger is looking at (updated when a pan ends).
  const [lookingAt, setLookingAt] = useState<LatLng | null>(null);
  const { data: nearby } = useNearbyDrivers(lookingAt ?? gpsPickup, !ride);

  // A booked ride takes over the screen; when it's dismissed, start fresh from "Where to?".
  useEffect(() => {
    if (!rideId || !ride) return;
    setStep('home');
    setDropoff(null);
    mapRef.current?.fitToCoordinates([ride.pickup, ride.dropoff], {
      edgePadding: { top: 160, right: 60, bottom: 340, left: 60 },
      animated: true,
    });
    // Only when a different ride appears, not on every status change.
  }, [rideId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;
      setLocationGranted(true);
      // Last known position is instant and free on low-end phones; fall back to a fresh fix.
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (cancelled) return;
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setGpsPickup(here);
      mapRef.current?.animateToRegion({ ...here, ...DELTA }, 500);
    })().catch(() => {
      // No location (GPS off, denied, timeout): the passenger places the pickup pin by hand.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goBack = () => {
    if (step === 'quote') setStep('dropoff');
    else if (step === 'dropoff') setStep(gpsPickup ? 'home' : 'pickup');
    else if (step === 'pickup') setStep('home');
  };

  // Android back button walks back through the steps instead of leaving the app.
  useEffect(() => {
    if (step === 'home') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  });

  const startBooking = () => {
    if (gpsPickup) {
      setPickup(gpsPickup);
      setStep('dropoff');
    } else {
      setStep('pickup');
    }
  };

  const confirmPin = () => {
    const point = { ...centerRef.current };
    if (step === 'pickup') {
      setPickup(point);
      setStep('dropoff');
    } else if (step === 'dropoff' && pickup) {
      setDropoff(point);
      setStep('quote');
      mapRef.current?.fitToCoordinates([pickup, point], {
        edgePadding: { top: 120, right: 60, bottom: 380, left: 60 },
        animated: true,
      });
    }
  };

  // When the driver first shows up (and again once on board), frame the driver and where they're heading.
  const phase = ride?.status === 'in_progress' ? 'to_dropoff' : 'to_pickup';
  useEffect(() => {
    if (!ride || !driverPosition) return;
    const target = phase === 'to_dropoff' ? ride.dropoff : ride.pickup;
    mapRef.current?.fitToCoordinates([driverPosition.location, target], {
      edgePadding: { top: 160, right: 60, bottom: 340, left: 60 },
      animated: true,
    });
    // Not on every position update: the passenger may be panning the map.
  }, [rideId, phase, hasDriverPosition]);

  const onRegionChangeComplete = (region: Region) => {
    centerRef.current = { latitude: region.latitude, longitude: region.longitude };
    // Only matters before booking; the hook snaps it to ~100 m so small pans don't refetch.
    if (!ride) setLookingAt(centerRef.current);
  };

  const choosing = step === 'pickup' || step === 'dropoff';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={MAP_PROVIDER}
        initialRegion={{ ...CITY_CENTERS.LHE, ...DELTA }}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={locationGranted}
        showsMyLocationButton={locationGranted && step === 'home'}
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      >
        {ride ? (
          <>
            <Marker coordinate={ride.pickup} title={t('ride.pickup')} pinColor={colors.pickupPin} tracksViewChanges={false} />
            <Marker coordinate={ride.dropoff} title={t('ride.dropoff')} pinColor={colors.dropoffPin} tracksViewChanges={false} />
            {driverPosition ? (
              <VehicleMarker
                location={driverPosition.location}
                heading={driverPosition.heading}
                vehicleType={ride.vehicleType}
                zIndex={10}
              />
            ) : null}
          </>
        ) : null}
        {!ride
          ? nearby?.map((d) => (
              <VehicleMarker key={d.key} location={d.location} heading={d.heading} vehicleType={d.vehicleType} zIndex={1} />
            ))
          : null}
        {!ride && pickup && step !== 'home' && step !== 'pickup' ? (
          <Marker coordinate={pickup} title={t('ride.pickup')} pinColor={colors.pickupPin} tracksViewChanges={false} />
        ) : null}
        {dropoff && step === 'quote' ? (
          <Marker coordinate={dropoff} title={t('ride.dropoff')} pinColor={colors.dropoffPin} tracksViewChanges={false} />
        ) : null}
      </MapView>

      {/* Fixed pin in the middle of the map: the passenger moves the map under it. */}
      {choosing ? (
        <View style={styles.pinWrap} pointerEvents="none">
          <Text style={step === 'pickup' ? styles.dot : styles.pin}>{step === 'pickup' ? '🟢' : '📍'}</Text>
        </View>
      ) : null}

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        {step === 'home' ? (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.brand}>ApniRide</Text>
              <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={touch.hitSlop}>
                <Text style={styles.signOut}>{t('auth.signOut')}</Text>
              </Pressable>
            </View>
            {name ? <Text style={styles.greeting}>{t('auth.greeting', { name })}</Text> : null}
            <Text style={styles.tagline}>{t('tagline')}</Text>
            {/* No switching to driver mode while a ride is on (the server refuses too). */}
            <ModeSwitch blocked={!!ride} />
            <ServerStatus />
          </View>
        ) : (
          <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" hitSlop={touch.hitSlop}>
            <Text style={styles.backText}>← {t('ride.back')}</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        {ride ? (
          <RideStatusSheet ride={ride} driverPosition={driverPosition ?? null} />
        ) : step === 'home' ? (
          <Pressable style={styles.primary} onPress={startBooking} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('whereTo')}</Text>
          </Pressable>
        ) : choosing ? (
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t(step === 'pickup' ? 'ride.setPickup' : 'ride.setDropoff')}</Text>
            <Pressable style={styles.primary} onPress={confirmPin} accessibilityRole="button">
              <Text style={styles.primaryText}>
                {t(step === 'pickup' ? 'ride.confirmPickup' : 'ride.confirmDropoff')}
              </Text>
            </Pressable>
          </View>
        ) : pickup && dropoff ? (
          <FareSheet pickup={pickup} dropoff={dropoff} onChangeDestination={() => setStep('dropoff')} />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: space[3] },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: space[4] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[3], elevation: elevation.low },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: fontSize.brand, fontWeight: fontWeight.bold, color: colors.brand },
  signOut: { fontSize: fontSize.sm, color: colors.muted },
  greeting: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, marginTop: space[1] },
  tagline: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: space[0.5] },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space[2],
    paddingHorizontal: space[3.5],
    elevation: elevation.low,
  },
  backText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  // The emoji's tip sits on the exact map centre.
  pinWrap: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  pin: { fontSize: iconSize.xl, marginBottom: iconSize.xl },
  dot: { fontSize: iconSize.md },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space[4], elevation: elevation.medium },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: space[3], textAlign: 'center' },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: space[4],
    alignItems: 'center',
    elevation: elevation.low,
  },
  primaryText: { color: colors.brandText, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
});
