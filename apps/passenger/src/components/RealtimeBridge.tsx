import { type Ride, SOCKET_EVENTS } from '@apniride/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { CURRENT_RIDE_KEY, setCurrentRide } from '@/lib/ride';
import { disconnectSocket, getSocket } from '@/lib/socket';

/** Keeps the socket connected while signed in and feeds server events into the query cache. */
export function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const onRideUpdate = (ride: Ride) => setCurrentRide(queryClient, ride);
    // After any (re)connect, catch up on what we may have missed while offline.
    const onConnect = () => void queryClient.invalidateQueries({ queryKey: CURRENT_RIDE_KEY });

    socket.on(SOCKET_EVENTS.rideUpdate, onRideUpdate);
    socket.on('connect', onConnect);
    socket.connect();
    return () => {
      socket.off(SOCKET_EVENTS.rideUpdate, onRideUpdate);
      socket.off('connect', onConnect);
      disconnectSocket();
    };
  }, [queryClient]);

  return null;
}
