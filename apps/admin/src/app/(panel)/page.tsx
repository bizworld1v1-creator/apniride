import Link from 'next/link';
import { rupees } from '@/lib/format';
import { load } from '@/lib/session';

export default async function DashboardPage() {
  const s = await load((api) => api.admin.stats());
  return (
    <>
      <h1>Dashboard</h1>
      <div className="tiles">
        <Link href="/drivers?status=pending" className={`tile ${s.pendingDrivers > 0 ? 'attention' : ''}`}>
          <span className="big">{s.pendingDrivers}</span>
          drivers waiting for review
        </Link>
        <div className="tile">
          <span className="big">{s.onlineDrivers}</span>
          drivers online now (of {s.approvedDrivers} approved)
        </div>
        <Link href="/rides" className="tile">
          <span className="big">{s.activeRides}</span>
          rides in progress
        </Link>
      </div>
      <h2>Today (Pakistan time)</h2>
      <table>
        <tbody>
          <tr><th>Rides booked</th><td>{s.today.rides}</td></tr>
          <tr><th>Completed</th><td>{s.today.completed}</td></tr>
          <tr><th>Cancelled</th><td>{s.today.cancelled}</td></tr>
          <tr><th>No driver found</th><td>{s.today.noDriver}</td></tr>
          <tr><th>Fares of completed rides (cash)</th><td>{rupees(s.today.completedFares)}</td></tr>
        </tbody>
      </table>
    </>
  );
}
