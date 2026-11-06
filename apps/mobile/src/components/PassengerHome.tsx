import { CITY_CENTERS, type LatLng, type SavedPlace, type VehicleType } from '@apniride/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View, type ViewStyle } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FareScreen } from '@/components/passenger/FareScreen';
import { HomeDashboard } from '@/components/passenger/HomeDashboard';
import { LiveTripSheet, SosButton } from '@/components/passenger/LiveTripSheet';
import { CenterPin } from '@/components/passenger/MapPin';
import { PlacePickSheet } from '@/components/passenger/PlacePickSheet';
import { RideEndedSheet } from '@/components/passenger/RideEndedSheet';
import { SearchingScreen } from '@/components/passenger/SearchingScreen';
import { TripComplete } from '@/components/passenger/TripComplete';
import { SideMenu } from '@/components/SideMenu';
import { BackButton } from '@/components/ui';
import { VehicleMarker } from '@/components/VehicleMarker';
import { usePlaces } from '@/lib/account';
import { useDriverPosition } from '@/lib/driver-position';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { useNearbyDrivers } from '@/lib/nearby-drivers';
import { setCurrentRide, useCurrentRide } from '@/lib/ride';
import { colors, space } from '@/lib/theme';

const DELTA = { latitudeDelta: 0.03, longitudeDelta: 0.03 };
/** Room for the floating sheet when framing the driver and pickup on the map. */
const TRIP_PADDING = { top: 140, right: 60, bottom: 460, left: 60 };

/** home → (pickup, only without GPS) → dropoff → quote */
type Step = 'home' | 'pickup' | 'dropoff' | 'quote';
type Frame = { x: number; y: number; width: number; height: number };

/**
 * Passenger mode: book a ride and follow it (new design, group 3). One map stays mounted the whole time (low-end
 * phones): it is the rounded card on the dashboard, full screen while picking places and during the trip, and hidden
 * behind the full-page fare / searching / trip-complete screens.
 */
