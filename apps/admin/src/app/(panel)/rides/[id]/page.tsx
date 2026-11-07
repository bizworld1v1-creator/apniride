import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RIDE_STATUS_LABELS, rupees, when } from '@/lib/format';
import { load } from '@/lib/session';

const RESPONSE_LABELS: Record<string, string> = {
  accepted: 'accepted',
  declined: 'declined',
  expired: 'did not answer',
  cancelled: 'request withdrawn',
  bid_expired: 'bid not chosen in time',
  not_chosen: 'passenger chose another driver',
};

const mapLink = (p: { latitude: number; longitude: number }) =>
  `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;

export default async function RidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await load((api) => api.admin.ride(id));

  return (
    <>
      <p>
        <Link href="/rides">‹ Rides</Link>
      </p>
      <h1>
        Ride {rupees(r.fare)} <span className={`badge ${r.status}`}>{RIDE_STATUS_LABELS[r.status]}</span>
      </h1>
      <section className="columns">
        <div>
          <h2>Trip</h2>
          <table>
            <tbody>
              <tr><th>Vehicle</th><td>{r.vehicleType === 'car' ? 'Car (AC)' : 'Bike'}</td></tr>
              <tr><th>Fare (cash)</th><td>{rupees(r.fare)}</td></tr>
              <tr><th>Distance</th><td>{r.distanceKm} km, about {r.durationMin} min</td></tr>
              <tr><th>Pickup</th><td><a href={mapLink(r.pickup)} target="_blank" rel="noreferrer">Open map</a></td></tr>
              <tr><th>Destination</th><td><a href={mapLink(r.dropoff)} target="_blank" rel="noreferrer">Open map</a></td></tr>
              <tr><th>Passenger</th><td>{r.passenger.name ?? '–'} · {r.passenger.phone}</td></tr>
              <tr>
                <th>Driver</th>
                <td>{r.driver ? <><Link href={`/drivers/${r.driver.id}`}>{r.driver.name ?? '–'}</Link> · {r.driver.phone}</> : '–'}</td>
              </tr>
              {r.cancelledBy ? <tr><th>Cancelled by</th><td>{r.cancelledBy}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Timeline</h2>
          <table>
            <tbody>
              <tr><th>Booked</th><td>{when(r.createdAt)}</td></tr>
              <tr><th>Driver accepted</th><td>{when(r.acceptedAt)}</td></tr>
              <tr><th>Driver arrived</th><td>{when(r.arrivedAt)}</td></tr>
              <tr><th>Trip started</th><td>{when(r.startedAt)}</td></tr>
              <tr><th>Completed</th><td>{when(r.completedAt)}</td></tr>
              <tr><th>Cancelled</th><td>{when(r.cancelledAt)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <h2>Requests to drivers</h2>
      {r.offers.length === 0 ? (
        <p className="muted">No driver was sent this ride.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Sent</th><th>Driver</th><th>Distance to pickup</th><th>Bid</th><th>Answer</th></tr>
          </thead>
          <tbody>
            {r.offers.map((o) => (
              <tr key={o.driverId}>
                <td>{when(o.offeredAt)}</td>
                <td><Link href={`/drivers/${o.driverId}`}>{o.driverName ?? '–'}</Link></td>
                <td>{o.pickupDistanceKm} km</td>
                <td>{o.bidFare === null ? '–' : `Rs ${o.bidFare.toLocaleString('en-PK')}`}</td>
                <td>{o.response ? RESPONSE_LABELS[o.response] : 'waiting…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
