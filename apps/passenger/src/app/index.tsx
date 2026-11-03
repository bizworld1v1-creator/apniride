import { CITY_CENTERS } from '@apniride/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ServerStatus } from '@/components/ServerStatus';
import { signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

const DELTA = { latitudeDelta: 0.03, longitudeDelta: 0.03 };

export default function HomeScreen() {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const name = useAuth((s) => s.user?.name);

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
      mapRef.current?.animateToRegion(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude, ...DELTA },
        500,
      );
    })().catch(() => {
      // No location (GPS off, denied, timeout): stay on the city centre.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...CITY_CENTERS.LHE, ...DELTA }}
        showsUserLocation={locationGranted}
        showsMyLocationButton={locationGranted}
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      />

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>ApniRide</Text>
            <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.signOut}>{t('auth.signOut')}</Text>
            </Pressable>
          </View>
          {name ? <Text style={styles.greeting}>{t('auth.greeting', { name })}</Text> : null}
          <Text style={styles.tagline}>{t('tagline')}</Text>
          <ServerStatus />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        <Pressable style={styles.whereTo} accessibilityRole="button">
          <Text style={styles.whereToText}>{t('whereTo')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: 12 },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 20, fontWeight: '700', color: '#0E7490' },
  signOut: { fontSize: 13, color: '#6B7280' },
  greeting: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 4 },
  tagline: { fontSize: 13, color: '#374151', marginTop: 2 },
  whereTo: {
    backgroundColor: '#0E7490',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
  },
  whereToText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
