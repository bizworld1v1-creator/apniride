import { createApiClient } from '@apniride/shared';
import Constants from 'expo-constants';

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

export const api = createApiClient({ baseUrl: API_URL });
