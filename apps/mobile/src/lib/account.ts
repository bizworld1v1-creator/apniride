import type { AppMode, RideHistoryItem, RideHistoryPage, User } from '@apniride/shared';
import { type InfiniteData, type QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ImageSourcePropType } from 'react-native';
import { api, API_URL } from './api';
import { useAuth } from './auth-store';

// Saved places -------------------------------------------------------------

export const PLACES_KEY = ['places'] as const;

/** Rarely change, so keep them for 5 minutes (also offline, from the cache). */
export function usePlaces(enabled = true) {
  return useQuery({
    queryKey: PLACES_KEY,
    queryFn: api.me.places.list,
    select: (d) => d.places,
    staleTime: 5 * 60_000,
    enabled,
  });
}


// Ride history -------------------------------------------------------------

export const historyKey = (mode: AppMode) => ['history', mode] as const;

/** Finished rides of the current mode, 20 at a time (load more at the end of the list). */
export function useHistory(mode: AppMode) {
  return useInfiniteQuery({
    queryKey: historyKey(mode),
    queryFn: ({ pageParam }) => (mode === 'driver' ? api.driver.history(pageParam) : api.rides.history(pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });
}

/** A ride already loaded in the history list (the detail screen doesn't download it again). */
export function findHistoryItem(queryClient: QueryClient, mode: AppMode, id: string): RideHistoryItem | undefined {
  const data = queryClient.getQueryData<InfiniteData<RideHistoryPage>>(historyKey(mode));
  return data?.pages.flatMap((p) => p.rides).find((r) => r.id === id);
}

export const EARNINGS_KEY = ['driver', 'earnings'] as const;

export function useEarnings() {
  return useQuery({ queryKey: EARNINGS_KEY, queryFn: api.driver.earnings, staleTime: 60_000 });
}

// Profile photo ------------------------------------------------------------

/**
 * The private profile photo as an <Image> source (sent with the access token). `v` changes when the photo does,
 * so the phone can keep it cached. null if there is no photo.
 */
export function photoSource(user: User | null): ImageSourcePropType | null {
  if (!user?.photoUpdatedAt) return null;
  const token = useAuth.getState().accessToken;
  return {
    uri: `${API_URL}${api.me.photoPath}?v=${encodeURIComponent(user.photoUpdatedAt)}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}
