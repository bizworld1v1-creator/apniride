import { type Bid, isActiveRide, type Ride, type RideBids } from '@apniride/shared';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const CURRENT_RIDE_KEY = ['ride', 'current'] as const;

/**
 * The ride shown on the home screen: the active one, or the one that just ended
 * (completed / cancelled / no driver) until the passenger taps "Done".
 */
export function useCurrentRide() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: CURRENT_RIDE_KEY,
    queryFn: () => fetchCurrentRide(queryClient),
    // Socket events keep this fresh; refetch only on reconnect / app start.
    staleTime: Infinity,
  });
}

async function fetchCurrentRide(queryClient: QueryClient): Promise<Ride | null> {
  const active = await api.rides.current();
  if (active) return active;
  const shown = queryClient.getQueryData<Ride | null>(CURRENT_RIDE_KEY);
  // We were showing an active ride and missed how it ended (offline): fetch its final state.
  if (shown && isActiveRide(shown.status)) return api.rides.get(shown.id);
  // Keep a finished ride on screen until it's dismissed.
  return shown ?? null;
}

export function setCurrentRide(queryClient: QueryClient, ride: Ride | null) {
  queryClient.setQueryData(CURRENT_RIDE_KEY, ride);
}

// Bids (inDrive-style offers from drivers) ------------------------------------------------

/** A driver's bid plus the moment this phone received it (its countdown runs from here). */
export type ReceivedBid = Bid & { receivedAt: number };

const bidsKey = (rideId: string) => ['ride', rideId, 'bids'] as const;

const withReceivedAt = (data: RideBids, previous: ReceivedBid[] | undefined): ReceivedBid[] => {
  const now = Date.now();
  // Keep the original countdown of bids we already show.
  const known = new Map((previous ?? []).map((b) => [b.bidId, b]));
  return data.bids.map((b) => known.get(b.bidId) ?? { ...b, receivedAt: now });
};

/** Drivers' open bids while the ride is searching. Pushed by the server as `ride:bids`; fetched after (re)connect. */
export function useBids(ride: Ride | null | undefined) {
  const queryClient = useQueryClient();
  const rideId = ride?.status === 'searching' ? ride.id : null;
  return useQuery({
    queryKey: bidsKey(rideId ?? 'none'),
    queryFn: async () =>
      withReceivedAt(await api.rides.bids(rideId!), queryClient.getQueryData<ReceivedBid[]>(bidsKey(rideId!))),
    enabled: !!rideId,
    staleTime: Infinity,
  });
}

export function setBids(queryClient: QueryClient, data: RideBids) {
  queryClient.setQueryData<ReceivedBid[]>(bidsKey(data.rideId), (old) => withReceivedAt(data, old));
}

export function secondsLeftOf(bid: ReceivedBid, now: number) {
  return Math.max(0, Math.ceil((bid.receivedAt + bid.expiresInSeconds * 1000 - now) / 1000));
}
