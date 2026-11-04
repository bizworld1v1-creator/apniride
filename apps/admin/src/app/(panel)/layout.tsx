import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/app/login/actions';
import { load } from '@/lib/session';

/** Every page except /login: needs a signed-in admin. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await load((api) => api.admin.me());
  return (
    <>
      <header className="topbar">
        <strong className="brand">ApniRide Admin</strong>
        <nav>
          <Link href="/">Dashboard</Link>
          <Link href="/drivers">Drivers</Link>
          <Link href="/rides">Rides</Link>
          <Link href="/fares">Fares</Link>
        </nav>
        <form action={logout} className="who">
          <span className="muted">{me.name ?? me.phoneMasked}</span>
          <button type="submit" className="link">
            Sign out
          </button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
