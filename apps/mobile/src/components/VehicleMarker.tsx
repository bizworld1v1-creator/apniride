import { type LatLng, type MarkerState, planMarkerMove, type VehicleType } from '@apniride/shared';
import { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { type MapMarker, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/map-provider';

// Top-down images, front pointing up. Drawn in design/vehicles/*.svg (pnpm render:vehicles).
const IMAGES = {
  car: require('../../assets/vehicles/car.png'),
  bike: require('../../assets/vehicles/bike.png'),
} as const;
const SIZES: Record<VehicleType, { width: number; height: number }> = {
  car: { width: 32, height: 56 },
  bike: { width: 24, height: 48 },
};

/**
 * Google Maps (Android, and iPhone builds with a key) rotates image markers natively: cheapest.
 * Apple Maps can't, so there the marker is a small view with a rotated image.
 */
const NATIVE_ROTATION = MAP_PROVIDER === PROVIDER_GOOGLE;

/**
 * A car or bike on the map that glides to each new position and turns to face where it's going.
 * The glide is done by the map itself (animateMarkerToCoordinate): no JavaScript runs per frame, so it stays
 * smooth on cheap phones. A GPS jump or a long gap moves the marker at once instead (see planMarkerMove).
 */
export const VehicleMarker = memo(function VehicleMarker({
  location,
  heading,
  vehicleType,
  zIndex = 10,
  maxGlideMs,
}: {
  location: LatLng;
  heading: number | null | undefined;
  vehicleType: VehicleType;
  zIndex?: number;
  /** Shorter glides for the driver's own marker, which the camera follows in real time. */
  maxGlideMs?: number;
}) {
  const ref = useRef<MapMarker>(null);
  const state = useRef<MarkerState | null>(null);
  // The coordinate prop only changes on a jump; glides are native commands. Changing it would cut a glide short.
  const [coordinate, setCoordinate] = useState(location);
  const [rotation, setRotation] = useState(heading ?? 0);

  useEffect(() => {
    const now = Date.now();
    const move = planMarkerMove(state.current, { location, heading }, now);
    if (move.kind === 'glide') {
      ref.current?.animateMarkerToCoordinate(location, Math.min(move.durationMs, maxGlideMs ?? Infinity));
    }
    if (move.kind === 'jump') {
      // The prop alone wouldn't move it if it already holds this value (an earlier jump to the same spot).
      if (state.current) ref.current?.animateMarkerToCoordinate(location, 1);
      setCoordinate(location);
    }
    if (move.kind !== 'stay' || !state.current) state.current = { location, heading: move.heading, at: now };
    else state.current = { ...state.current, heading: move.heading, at: now };
    // Whole degrees: tiny compass jitter shouldn't re-render the marker.
    setRotation(Math.round(move.heading));
  }, [location.latitude, location.longitude, heading]);

  const size = SIZES[vehicleType];
  if (NATIVE_ROTATION) {
    return (
      <Marker
        ref={ref}
        coordinate={coordinate}
        image={IMAGES[vehicleType]}
        rotation={rotation}
        flat
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        zIndex={zIndex}
      />
    );
  }
  return (
    <Marker ref={ref} coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={zIndex}>
      <Image
        source={IMAGES[vehicleType]}
        style={[size, styles.image, { transform: [{ rotate: `${rotation}deg` }] }]}
        fadeDuration={0}
      />
    </Marker>
  );
});

const styles = StyleSheet.create({ image: { resizeMode: 'contain' } });
