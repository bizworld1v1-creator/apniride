import { type RideStatus, rideStatusSchema } from '@apniride/shared';
import Link from 'next/link';
import { RIDE_STATUS_LABELS, rupees, when } from '@/lib/format';
import { load } from '@/lib/session';

const PAGE = 50;

export default async function RidesPage({ searchParams }: { searchParams: Promise<{ status?: string; before?: string }> }) {
  const sp = await searchParams;
  const parsed = rideStatusSchema.safeParse(sp.status);
  const status: RideStatus | undefined = parsed.success ? parsed.data : undefined;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? sp.before : undefined;
  const rides = await load((api) => api.admin.rides({ status, before, limit: PAGE }));

  const link = (s: RideStatus | undefined, b?: string) => {
    const q = new URLSearchParams();
    if (s) q.set('status', s);
    if (b) q.set('before', b);
    const qs = q.toString();
    return `/rides${qs ? `?${qs}` : ''}`;
  };

  return (
    <>
      <h1>Rides</h1>
      <nav className="tabs">
        <Link href={link(undefined)} className={!status ? 'active' : ''}>All</Link>
        {rideStatusSchema.options.map((s) => (
          <Link key={s} href={link(s)} className={s === status ? 'active' : ''}>
            {RIDE_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {rides.length === 0 ? (
        <p className="muted">No rides.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Booked</th>
              <th>Status</th>
              <th>Vehicle</th>
              <th>Fare</th>
              <th>Passenger</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/rides/${r.id}`}>{when(r.createdAt)}</Link>
                </td>
                <td>
                  <span className={`badge ${r.status}`}>{RIDE_STATUS_LABELS[r.status]}</span>
                  {r.cancelledBy ? <span className="muted"> by {r.cancelledBy}</span> : null}
                </td>
                <td>{r.vehicleType}</td>
                <td>
                  {rupees(r.fare)} <span className="muted">· {r.distanceKm} km</span>
                </td>
                <td>{r.passenger.name ?? '–'}</td>
                <td>{r.driver ? <Link href={`/drivers/${r.driver.id}`}>{r.driver.name ?? '–'}</Link> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="row">
        {before ? <Link href={link(status)}>« Newest</Link> : null}
        {rides.length === PAGE ? <Link href={link(status, rides.at(-1)!.createdAt)}>Older »</Link> : null}
      </p>
    </>
  );
}
