import { type AppMode, appModeSchema, type AuthSession, type AuthTokens, type User, userSchema } from '@apniride/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// Android Keystore / iOS Keychain. Kept small: two tokens and a tiny user object.
const KEYS = {
  access: 'apniride.accessToken',
  refresh: 'apniride.refreshToken',
  user: 'apniride.user',
} as const;
/** Last used mode. Kept after sign-out, so a driver signs back in to driver mode. */
const MODE_KEY = 'apniride.mode';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Mode to sign in to next time (and the mode of the current session once signed in). */
  preferredMode: AppMode;
  /** Reads saved tokens on app start. Works offline – no network call. */
  hydrate: () => Promise<void>;
  signIn: (session: AuthSession) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  setPreferredMode: (mode: AppMode) => Promise<void>;
  /** Forgets this device's session locally. Use signOut() in lib/api to also revoke it on the server. */
  clear: () => Promise<void>;
}

const save = (key: string, value: string) => SecureStore.setItemAsync(key, value).catch(() => undefined);

export const useAuth = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,
  preferredMode: 'passenger',

  hydrate: async () => {
    const mode = appModeSchema.safeParse(await SecureStore.getItemAsync(MODE_KEY).catch(() => null));
    if (mode.success) set({ preferredMode: mode.data });
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.refresh),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      const user = userJson ? userSchema.safeParse(JSON.parse(userJson)) : null;
      if (refreshToken && user?.success) {
        set({ status: 'signedIn', accessToken, refreshToken, user: user.data });
        return;
      }
    } catch {
      // Corrupt or unreadable storage: treat as signed out.
    }
    set({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
  },

  signIn: async (session) => {
    // Update memory first so the next request already uses the new token.
    set({
      status: 'signedIn',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      ...(session.user.role !== 'admin' ? { preferredMode: session.user.role } : {}),
    });
    await Promise.all([
      save(KEYS.access, session.accessToken),
      save(KEYS.refresh, session.refreshToken),
      save(KEYS.user, JSON.stringify(session.user)),
      session.user.role !== 'admin' ? save(MODE_KEY, session.user.role) : undefined,
    ]);
  },

  setTokens: async (tokens) => {
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await Promise.all([save(KEYS.access, tokens.accessToken), save(KEYS.refresh, tokens.refreshToken)]);
  },

  setUser: async (user) => {
    set({ user });
    await save(KEYS.user, JSON.stringify(user));
  },

  setPreferredMode: async (mode) => {
    set({ preferredMode: mode });
    await save(MODE_KEY, mode);
  },

  clear: async () => {
    set({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
    await Promise.all(
      Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)),
    );
  },
}));
