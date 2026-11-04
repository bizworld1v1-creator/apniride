import { type DriverPosition, type Ride, type RideOffer, SOCKET_EVENTS } from '@apniride/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Vibration } from 'react-native';
import { CURRENT_KEY, type DriverCurrent, patchCurrent, PROFILE_KEY, setOffer, setOwnEta } from '@/lib/driver';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { disconnectSocket, getSocket } from '@/lib/socket';

/** Keeps the socket connected while signed in and feeds offers / ride updates into the query cache. */
export function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onOffer = (offer: RideOffer) => {
      setOffer(queryClient, offer);
      // Get the driver's attention even if the phone is on the dashboard.
      Vibration.vibrate([0, 400, 200, 400]);
    };
    const onOfferCancelled = ({ rideId }: { rideId: string }) => {
      const current = queryClient.getQueryData<DriverCurrent>(CURRENT_KEY);
      if (current?.offer?.rideId === rideId) patchCurrent(queryClient, { offer: null });
    };
    const onRideUpdate = (ride: Ride) => {
      // Back to "searching" means this driver is no longer on it (they cancelled).
      patchCurrent(queryClient, { ride: ride.status === 'searching' ? null : ride });
      if (ride.status === 'cancelled') Vibration.vibrate(400);
    };
    const onEta = (position: DriverPosition) => setOwnEta(queryClient, position);
    // Approved / rejected / suspended by an admin: refresh the home screen at once.
    const onReviewed = () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });
      Vibration.vibrate(400);
    };
    const onConnect = () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });
    };

    socket.on(SOCKET_EVENTS.rideOffer, onOffer);
    socket.on(SOCKET_EVENTS.rideOfferCancelled, onOfferCancelled);
    socket.on(SOCKET_EVENTS.rideUpdate, onRideUpdate);
    socket.on(SOCKET_EVENTS.driverReviewed, onReviewed);
    socket.on(SOCKET_EVENTS.rideDriverLocation, onEta);
    socket.on('connect', onConnect);
    socket.connect();
    return () => {
      socket.off(SOCKET_EVENTS.rideOffer, onOffer);
      socket.off(SOCKET_EVENTS.rideOfferCancelled, onOfferCancelled);
      socket.off(SOCKET_EVENTS.rideUpdate, onRideUpdate);
      socket.off(SOCKET_EVENTS.driverReviewed, onReviewed);
      socket.off(SOCKET_EVENTS.rideDriverLocation, onEta);
      socket.off('connect', onConnect);
      disconnectSocket();
    };
  }, [queryClient]);

  return null;
}
