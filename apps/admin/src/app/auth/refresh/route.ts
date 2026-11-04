import { authTokensSchema } from '@apniride/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { API_URL, clearTokens, getRefreshToken, safeNext, saveTokens } from '@/lib/session';

/**
 * Pages can't write cookies, so when the access token has expired they send the browser here:
 * swap the refresh token for new tokens, then go back to the page.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const login = new URL(`/login?next=${encodeURIComponent(next)}`, req.url);
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return NextResponse.redirect(login);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return new NextResponse('Cannot reach the ApniRide server. Is the backend running?', { status: 502 });
  }
  if (res.status === 401) {
    await clearTokens();
    return NextResponse.redirect(login);
  }
  if (!res.ok) return new NextResponse('The server had a problem. Try again in a moment.', { status: 502 });
  await saveTokens(authTokensSchema.parse(await res.json()));
  return NextResponse.redirect(new URL(next, req.url));
}
