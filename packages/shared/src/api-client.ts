import {
  apiErrorBodySchema,
  type AdminLoginBody,
  authSessionSchema,
  authTokensSchema,
  requestOtpResponseSchema,
  userSchema,
  type AppMode,
  type AuthSession,
  type AuthTokens,
  type RequestOtpBody,
  type RequestOtpResponse,
  type UpdateProfileBody,
  type User,
  type VerifyOtpBody,
} from './auth';
import {
  type AdminDriverDetail,
  adminDriverDetailSchema,
  adminDriverSummarySchema,
  type AdminDriverSummary,
  type AdminFareRate,
  adminFareRateSchema,
  type AdminMe,
  adminMeSchema,
  type AdminRideDetail,
  adminRideDetailSchema,
  type AdminRideListQuery,
  adminRideSummarySchema,
  type AdminRideSummary,
  type AdminStats,
  adminStatsSchema,
  type FareRateBody,
  type ReviewNoteBody,
} from './admin';
import {
  type DriverApprovalStatus,
  type DriverDetailsBody,
  type DriverDocumentType,
  type DriverOnboarding,
  driverOnboardingSchema,
} from './drivers';
import { type FareEstimateBody, type FareEstimateResponse, fareEstimateResponseSchema } from './fares';
import { healthResponseSchema, type HealthResponse } from './health';
import { type NearbyDriversQuery, type NearbyDriversResponse, nearbyDriversResponseSchema } from './tracking';
import {
  type BookRideBody,
  type ChooseBidBody,
  currentRideResponseSchema,
  type DriverBidBody,
  type DriverCurrentResponse,
  driverCurrentResponseSchema,
  type DriverPosition,
  driverPositionResponseSchema,
  type DriverProfile,
  driverProfileSchema,
  type GoOnlineBody,
  type Ride,
  type RideBids,
  rideBidsSchema,
  type RideOffer,
  rideOfferSchema,
  rideSchema,
} from './rides';
import {
  type DriverEarnings,
  driverEarningsSchema,
  type RideHistoryPage,
  rideHistoryPageSchema,
  type SavedPlace,
  type SavedPlaceBody,
  savedPlaceSchema,
  type SavedPlacesResponse,
  savedPlacesResponseSchema,
} from './account';

const historyPath = (base: string, cursor?: string | null) =>
  cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;

/**
 * A file for a multipart upload: a Blob (web / Node), or what React Native's FormData accepts:
 * { uri: 'file:///…', name: 'photo.jpg', type: 'image/jpeg' }.
 */
