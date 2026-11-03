import type { VehicleType } from '@apniride/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { ReceivedPosition } from '@/lib/driver-position';

const ICONS: Record<VehicleType, string> = { bike: '🏍️', car: '🚗' };

/**
 * The driver on the map. It jumps to each new position (every ~5 s) without animation: smooth
 * animation costs CPU and battery on low-end phones, and a jump every few seconds is easy to follow.
 */
export function DriverMarker({ position, vehicleType }: { position: ReceivedPosition; vehicleType: VehicleType }) {
  // Android draws custom marker views once; let it redraw briefly after mount, then freeze for performance.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={position.location}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={10}
    >
      <View style={styles.badge}>
        <Text style={styles.icon}>{ICONS[vehicleType]}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#0E7490',
  },
  icon: { fontSize: 22 },
});
