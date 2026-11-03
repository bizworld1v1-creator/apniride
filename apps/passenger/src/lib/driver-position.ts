import type { DriverPosition, Ride } from '@apniride/shared';
import { type QueryClient, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './api';

/** A position plus when this phone got it (ages are relative to that: phone clocks can be wrong). */
export type ReceivedPosition = DriverPosition & { receivedAt: number };

const key = (rideId: string) => ['ride', rideId, 'driverPosition'] as const;

const tracked = (ride: Ride | null | undefined) =>
  !!ride?.driver && (ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in_progress');

/** Where the driver is. Live updates arrive over the socket; this fetches the last one after (re)connecting. */
export function useDriverPosition(ride: Ride | null | undefined) {
  const enabled = tracked(ride);
  return useQuery({
    queryKey: key(ride?.id ?? 'none'),
    queryFn: async (): Promise<ReceivedPosition | null> => {
      const p = await api.rides.driverPosition(ride!.id);
      return p ? { ...p, receivedAt: Date.now() - p.ageSeconds * 1000 } : null;
    },
    enabled,
    staleTime: Infinity,
    select: (p) => (enabled ? p : null),
  });
}

export function setDriverPosition(queryClient: QueryClient, p: DriverPosition) {
  const value: ReceivedPosition = { ...p, receivedAt: Date.now() };
  queryClient.setQueryData(key(p.rideId), value);
}

/** Seconds since this position was received, re-checked every 15 s (cheap; only for the "last updated" hint). */
export function useAgeSeconds(p: ReceivedPosition | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!p) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [p]);
  return p ? Math.max(0, Math.round((now - p.receivedAt) / 1000)) : 0;
}
