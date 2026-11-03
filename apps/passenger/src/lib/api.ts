import { createApiClient } from '@apniride/shared';
import Constants from 'expo-constants';
import { useAuth } from './auth-store';

/**
 * Backend URL.
 * 1. EXPO_PUBLIC_API_URL if set (e.g. staging/production builds).
 * 2. In development: the same computer that runs the Expo dev server, port 3000
 *    (works when the phone and PC are on the same Wi-Fi).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devHost ? `http://${devHost}:3000` : 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();

/** Which app this is – sent when signing in. */
export const APP_ROLE = 'passenger' as const;

export const api = createApiClient({
  baseUrl: API_URL,
  // The client refreshes expired access tokens by itself and calls clear() if the session is gone.
  tokens: {
    getAccessToken: () => useAuth.getState().accessToken,
    getRefreshToken: () => useAuth.getState().refreshToken,
    setTokens: (tokens) => useAuth.getState().setTokens(tokens),
    clear: () => useAuth.getState().clear(),
  },
});

/** Revokes the session on the server (best effort, works offline) and forgets it on this phone. */
export async function signOut() {
  await api.auth.logout();
  await useAuth.getState().clear();
}
