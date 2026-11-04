import { type NextRequest, NextResponse } from 'next/server';

/**
 * Tells server code which page is being opened (layouts can't see it), so after a token refresh or sign-in
 * the admin lands back on the same page. Also adds security headers to every response.
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-admin-path', req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  // Never shown inside another site's frame (clickjacking on the approve buttons).
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