export function PassengerHome() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const screenRef = useRef<ComponentRef<typeof View>>(null);
  const slotRef = useRef<ComponentRef<typeof View>>(null);
  // The map centre lives in a ref: updating it while the user drags must not re-render the screen.
  const centerRef = useRef<LatLng>(CITY_CENTERS.LHE);
  const [slot, setSlot] = useState<Frame | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [gpsPickup, setGpsPickup] = useState<LatLng | null>(null);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [labels, setLabels] = useState({ from: '', to: '' });
  const [vehicle, setVehicle] = useState<VehicleType>('car');
  const [step, setStep] = useState<Step>('home');
  const { data: ride } = useCurrentRide();
  const rideId = ride?.id;
  const { data: driverPosition } = useDriverPosition(ride);
  const hasDriverPosition = !!driverPosition;
  // Where to look for nearby drivers: the area the passenger is looking at (updated when a pan ends).
  const [lookingAt, setLookingAt] = useState<LatLng | null>(null);
  const { data: nearby } = useNearbyDrivers(lookingAt ?? gpsPickup, !ride);
  // Saved places as one-tap destinations (cached, so they show instantly and offline).
  const { data: places } = usePlaces(!ride);

  const onTrip = ride?.status === 'accepted' || ride?.status === 'arrived' || ride?.status === 'in_progress';
  const dashboard = !ride && step === 'home';

  // A booked ride takes over the screen; when it's dismissed, start fresh from the dashboard.
  useEffect(() => {
    if (!rideId || !ride) return;
    setStep('home');
    setDropoff(null);
    mapRef.current?.fitToCoordinates([ride.pickup, ride.dropoff], { edgePadding: TRIP_PADDING, animated: true });
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

  // Back on the dashboard: the map card shows "you are here" again.
  useEffect(() => {
    if (dashboard && gpsPickup) mapRef.current?.animateToRegion({ ...gpsPickup, ...DELTA }, 300);
  }, [dashboard, gpsPickup]);

  const measureSlot = () => {
    const node = slotRef.current;
    const screen = screenRef.current;
    if (!node || !screen) return;
    node.measureLayout(screen, (x, y, width, height) => setSlot({ x, y, width, height }));
  };

  const goBack = () => {
    if (step === 'quote') setStep('dropoff');
    else if (step === 'dropoff') setStep(gpsPickup ? 'home' : 'pickup');
    else if (step === 'pickup') setStep('home');
  };

  // Android back button walks back through the steps instead of leaving the app.
  useEffect(() => {
    if (step === 'home' || ride) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  });

  const pinLabel = t('ride.pinOnMap');

  const goToQuote = (from: LatLng, to: LatLng, fromLabel: string, toLabel: string) => {
    setPickup(from);
    setDropoff(to);
    setLabels({ from: fromLabel, to: toLabel });
    setStep('quote');
  };

  /** "Search destination", or a Ride / Moto tile (which preselects the vehicle). */
  const startBooking = (preferred?: VehicleType) => {
    if (preferred) setVehicle(preferred);
    setDropoff(null);
    if (gpsPickup) {
      setPickup(gpsPickup);
      setLabels({ from: t('ride.yourLocation'), to: '' });
      setStep('dropoff');
    } else {
      setStep('pickup');
    }
  };

  /** A saved place on the dashboard: straight to the fare (or first the pickup, without GPS). */
  const bookToPlace = (place: SavedPlace) => {
    if (gpsPickup) {
      goToQuote(gpsPickup, place.location, t('ride.yourLocation'), place.label);
    } else {
      setDropoff(place.location);
      setLabels({ from: '', to: place.label });
      setStep('pickup');
    }
  };

  const confirmPin = () => {
    const point = { ...centerRef.current };
    if (step === 'pickup') {
      // A saved place was already chosen as the destination: go straight to the fare.
      if (dropoff) goToQuote(point, dropoff, pinLabel, labels.to || pinLabel);
      else {
        setPickup(point);
        setLabels({ from: pinLabel, to: '' });
        setStep('dropoff');
      }
    } else if (step === 'dropoff' && pickup) {
      goToQuote(pickup, point, labels.from || pinLabel, pinLabel);
    }
  };

  const choosePlace = (place: SavedPlace) => {
    if (pickup) goToQuote(pickup, place.location, labels.from || pinLabel, place.label);
  };

  // When the driver first shows up (and again once on board), frame the driver and where they're heading.
  const phase = ride?.status === 'in_progress' ? 'to_dropoff' : 'to_pickup';
  useEffect(() => {
    if (!ride || !driverPosition) return;
    const target = phase === 'to_dropoff' ? ride.dropoff : ride.pickup;
    mapRef.current?.fitToCoordinates([driverPosition.location, target], { edgePadding: TRIP_PADDING, animated: true });
    // Not on every position update: the passenger may be panning the map.
  }, [rideId, phase, hasDriverPosition]);

  const onRegionChangeComplete = (region: Region) => {
    centerRef.current = { latitude: region.latitude, longitude: region.longitude };
    // Only matters before booking; the hook snaps it to ~100 m so small pans don't refetch.
    if (!ride) setLookingAt(centerRef.current);
  };

  const dismissRide = () => setCurrentRide(queryClient, null);
  const choosing = !ride && (step === 'pickup' || step === 'dropoff');
  const fullPage = (!ride && step === 'quote') || ride?.status === 'searching' || ride?.status === 'completed';

  // The one map: a card on the dashboard (once we know where the card is), otherwise the whole screen.
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
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation={locationGranted && !dashboard}
          showsMyLocationButton={false}
          scrollEnabled={!dashboard}
          zoomEnabled={!dashboard}
          rotateEnabled={false}
          pitchEnabled={false}
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
          ) : (
            nearby?.map((d) => (
              <VehicleMarker key={d.key} location={d.location} heading={d.heading} vehicleType={d.vehicleType} zIndex={1} />
            ))
          )}
          {!ride && pickup && step === 'dropoff' ? (
            <Marker coordinate={pickup} title={t('ride.pickup')} pinColor={colors.pickupPin} tracksViewChanges={false} />
          ) : null}
        </MapView>
      </View>

      {dashboard ? (
        <HomeDashboard
          mapSlotRef={slotRef}
          onMapSlotLayout={measureSlot}
          places={places}
          onSearch={startBooking}
          onPlace={bookToPlace}
          onOpenMenu={() => setMenuOpen(true)}
        />
      ) : null}

      {/* Fixed pin in the middle of the map: the passenger moves the map under it. */}
      {choosing ? <CenterPin color={step === 'pickup' ? colors.pickupPin : colors.dropoffPin} /> : null}

      {choosing || onTrip ? (
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          {choosing ? <BackButton onPress={goBack} overMap /> : <View />}
          {onTrip ? <SosButton /> : null}
        </SafeAreaView>
      ) : null}

      {choosing || (ride && !fullPage) ? (
        <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
          {ride && onTrip ? (
            <LiveTripSheet ride={ride} driverPosition={driverPosition ?? null} />
          ) : ride ? (
            <RideEndedSheet ride={ride} onDone={dismissRide} />
          ) : (
            <PlacePickSheet
              step={step === 'pickup' ? 'pickup' : 'dropoff'}
              places={places}
              onPlace={choosePlace}
              onConfirm={confirmPin}
            />
          )}
        </SafeAreaView>
      ) : null}

      {fullPage ? (
        <View style={styles.page}>
          {ride?.status === 'searching' ? (
            <SearchingScreen ride={ride} fromLabel={labels.from || t('ride.pickup')} toLabel={labels.to || t('ride.dropoff')} />
          ) : ride?.status === 'completed' ? (
            <TripComplete ride={ride} onDone={dismissRide} />
          ) : pickup && dropoff ? (
            <FareScreen
              pickup={pickup}
              dropoff={dropoff}
              fromLabel={labels.from || pinLabel}
              toLabel={labels.to || pinLabel}
              initialVehicle={vehicle}
              onBack={goBack}
            />
          ) : null}
        </View>
      ) : null}

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} busy={!!ride} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Before the dashboard has measured the card: keep the map mounted but out of sight.
  hidden: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0 },
  top: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: space[3] },
  page: { ...StyleSheet.absoluteFill, backgroundColor: colors.background },
});
