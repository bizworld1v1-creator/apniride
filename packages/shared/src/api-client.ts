import { healthResponseSchema, type HealthResponse } from './health';

export interface ApiClientOptions {
  baseUrl: string;
  /** Per-request timeout. Generous default because many users are on weak 3G/4G. */
  timeoutMs?: number;
  /** Extra attempts for idempotent GET requests on network errors / 5xx. */
  retries?: number;
  getAuthToken?: () => string | null | undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, timeoutMs = 15_000, retries = 2, getAuthToken } = options;
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(
    path: string,
    parse: (data: unknown) => T,
    init: RequestInit = {},
  ): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? retries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s…
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const token = getAuthToken?.();
        const res = await fetch(`${root}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
          },
        });
        if (!res.ok) {
          const err = new ApiError(`HTTP ${res.status} for ${method} ${path}`, res.status);
          if (res.status >= 500) {
            lastError = err;
            continue;
          }
          throw err;
        }
        return parse(await res.json());
      } catch (err) {
        if (err instanceof ApiError && err.status !== null && err.status < 500) throw err;
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ApiError(`Request failed: ${method} ${path}`, null);
  }

  return {
    health: (): Promise<HealthResponse> =>
      request('/health', (d) => healthResponseSchema.parse(d)),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
