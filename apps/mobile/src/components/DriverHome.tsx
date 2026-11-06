import { CITY_CENTERS, type DriverLocationUpdate, type LatLng } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveRideSheet } from '@/components/driver/ActiveRideSheet';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { RequestSheet } from '@/components/driver/RequestSheet';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { SosButton } from '@/components/SosButton';
import { SideMenu } from '@/components/SideMenu';
import { VehicleMarker } from '@/components/VehicleMarker';
import { api } from '@/lib/api';
import { PROFILE_KEY, useDriverCurrent, useDriverProfile } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { colors, space } from '@/lib/theme';
import { useLocationSharing } from '@/lib/use-location-sharing';

const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
/** Pickup + drop-off framed inside the small map card (an offer) or above the ride sheet (a ride). */
const CARD_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const RIDE_PADDING = { top: 140, right: 60, bottom: 380, left: 60 };

type Frame = { x: number; y: number; width: number; height: number };

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

/**
 * Driver mode (new design, group 4): dashboard with earnings, the online card and a map card; the incoming request
 * slides up over it; during a ride the map is full screen with the ride sheet. One map stays mounted throughout.
 */
export function DriverHome() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const screenRef = useRef<ComponentRef<typeof View>>(null);
  const slotRef = useRef<ComponentRef<typeof View>>(null);
  const [slot, setSlot] = useState<Frame | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useDriverProfile();
  const { data: current } = useDriverCurrent();

  const online = profile.data?.online ?? false;
  const offer = current?.offer ?? null;
  const ride = current?.ride ?? null;
  const onRide = !!ride && (ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in_progress');
  const p = profile.data;
  const approved = p?.approvalStatus === 'approved';
  // A ride (also a just-finished one) takes the whole screen; otherwise the dashboard with the map card.
  const dashboard = !ride;

  const toggle = useMutation({
    mutationFn: async () =>
      online ? api.driver.goOffline() : api.driver.goOnline({ location: await currentPosition() }),
    onSuccess: (profileData) => queryClient.setQueryData(PROFILE_KEY, profileData),
  });

  // The driver's own car / bike on the map (instead of the blue dot), turning with the road. While an offer is on
  // screen the map stays framed on its pickup and drop-off instead of following the driver.
  const [me, setMe] = useState<DriverLocationUpdate | null>(null);
  const framing = useRef(false);
  framing.current = !!offer;
  const follow = useCallback((pos: DriverLocationUpdate) => {
    setMe(pos);
    if (!framing.current) mapRef.current?.animateCamera({ center: pos }, { duration: 400 });
  }, []);
  // Keep sharing during a ride even if the driver went offline: the passenger is tracking them.
  useLocationSharing(online || onRide, follow);

  // Show the whole trip when an offer or ride appears.
  const focusId = offer?.rideId ?? ride?.id;
  useEffect(() => {
    const target = offer ?? ride;
    if (!target) return;
    mapRef.current?.fitToCoordinates([target.pickup, target.dropoff], {
      edgePadding: offer && !ride ? CARD_PADDING : RIDE_PADDING,
      animated: true,
    });
    // Only when a different offer/ride appears, not on every status change.
  }, [focusId]);

  const measureSlot = () => {
    const node = slotRef.current;
    const screen = screenRef.current;
    if (!node || !screen) return;
    node.measureLayout(screen, (x, y, width, height) => setSlot({ x, y, width, height }));
  };

  const shown = offer ?? ride;
  const toggleError =
    toggle.error instanceof LocationDeniedError ? t('driver.locationDenied') : toggle.error ? errorMessage(t, toggle.error) : null;

  const mapFrame: ViewStyle = dashboard
    ? slot
      ? { position: 'absolute', left: slot.x, top: slot.y, width: slot.width, height: slot.height }
      : styles.hidden
    : StyleSheet.absoluteFill;

  return (
    <View ref={screenRef} style={styles.screen}>
      <View style={mapFrame} pointerEvents={dashboard ? 'none' : 'auto'}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          initialRegion={{ ...CITY_CENTERS.LHE, ...DELTA }}
          // Our vehicle marker replaces the blue dot once we know the vehicle and have a position.
          showsUserLocation={(online || onRide) && !(me && p?.vehicleType)}
          scrollEnabled={!dashboard}
          zoomEnabled={!dashboard}
          rotateEnabled={false}
          pitchEnabled={false}
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
      </View>

      {dashboard ? (
        profile.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <DriverDashboard
            mapSlotRef={slotRef}
            onMapSlotLayout={measureSlot}
            onOpenMenu={() => setMenuOpen(true)}
            approved={approved}
            online={online}
            toggling={toggle.isPending}
            onToggle={() => toggle.mutate()}
            toggleError={toggleError}
            statusCard={p && p.approvalStatus !== 'approved' ? <DriverStatusCard status={p.approvalStatus} /> : null}
            busy={online || onRide}
          />
        )
      ) : null}

      {onRide ? (
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <SosButton />
        </SafeAreaView>
      ) : null}

      {ride || (offer && approved) ? (
        <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
          {/* The ride is checked first: a driver suspended mid-ride can still finish it. */}
          {ride ? <ActiveRideSheet ride={ride} /> : offer ? <RequestSheet key={offer.rideId} offer={offer} /> : null}
        </SafeAreaView>
      ) : null}

      {/* Go offline (and finish the ride) before switching mode or signing out, so a driver never vanishes from
          dispatch by accident. */}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} busy={online || onRide} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Before the dashboard has measured the card: keep the map mounted but out of sight.
  hidden: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: space[4], paddingTop: space[2], alignItems: 'flex-end' },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: space[3] },
});
