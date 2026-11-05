import type { LatLng } from '@apniride/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from './api';

/** ~110 m: small pans of the map don't start a new request. */
const snap = (n: number) => Math.round(n * 1000) / 1000;

/** True while the app is on screen. Polling stops in the background (battery, mobile data). */
function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Available drivers around a point, refreshed every 10 s while the map is open and no ride is booked.
 * About 1 KB per request; on a weak network a failed poll just keeps the last markers.
 */
export function useNearbyDrivers(center: LatLng | null, enabled: boolean) {
  const active = useAppActive();
  const point = center ? { latitude: snap(center.latitude), longitude: snap(center.longitude) } : null;
  return useQuery({
    queryKey: ['nearbyDrivers', point?.latitude, point?.longitude],
    queryFn: () => api.rides.nearbyDrivers(point!),
    enabled: enabled && active && !!point,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    retry: 0,
    // Keep showing the previous drivers while the next answer (or a new area) loads.
    placeholderData: (previous) => previous,
    select: (d) => d.drivers,
  });
}
