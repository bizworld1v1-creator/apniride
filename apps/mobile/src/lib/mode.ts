import type { AppMode } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';

/** The mode of the signed-in session (passenger until a session says otherwise). */
export function useMode(): AppMode {
  return useAuth((s) => (s.user?.role === 'driver' ? 'driver' : 'passenger'));
}

/**
 * Passenger ↔ driver mode, like inDrive's "Driver mode". The server swaps this phone's session for one in the
 * other mode (no new OTP) and refuses while a ride is going on or the driver is online.
 */
export function useSwitchMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to: AppMode) => api.auth.switchRole(to),
    onSuccess: async (session) => {
      // Nothing from the old mode may show in the new one (ride, offers, driver profile).
      queryClient.clear();
      // New tokens + role: the home screen and the socket (RealtimeBridge) follow the role by themselves.
      await useAuth.getState().signIn(session);
    },
  });
}
