import { type DriverLocationUpdate, type LatLng, SOCKET_EVENTS } from '@apniride/shared';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { getSocket } from './socket';

/**
 * Throttled to save battery and mobile data on low-end phones: an update at most every 5 s and
 * only after moving 25 m. TODO: background task (Location.startLocationUpdatesAsync) in a dev build.
 */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 5_000,
  distanceInterval: 25,
};

/** The server drops drivers it hasn't heard from in 90 s, so a parked driver re-sends every 30 s. */
const HEARTBEAT_MS = 30_000;

/**
 * While `active` (online, or on a ride), sends the driver's position over the socket and calls onMove
 * for the map. During a ride the server forwards it to that ride's passenger for live tracking.
 */
export function useLocationSharing(active: boolean, onMove: (p: LatLng) => void) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!active) return;
    const socket = getSocket();
    let last: DriverLocationUpdate | null = null;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    const send = () => {
      if (last && socket.connected) socket.emit(SOCKET_EVENTS.driverLocation, last);
    };

    void Location.watchPositionAsync(WATCH_OPTIONS, (loc) => {
      // Android reports -1 / null when the heading is unknown (e.g. standing still).
      const h = loc.coords.heading;
      const heading = h !== null && h >= 0 && h <= 360 ? h : null;
      last = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, heading };
      send();
      onMoveRef.current(last);
    })
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => undefined);

    const heartbeat = setInterval(send, HEARTBEAT_MS);
    // Right after a reconnect, tell the server where we are.
    socket.on('connect', send);

    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(heartbeat);
      socket.off('connect', send);
    };
  }, [active]);
}
