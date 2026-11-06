import type { LatLng } from '@apniride/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// ~11 m: tiny map nudges reuse the cached quote instead of hitting the network again.
const round = (p: LatLng) => [Math.round(p.latitude * 1e4) / 1e4, Math.round(p.longitude * 1e4) / 1e4];

/** Fixed fares for both vehicle types between two points (cached for 8 minutes). */
export function useFareEstimate(pickup: LatLng, dropoff: LatLng) {
  return useQuery({
    queryKey: ['fare', ...round(pickup), ...round(dropoff)],
    queryFn: () => api.fares.estimate({ pickup, dropoff }),
    // A quote is valid for 10 minutes on the server; refresh a bit before that.
    staleTime: 8 * 60_000,
    retry: false,
  });
}

/** 6850 → "6,850" (the text around it, "Rs …" / "… روپے", comes from i18n `ride.fare`). */
export function formatRupees(amount: number) {
  return amount.toLocaleString('en-PK');
}
