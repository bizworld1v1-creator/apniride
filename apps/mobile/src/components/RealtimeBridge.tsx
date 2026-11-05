import { type AppMode, type DriverPosition, type Ride, type RideOffer, SOCKET_EVENTS } from '@apniride/shared';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Vibration } from 'react-native';
import type { Socket } from 'socket.io-client';
import { EARNINGS_KEY, historyKey } from '@/lib/account';
import { CURRENT_KEY, type DriverCurrent, patchCurrent, PROFILE_KEY, setOffer, setOwnEta } from '@/lib/driver';
import { setDriverPosition } from '@/lib/driver-position';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { setCurrentRide } from '@/lib/ride';
import { disconnectSocket, getSocket } from '@/lib/socket';

type Handlers = Record<string, (payload: never) => void>;

const FINISHED = new Set<Ride['status']>(['completed', 'cancelled', 'no_driver']);

/** Passenger mode: their ride and the driver's position. */
function passengerHandlers(queryClient: QueryClient): Handlers {
  return {
    [SOCKET_EVENTS.rideUpdate]: (ride: Ride) => {
      setCurrentRide(queryClient, ride);
      // A finished ride belongs in the history list now.
      if (FINISHED.has(ride.status)) void queryClient.invalidateQueries({ queryKey: historyKey('passenger') });
    },
    [SOCKET_EVENTS.rideDriverLocation]: (p: DriverPosition) => setDriverPosition(queryClient, p),
    // After any (re)connect, catch up on what we may have missed while offline (ride + driver position).
    connect: () => void queryClient.invalidateQueries({ queryKey: ['ride'] }),
  };
}

/** Driver mode: offers, the ride they are on, their own ETA, and the admin's review. */
function driverHandlers(queryClient: QueryClient): Handlers {
  return {
    [SOCKET_EVENTS.rideOffer]: (offer: RideOffer) => {
      setOffer(queryClient, offer);
      // Get the driver's attention even if the phone is on the dashboard.
      Vibration.vibrate([0, 400, 200, 400]);
    },
    [SOCKET_EVENTS.rideOfferCancelled]: ({ rideId }: { rideId: string }) => {
      const current = queryClient.getQueryData<DriverCurrent>(CURRENT_KEY);
      if (current?.offer?.rideId === rideId) patchCurrent(queryClient, { offer: null });
    },
    [SOCKET_EVENTS.rideUpdate]: (ride: Ride) => {
      // Back to "searching" means this driver is no longer on it (they cancelled).
      patchCurrent(queryClient, { ride: ride.status === 'searching' ? null : ride });
      if (ride.status === 'cancelled') Vibration.vibrate(400);
      if (FINISHED.has(ride.status)) {
        void queryClient.invalidateQueries({ queryKey: historyKey('driver') });
        void queryClient.invalidateQueries({ queryKey: EARNINGS_KEY });
      }
    },
    [SOCKET_EVENTS.rideDriverLocation]: (position: DriverPosition) => setOwnEta(queryClient, position),
    // Approved / rejected / suspended by an admin: refresh the home screen at once.
    [SOCKET_EVENTS.driverReviewed]: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });
      Vibration.vibrate(400);
    },
    connect: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });
    },
  };
}

function attach(socket: Socket, handlers: Handlers): () => void {
  const entries = Object.entries(handlers) as [string, (...args: unknown[]) => void][];
  for (const [event, fn] of entries) socket.on(event, fn);
  return () => {
    for (const [event, fn] of entries) socket.off(event, fn);
  };
}

/**
 * Keeps the socket connected while signed in and feeds server events into the query cache.
 * Switching mode reconnects with the new session's token (the server puts the socket in that mode's room).
 */
export function RealtimeBridge({ mode }: { mode: AppMode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const detach = attach(socket, mode === 'driver' ? driverHandlers(queryClient) : passengerHandlers(queryClient));
    socket.connect();
    return () => {
      detach();
      disconnectSocket();
    };
  }, [queryClient, mode]);

  return null;
}
