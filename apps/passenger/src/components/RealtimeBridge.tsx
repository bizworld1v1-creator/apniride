import { type DriverPosition, type Ride, SOCKET_EVENTS } from '@apniride/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setDriverPosition } from '@/lib/driver-position';
import { setCurrentRide } from '@/lib/ride';
import { disconnectSocket, getSocket } from '@/lib/socket';

/** Keeps the socket connected while signed in and feeds server events into the query cache. */
export function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const onRideUpdate = (ride: Ride) => setCurrentRide(queryClient, ride);
    const onDriverLocation = (p: DriverPosition) => setDriverPosition(queryClient, p);
    // After any (re)connect, catch up on what we may have missed while offline (ride + driver position).
    const onConnect = () => void queryClient.invalidateQueries({ queryKey: ['ride'] });

    socket.on(SOCKET_EVENTS.rideUpdate, onRideUpdate);
    socket.on(SOCKET_EVENTS.rideDriverLocation, onDriverLocation);
    socket.on('connect', onConnect);
    socket.connect();
    return () => {
      socket.off(SOCKET_EVENTS.rideUpdate, onRideUpdate);
      socket.off(SOCKET_EVENTS.rideDriverLocation, onDriverLocation);
      socket.off('connect', onConnect);
      disconnectSocket();
    };
  }, [queryClient]);

  return null;
}
