import { type DriverCurrentResponse, type DriverPosition, isActiveRide, type Ride, type RideOffer } from '@apniride/shared';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const PROFILE_KEY = ['driver', 'profile'] as const;
export const CURRENT_KEY = ['driver', 'current'] as const;
const etaKey = (rideId: string) => ['driver', 'eta', rideId] as const;

/** ETA + distance to the pickup (or the destination once on board). Pushed by the server after each location. */
export function useOwnEta(rideId: string | undefined) {
  return useQuery<DriverPosition | null>({
    queryKey: etaKey(rideId ?? 'none'),
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
}

export function setOwnEta(queryClient: QueryClient, position: DriverPosition) {
  queryClient.setQueryData(etaKey(position.rideId), position);
}

/** An offer plus the moment this phone received it (the countdown runs from here). */
export type ReceivedOffer = RideOffer & { receivedAt: number };

export interface DriverCurrent {
  offer: ReceivedOffer | null;
  /** Active ride, or the one that just ended until the driver taps "Done". */
  ride: Ride | null;
}

export function useDriverProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: api.driver.profile, staleTime: 60_000 });
}

export function useDriverCurrent() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: CURRENT_KEY,
    queryFn: () => fetchCurrent(queryClient),
    // Socket events keep this fresh; refetch only on (re)connect.
    staleTime: Infinity,
  });
}

const withReceivedAt = (offer: RideOffer | null): ReceivedOffer | null =>
  offer ? { ...offer, receivedAt: Date.now() } : null;

async function fetchCurrent(queryClient: QueryClient): Promise<DriverCurrent> {
  const server: DriverCurrentResponse = await api.driver.current();
  const shown = queryClient.getQueryData<DriverCurrent>(CURRENT_KEY);
  // Keep the same offer's original countdown if we already have it.
  const offer =
    shown?.offer && server.offer?.rideId === shown.offer.rideId ? shown.offer : withReceivedAt(server.offer);
  if (server.ride) return { offer, ride: server.ride };

  const previous = shown?.ride;
  if (previous && isActiveRide(previous.status)) {
    // We missed how the ride ended while offline (e.g. passenger cancelled): fetch its final state.
    const ride = await api.rides.get(previous.id).catch(() => null);
    return { offer, ride: ride && ride.status !== 'searching' ? ride : null };
  }
  return { offer, ride: previous ?? null };
}

export function patchCurrent(queryClient: QueryClient, patch: Partial<DriverCurrent>) {
  queryClient.setQueryData<DriverCurrent>(CURRENT_KEY, (old) => ({ offer: null, ride: null, ...old, ...patch }));
}

export function setOffer(queryClient: QueryClient, offer: RideOffer) {
  patchCurrent(queryClient, { offer: withReceivedAt(offer) });
}
