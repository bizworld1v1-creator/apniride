import { isActiveRide, type Ride } from '@apniride/shared';
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
