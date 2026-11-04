import 'server-only';
import { ApiError, type AuthTokens, createApiClient } from '@apniride/shared';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

/** The API, reached from the Next.js server only. Browsers never talk to it directly or see a token. */
export const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const ACCESS = 'ar_access';
const REFRESH = 'ar_refresh';
/** Matches ADMIN_REFRESH_TOKEN_TTL_DAYS on the backend. */
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const cookieOptions = {
  // Not readable by page scripts, so an XSS bug can't steal the session.
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/** Only in Server Functions and Route Handlers (Next.js can't set cookies while rendering a page). */
export async function saveTokens(tokens: AuthTokens) {
  const jar = await cookies();
  // Expire the cookie a little before the token, so we refresh instead of sending a dead token.
  jar.set(ACCESS, tokens.accessToken, { ...cookieOptions, maxAge: Math.max(60, tokens.expiresInSeconds - 60) });
  jar.set(REFRESH, tokens.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
}

export async function clearTokens() {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH)?.value ?? null;
}

/** An API client for this request, using the admin's cookies. It doesn't refresh by itself: see `load`. */
async function client() {
  const jar = await cookies();
  const access = jar.get(ACCESS)?.value ?? null;
  return createApiClient({
    baseUrl: API_URL,
    retries: 1,
    tokens: {
      getAccessToken: () => access,
      // Refreshing needs to write cookies, which pages can't do: send the browser to /auth/refresh instead.
      getRefreshToken: () => null,
      setTokens: () => undefined,
      clear: () => undefined,
    },
  });
}

export type Api = Awaited<ReturnType<typeof client>>;

/**
 * Runs API calls for a page. No session → login page. Expired access token → /auth/refresh, which comes back
 * to the same page. A disabled admin → login page with a message.
 */
export async function load<T>(fn: (api: Api) => Promise<T>): Promise<T> {
  const jar = await cookies();
  // Set by src/proxy.ts.
  const path = safeNext((await headers()).get('x-admin-path'));
  if (!jar.get(REFRESH)) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!jar.get(ACCESS)) redirect(`/auth/refresh?next=${encodeURIComponent(path)}`);
  try {
    return await fn(await client());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect(`/auth/refresh?next=${encodeURIComponent(path)}`);
    if (err instanceof ApiError && err.code === 'not_admin') redirect('/login?error=not_admin');
    throw err;
  }
}

/** For Server Functions (form actions): refreshes the token by itself if it expired. */
export async function actionApi() {
  const jar = await cookies();
  let access = jar.get(ACCESS)?.value ?? null;
  let refresh = jar.get(REFRESH)?.value ?? null;
  return createApiClient({
    baseUrl: API_URL,
    retries: 1,
    tokens: {
      getAccessToken: () => access,
      getRefreshToken: () => refresh,
      setTokens: async (tokens) => {
        access = tokens.accessToken;
        refresh = tokens.refreshToken;
        await saveTokens(tokens);
      },
      clear: async () => {
        access = refresh = null;
        await clearTokens();
      },
    },
  });
}

/** Only allow redirects to our own pages (no "//evil.com" or full URLs). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