export type UploadFile = Blob | { uri: string; name: string; type: string };

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
  /** Safe to repeat (e.g. replacing an upload), so retry like a GET. */
  idempotent?: boolean;
  timeoutMs?: number;
  /** Extra headers, e.g. the admin key. */
  headers?: Record<string, string>;
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
    const maxAttempts = method === 'GET' || opts.idempotent ? retries + 1 : 1;
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s…
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? timeoutMs);
      try {
        const token = opts.auth === false ? null : tokens?.getAccessToken();
        const res = await fetch(`${root}${path}`, {
          method,
          signal: controller.signal,
          // FormData sets its own multipart Content-Type with the boundary.
          body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
          headers: {
            Accept: 'application/json',
            ...(opts.body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...opts.headers,
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

      /** Admin panel sign-in with username + password. */
      adminLogin: (body: AdminLoginBody): Promise<AuthSession> =>
        request('/auth/admin/login', (d) => authSessionSchema.parse(d), {
          method: 'POST',
          body,
          auth: false,
        }),

      /** Switches this phone between passenger and driver mode (no new OTP). Returns the new session to store. */
      switchRole: (role: AppMode): Promise<AuthSession> =>
        request('/auth/switch-role', (d) => authSessionSchema.parse(d), {
          method: 'POST',
          body: { role, refreshToken: tokens?.getRefreshToken() ?? '' },
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
      /** Available drivers around a point, for the map before booking. Poll every ~10 s while the map is open. */
      nearbyDrivers: (query: NearbyDriversQuery): Promise<NearbyDriversResponse> =>
        request(
          `/drivers/nearby?latitude=${query.latitude}&longitude=${query.longitude}`,
          (d) => nearbyDriversResponseSchema.parse(d),
          // Stale within seconds anyway: give up fast on weak networks, the next poll comes soon.
          { timeoutMs: 8_000 },
        ),
      /** Last known position of the driver on this ride (after app start / reconnect). */
      driverPosition: (id: string): Promise<DriverPosition | null> =>
        request(`/rides/${id}/driver-location`, (d) => driverPositionResponseSchema.parse(d).position),
      cancel: (id: string): Promise<Ride> =>
        request(`/rides/${id}/cancel`, (d) => rideSchema.parse(d), { method: 'POST' }),
      /** Drivers' open bids while searching (after app start / reconnect; then pushed as `ride:bids`). */
      bids: (id: string): Promise<RideBids> => request(`/rides/${id}/bids`, (d) => rideBidsSchema.parse(d)),
      /** Ride with this driver at their price. 410 `bid_expired` if the bid is gone. */
      choose: (id: string, body: ChooseBidBody): Promise<Ride> =>
        request(`/rides/${id}/choose`, (d) => rideSchema.parse(d), { method: 'POST', body }),
      /** The passenger's finished rides, newest first. Pass the previous page's nextCursor for older ones. */
      history: (cursor?: string | null): Promise<RideHistoryPage> =>
        request(historyPath('/rides/history', cursor), (d) => rideHistoryPageSchema.parse(d)),
    },

    driver: {
      profile: (): Promise<DriverProfile> => request('/driver/me', (d) => driverProfileSchema.parse(d)),
      onboarding: {
        get: (): Promise<DriverOnboarding> =>
          request('/driver/onboarding', (d) => driverOnboardingSchema.parse(d)),
        saveDetails: (body: DriverDetailsBody): Promise<DriverOnboarding> =>
          request('/driver/onboarding/details', (d) => driverOnboardingSchema.parse(d), {
            method: 'PUT',
            body,
            idempotent: true,
          }),
        /** Replaces the photo of this type. Retried on network errors: re-uploading is harmless. */
        uploadDocument: (type: DriverDocumentType, file: UploadFile): Promise<DriverOnboarding> => {
          const form = new FormData();
          form.append('file', file as Blob);
          return request(`/driver/onboarding/documents/${type}`, (d) => driverOnboardingSchema.parse(d), {
            method: 'PUT',
            body: form,
            idempotent: true,
            timeoutMs: 60_000,
          });
        },
        submit: (): Promise<DriverOnboarding> =>
          request('/driver/onboarding/submit', (d) => driverOnboardingSchema.parse(d), { method: 'POST' }),
      },
      goOnline: (body: GoOnlineBody): Promise<DriverProfile> =>
        request('/driver/online', (d) => driverProfileSchema.parse(d), { method: 'POST', body }),
      goOffline: (): Promise<DriverProfile> =>
        request('/driver/offline', (d) => driverProfileSchema.parse(d), { method: 'POST' }),
      current: (): Promise<DriverCurrentResponse> =>
        request('/driver/current', (d) => driverCurrentResponseSchema.parse(d)),
      /** Accept the passenger's price (fare = offer) or counter-offer. Returns the request with `bid` set. */
      bid: (rideId: string, body: DriverBidBody): Promise<RideOffer> =>
        request(`/driver/rides/${rideId}/bid`, (d) => rideOfferSchema.parse(d), { method: 'POST', body }),
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
      /** Rides this driver did (completed or cancelled), newest first. */
      history: (cursor?: string | null): Promise<RideHistoryPage> =>
        request(historyPath('/driver/rides/history', cursor), (d) => rideHistoryPageSchema.parse(d)),
      /** Cash collected today, in the last 7 days and in total (Pakistan time). */
      earnings: (): Promise<DriverEarnings> => request('/driver/earnings', (d) => driverEarningsSchema.parse(d)),
    },

    /** Admin panel. Needs a session from signing in with role "admin". */
    admin: {
      me: (): Promise<AdminMe> => request('/admin/me', (d) => adminMeSchema.parse(d)),
      stats: (): Promise<AdminStats> => request('/admin/stats', (d) => adminStatsSchema.parse(d)),
      drivers: (status?: DriverApprovalStatus): Promise<AdminDriverSummary[]> =>
        request(`/admin/drivers${status ? `?status=${status}` : ''}`, (d) => adminDriverSummarySchema.array().parse(d)),
      driver: (id: string): Promise<AdminDriverDetail> =>
        request(`/admin/drivers/${id}`, (d) => adminDriverDetailSchema.parse(d)),
      approve: (id: string): Promise<AdminDriverDetail> =>
        request(`/admin/drivers/${id}/approve`, (d) => adminDriverDetailSchema.parse(d), { method: 'POST' }),
      reject: (id: string, body: ReviewNoteBody): Promise<AdminDriverDetail> =>
        request(`/admin/drivers/${id}/reject`, (d) => adminDriverDetailSchema.parse(d), { method: 'POST', body }),
      suspend: (id: string, body: ReviewNoteBody): Promise<AdminDriverDetail> =>
        request(`/admin/drivers/${id}/suspend`, (d) => adminDriverDetailSchema.parse(d), { method: 'POST', body }),
      rides: (query: AdminRideListQuery = {}): Promise<AdminRideSummary[]> => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v));
        const qs = params.toString();
        return request(`/admin/rides${qs ? `?${qs}` : ''}`, (d) => adminRideSummarySchema.array().parse(d));
      },
      ride: (id: string): Promise<AdminRideDetail> => request(`/admin/rides/${id}`, (d) => adminRideDetailSchema.parse(d)),
      fareRates: (): Promise<AdminFareRate[]> =>
        request('/admin/fare-rates', (d) => adminFareRateSchema.array().parse(d)),
      updateFareRate: (city: string, vehicleType: string, body: FareRateBody): Promise<AdminFareRate> =>
        request(`/admin/fare-rates/${city}/${vehicleType}`, (d) => adminFareRateSchema.parse(d), {
          method: 'PUT',
          body,
          idempotent: true,
        }),
    },

    me: {
      get: (): Promise<User> => request('/me', (d) => userSchema.parse(d)),
      update: (body: UpdateProfileBody): Promise<User> =>
        request('/me', (d) => userSchema.parse(d), { method: 'PATCH', body }),
      /** GET it with the access token as a Bearer header (it's private). Add ?v=<photoUpdatedAt> to bust caches. */
      photoPath: '/me/photo',
      uploadPhoto: (file: UploadFile): Promise<User> => {
        const form = new FormData();
        form.append('file', file as Blob);
        return request('/me/photo', (d) => userSchema.parse(d), {
          method: 'PUT',
          body: form,
          idempotent: true,
          timeoutMs: 60_000,
        });
      },
      deletePhoto: (): Promise<User> => request('/me/photo', (d) => userSchema.parse(d), { method: 'DELETE' }),
      /** Deletes the account for good (refused while online as a driver or with a ride going on). */
      deleteAccount: (): Promise<void> => request('/me', () => undefined, { method: 'DELETE' }),
      places: {
        list: (): Promise<SavedPlacesResponse> => request('/me/places', (d) => savedPlacesResponseSchema.parse(d)),
        create: (body: SavedPlaceBody): Promise<SavedPlace> =>
          request('/me/places', (d) => savedPlaceSchema.parse(d), { method: 'POST', body }),
        update: (id: string, body: SavedPlaceBody): Promise<SavedPlace> =>
          request(`/me/places/${id}`, (d) => savedPlaceSchema.parse(d), { method: 'PUT', body, idempotent: true }),
        remove: (id: string): Promise<void> =>
          request(`/me/places/${id}`, () => undefined, { method: 'DELETE', idempotent: true }),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
