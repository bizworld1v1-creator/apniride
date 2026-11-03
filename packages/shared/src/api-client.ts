import {
  apiErrorBodySchema,
  authSessionSchema,
  authTokensSchema,
  requestOtpResponseSchema,
  userSchema,
  type AuthSession,
  type AuthTokens,
  type RequestOtpBody,
  type RequestOtpResponse,
  type UpdateProfileBody,
  type User,
  type VerifyOtpBody,
} from './auth';
import { type FareEstimateBody, type FareEstimateResponse, fareEstimateResponseSchema } from './fares';
import { healthResponseSchema, type HealthResponse } from './health';
import {
  type BookRideBody,
  currentRideResponseSchema,
  type DriverCurrentResponse,
  driverCurrentResponseSchema,
  type DriverPosition,
  driverPositionResponseSchema,
  type DriverProfile,
  driverProfileSchema,
  type GoOnlineBody,
  type Ride,
  rideSchema,
  type UpdateDriverProfileBody,
} from './rides';

/**
 * Where the app keeps its tokens (e.g. memory + SecureStore).
 * The client reads tokens on every request and writes new ones after a refresh.
 */
export interface TokenStore {
  getAccessToken(): string | null | undefined;
  getRefreshToken(): string | null | undefined;
  setTokens(tokens: AuthTokens): void | Promise<void>;
  /** Called when the refresh token is rejected: the user has to sign in again. */
  clear(): void | Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Per-request timeout. Generous default because many users are on weak 3G/4G. */
  timeoutMs?: number;
  /** Extra attempts for idempotent GET requests on network errors / 5xx. */
  retries?: number;
  tokens?: TokenStore;
}

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or null for network errors / timeouts. */
    public readonly status: number | null,
    /** Machine-readable code from the API (see authErrorCodeSchema), if any. */
    public readonly code: string | null = null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token and refresh it on 401. Default true. */
  auth?: boolean;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, timeoutMs = 15_000, retries = 2, tokens } = options;
  const root = baseUrl.replace(/\/+$/, '');

  async function toApiError(res: Response, method: string, path: string): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Not JSON (e.g. a proxy error page) – fall back to the status code.
    }
    const parsed = apiErrorBodySchema.safeParse(body);
    return parsed.success
      ? new ApiError(
          parsed.data.message,
          res.status,
          parsed.data.code,
          parsed.data.retryAfterSeconds ?? null,
        )
      : new ApiError(`HTTP ${res.status} for ${method} ${path}`, res.status);
  }

  /** One logical request, with retries for GET on network errors / 5xx. */
  async function send<T>(path: string, parse: (d: unknown) => T, opts: RequestOptions): Promise<T> {
    const method = opts.method ?? 'GET';
    const maxAttempts = method === 'GET' ? retries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s…
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const token = opts.auth === false ? null : tokens?.getAccessToken();
        const res = await fetch(`${root}${path}`, {
          method,
          signal: controller.signal,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          headers: {
            Accept: 'application/json',
            ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const err = await toApiError(res, method, path);
          if (res.status >= 500) {
            lastError = err;
            continue;
          }
          throw err;
        }
        if (res.status === 204) return parse(undefined);
        return parse(await res.json());
      } catch (err) {
        if (err instanceof ApiError && err.status !== null && err.status < 500) throw err;
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof ApiError) throw lastError;
    // fetch() network failure or our timeout abort.
    throw new ApiError(
      lastError instanceof Error ? lastError.message : `Request failed: ${method} ${path}`,
      null,
    );
  }

  // Several requests can hit 401 at once; only refresh once and let them all wait for it.
  let refreshing: Promise<void> | null = null;

  function refreshTokens(): Promise<void> {
    refreshing ??= (async () => {
      const refreshToken = tokens?.getRefreshToken();
      if (!refreshToken) throw new ApiError('Not signed in', 401, 'unauthorized');
      try {
        const fresh = await send('/auth/refresh', (d) => authTokensSchema.parse(d), {
          method: 'POST',
          body: { refreshToken },
          auth: false,
        });
        await tokens?.setTokens(fresh);
      } catch (err) {
        // Only sign out when the server says the token is bad – not when we're just offline.
        if (err instanceof ApiError && err.status === 401) await tokens?.clear();
        throw err;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function request<T>(
    path: string,
    parse: (d: unknown) => T,
    opts: RequestOptions = {},
  ): Promise<T> {
    try {
      return await send(path, parse, opts);
    } catch (err) {
      const canRefresh =
        opts.auth !== false &&
        err instanceof ApiError &&
        err.status === 401 &&
        !!tokens?.getRefreshToken();
      if (!canRefresh) throw err;
      await refreshTokens();
      return send(path, parse, opts);
    }
  }

  return {
    health: (): Promise<HealthResponse> =>
      request('/health', (d) => healthResponseSchema.parse(d), { auth: false }),

    auth: {
      requestOtp: (body: RequestOtpBody): Promise<RequestOtpResponse> =>
        request('/auth/otp/request', (d) => requestOtpResponseSchema.parse(d), {
          method: 'POST',
          body,
          auth: false,
        }),

      verifyOtp: (body: VerifyOtpBody): Promise<AuthSession> =>
        request('/auth/otp/verify', (d) => authSessionSchema.parse(d), {
          method: 'POST',
          body,
          auth: false,
        }),

      /** Revokes the refresh token on the server. Safe to call when offline (errors ignored). */
      logout: async (): Promise<void> => {
        const refreshToken = tokens?.getRefreshToken();
        if (!refreshToken) return;
        await request('/auth/logout', () => undefined, {
          method: 'POST',
          body: { refreshToken },
          auth: false,
        }).catch(() => undefined);
      },
    },

    fares: {
      /** Fixed fares for every vehicle type between two points. */
      estimate: (body: FareEstimateBody): Promise<FareEstimateResponse> =>
        request('/fares/estimate', (d) => fareEstimateResponseSchema.parse(d), { method: 'POST', body }),
    },

    rides: {
      book: (body: BookRideBody): Promise<Ride> =>
        request('/rides', (d) => rideSchema.parse(d), { method: 'POST', body }),
      /** The passenger's active ride, if any (use after app start / reconnect). */
      current: (): Promise<Ride | null> =>
        request('/rides/current', (d) => currentRideResponseSchema.parse(d).ride),
      get: (id: string): Promise<Ride> => request(`/rides/${id}`, (d) => rideSchema.parse(d)),
      /** Last known position of the driver on this ride (after app start / reconnect). */
      driverPosition: (id: string): Promise<DriverPosition | null> =>
        request(`/rides/${id}/driver-location`, (d) => driverPositionResponseSchema.parse(d).position),
      cancel: (id: string): Promise<Ride> =>
        request(`/rides/${id}/cancel`, (d) => rideSchema.parse(d), { method: 'POST' }),
    },

    driver: {
      profile: (): Promise<DriverProfile> => request('/driver/me', (d) => driverProfileSchema.parse(d)),
      updateProfile: (body: UpdateDriverProfileBody): Promise<DriverProfile> =>
        request('/driver/me', (d) => driverProfileSchema.parse(d), { method: 'PUT', body }),
      goOnline: (body: GoOnlineBody): Promise<DriverProfile> =>
        request('/driver/online', (d) => driverProfileSchema.parse(d), { method: 'POST', body }),
      goOffline: (): Promise<DriverProfile> =>
        request('/driver/offline', (d) => driverProfileSchema.parse(d), { method: 'POST' }),
      current: (): Promise<DriverCurrentResponse> =>
        request('/driver/current', (d) => driverCurrentResponseSchema.parse(d)),
      accept: (rideId: string): Promise<Ride> =>
        request(`/driver/rides/${rideId}/accept`, (d) => rideSchema.parse(d), { method: 'POST' }),
      decline: (rideId: string): Promise<void> =>
        request(`/driver/rides/${rideId}/decline`, () => undefined, { method: 'POST' }),
      arrived: (rideId: string): Promise<Ride> =>
        request(`/driver/rides/${rideId}/arrived`, (d) => rideSchema.parse(d), { method: 'POST' }),
      start: (rideId: string): Promise<Ride> =>
        request(`/driver/rides/${rideId}/start`, (d) => rideSchema.parse(d), { method: 'POST' }),
      complete: (rideId: string): Promise<Ride> =>
        request(`/driver/rides/${rideId}/complete`, (d) => rideSchema.parse(d), { method: 'POST' }),
      cancel: (rideId: string): Promise<Ride> =>
        request(`/driver/rides/${rideId}/cancel`, (d) => rideSchema.parse(d), { method: 'POST' }),
    },

    me: {
      get: (): Promise<User> => request('/me', (d) => userSchema.parse(d)),
      update: (body: UpdateProfileBody): Promise<User> =>
        request('/me', (d) => userSchema.parse(d), { method: 'PATCH', body }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
