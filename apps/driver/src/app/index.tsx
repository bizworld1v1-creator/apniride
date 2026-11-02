import { CITY_CENTERS } from '@apniride/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ServerStatus } from '@/components/ServerStatus';

const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };

/**
 * Foreground location while online. Throttled to save battery and mobile data on low-end phones:
 * an update at most every 5 s and only after moving 25 m.
 * TODO: switch to a background task (Location.startLocationUpdatesAsync) once we use a dev build.
 */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 5_000,
  distanceInterval: 25,
};

export default function DriverHomeScreen() {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const [online, setOnline] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [position, setPosition] = useState<Location.LocationObjectCoords | null>(null);

  useEffect(() => {
    if (!online) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setPermissionDenied(true);
        setOnline(false);
        return;
      }
      setPermissionDenied(false);
      subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (loc) => {
        setPosition(loc.coords);
        mapRef.current?.animateCamera({ center: loc.coords }, { duration: 400 });
      });
      if (cancelled) subscription.remove();
    })().catch(() => setOnline(false));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [online]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...CITY_CENTERS.LHE, ...DELTA }}
        showsUserLocation={online && position !== null}
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      />

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.brand}>{t('appName')}</Text>
          <Text style={[styles.status, { color: online ? '#16A34A' : '#6B7280' }]}>
            {online ? t('online') : t('offline')}
          </Text>
          {permissionDenied && <Text style={styles.warning}>{t('locationDenied')}</Text>}
          <ServerStatus />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        <Pressable
          style={[styles.toggle, { backgroundColor: online ? '#DC2626' : '#16A34A' }]}
          onPress={() => setOnline((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: online }}
        >
          <Text style={styles.toggleText}>{online ? t('goOffline') : t('goOnline')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: 12 },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 3 },
  brand: { fontSize: 20, fontWeight: '700', color: '#B45309' },
  status: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  warning: { fontSize: 13, color: '#DC2626', marginTop: 4 },
  toggle: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  toggleText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
