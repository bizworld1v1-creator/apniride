import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

const healthy = {
  status: 'ok',
  uptimeSeconds: 1,
  timestamp: new Date().toISOString(),
  services: {
    postgres: { status: 'up', postgis: '3.5', latencyMs: 2 },
    redis: { status: 'up', latencyMs: 1 },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('createApiClient', () => {
  it('parses a valid health response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(healthy)));
    const api = createApiClient({ baseUrl: 'http://x/' });
    await expect(api.health()).resolves.toMatchObject({ status: 'ok' });
  });

  it('retries GET on 5xx then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(healthy));
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ baseUrl: 'http://x', retries: 1 });
    await expect(api.health()).resolves.toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 404));
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ baseUrl: 'http://x', retries: 2 });
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('auth + token refresh', () => {
  const user = { id: '7f8c0a52-3a8e-4c39-9f2e-6f9b3a1d2c10', role: 'passenger', name: 'Ali', phoneMasked: '+92 3•• ••• 4567' };
  const fresh = { accessToken: 'new-access', refreshToken: 'new-refresh-token-xxxxxxxxxx', expiresInSeconds: 3600 };

  const makeStore = () => {
    const state = { access: 'old-access' as string | null, refresh: 'old-refresh-token-xxxxxxxxxx' as string | null };
    return {
      state,
      store: {
        getAccessToken: () => state.access,
        getRefreshToken: () => state.refresh,
        setTokens: vi.fn((t: { accessToken: string; refreshToken: string }) => {
          state.access = t.accessToken;
          state.refresh = t.refreshToken;
        }),
        clear: vi.fn(() => {
          state.access = null;
          state.refresh = null;
        }),
      },
    };
  };

  const authHeader = (call: unknown[]) =>
    ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

  it('sends the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(user));
    vi.stubGlobal('fetch', fetchMock);
    const { store } = makeStore();
    await createApiClient({ baseUrl: 'http://x', tokens: store }).me.get();
    expect(authHeader(fetchMock.mock.calls[0]!)).toBe('Bearer old-access');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(json(fresh));
      const auth = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        auth === 'Bearer new-access' ? json(user) : json({ statusCode: 401, code: 'unauthorized', message: 'x' }, 401),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const { store, state } = makeStore();
    const api = createApiClient({ baseUrl: 'http://x', tokens: store });

    // Two parallel requests should share a single refresh call.
    await Promise.all([api.me.get(), api.me.get()]);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(state.access).toBe('new-access');
    expect(store.clear).not.toHaveBeenCalled();
  });

  it('clears tokens when the refresh token is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ statusCode: 401, code: 'invalid_refresh_token', message: 'x' }, 401))),
    );
    const { store } = makeStore();
    const api = createApiClient({ baseUrl: 'http://x', tokens: store, retries: 0 });
    await expect(api.me.get()).rejects.toMatchObject({ status: 401, code: 'invalid_refresh_token' });
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the user signed in when refresh fails because they are offline', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.endsWith('/auth/refresh')
        ? Promise.reject(new TypeError('Network request failed'))
        : Promise.resolve(json({ statusCode: 401, code: 'unauthorized', message: 'x' }, 401)),
    ));
    const { store } = makeStore();
    const api = createApiClient({ baseUrl: 'http://x', tokens: store, retries: 0 });
    await expect(api.me.get()).rejects.toMatchObject({ status: null });
    expect(store.clear).not.toHaveBeenCalled();
  });

  it('exposes API error codes and retry-after', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json({ statusCode: 429, code: 'resend_too_soon', message: 'wait', retryAfterSeconds: 42 }, 429),
    ));
    const api = createApiClient({ baseUrl: 'http://x' });
    await expect(api.auth.requestOtp({ phone: '03001234567', role: 'passenger' })).rejects.toMatchObject({
      status: 429,
      code: 'resend_too_soon',
      retryAfterSeconds: 42,
    });
  });

  it('does not retry POST requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 503));
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ baseUrl: 'http://x', retries: 2 });
    await expect(api.auth.requestOtp({ phone: '03001234567', role: 'passenger' })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
