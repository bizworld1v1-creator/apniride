import '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

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

  useEffect(() => {
    void useAuth.getState().hydrate();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
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
  }, [status, queryClient]);

  if (status === 'loading') return null;

  const signedIn = status === 'signedIn';

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {signedIn ? <RealtimeBridge /> : null}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn && hasName}>
            <Stack.Screen name="index" />
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
