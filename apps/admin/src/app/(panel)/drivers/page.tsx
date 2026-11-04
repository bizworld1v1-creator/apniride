import { type DriverApprovalStatus, driverApprovalStatusSchema } from '@apniride/shared';
import Link from 'next/link';
import { DRIVER_STATUS_LABELS, when } from '@/lib/format';
import { load } from '@/lib/session';

const TABS: DriverApprovalStatus[] = ['pending', 'approved', 'rejected', 'suspended', 'incomplete'];

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = driverApprovalStatusSchema.catch('pending').parse(raw ?? 'pending');
  const drivers = await load((api) => api.admin.drivers(status));

  return (
    <>
      <h1>Drivers</h1>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t} href={`/drivers?status=${t}`} className={t === status ? 'active' : ''}>
            {DRIVER_STATUS_LABELS[t]}
          </Link>
        ))}
      </nav>
      {drivers.length === 0 ? (
        <p className="muted">Nobody here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Vehicle</th>
              <th>Gender</th>
              <th>{status === 'pending' ? 'Sent for review' : 'Signed up'}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/drivers/${d.id}`}>{d.name ?? '(no name)'}</Link>
                </td>
                <td>{d.phone}</td>
                <td>{d.vehicleType}</td>
                <td>{d.gender ?? '–'}</td>
                <td>{when(status === 'pending' ? d.submittedAt : d.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {status === 'pending' ? <p className="muted">Oldest first: please review in this order.</p> : null}
    </>
  );
}
