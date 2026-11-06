import '@/i18n';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fontAssets } from '@/lib/fonts';
import { loadLanguage } from '@/lib/language';
import { useMode } from '@/lib/mode';

// Keep the splash screen up until we know whether the user is signed in (no flash of the sign-in screen).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The API client already retries GETs with backoff; keep React Query light.
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  const status = useAuth((s) => s.status);
  const hasName = useAuth((s) => !!s.user?.name);
  const mode = useMode();
  // Bundled font files (no download). On an error we carry on with the system font rather than block the app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    // Saved language first (still behind the splash screen), so no English flash for Urdu users.
    void loadLanguage().finally(() => useAuth.getState().hydrate());
  }, []);

  useEffect(() => {
    if (status === 'loading' || !fontsReady) return;
    SplashScreen.hide();
    if (status === 'signedIn') {
      // Refresh the cached profile in the background; offline is fine, we keep the cached one.
      api.me
        .get()
        .then((user) => useAuth.getState().setUser(user))
        .catch(() => undefined);
    } else {
      queryClient.clear();
    }
  }, [status, queryClient, fontsReady]);

  if (status === 'loading' || !fontsReady) return null;

  const signedIn = status === 'signedIn';

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {signedIn ? <RealtimeBridge mode={mode} /> : null}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn && hasName}>
            <Stack.Screen name="index" />
            {/* Side menu screens (both modes; saved places are only linked in passenger mode). */}
            <Stack.Screen name="history/index" />
            <Stack.Screen name="history/[id]" />
            <Stack.Screen name="places/index" />
            <Stack.Screen name="places/pick" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="settings" />
            {/* Development only: the new design's components (linked from Settings in dev). */}
            <Stack.Screen name="ui-preview" />
          </Stack.Protected>
          {/* Driver registration: only reachable in driver mode. */}
          <Stack.Protected guard={signedIn && hasName && mode === 'driver'}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="onboarding-details" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !hasName}>
            <Stack.Screen name="complete-profile" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="verify" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
