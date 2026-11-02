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
