import { driverDocumentTypeSchema } from '@apniride/shared';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/session';

/** Streams a driver's document photo from the API, so <img> works without exposing the admin's token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !driverDocumentTypeSchema.safeParse(type).success) {
    return new NextResponse('Not found', { status: 404 });
  }
  const token = (await cookies()).get('ar_access')?.value;
  if (!token) return new NextResponse('Signed out: reload the page', { status: 401 });

  const res = await fetch(`${API_URL}/admin/drivers/${id}/documents/${type}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new NextResponse(res.status === 404 ? 'Not uploaded' : 'Error', { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      // Personal documents: never cached by the browser or any proxy.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
