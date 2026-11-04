import { rupees, when } from '@/lib/format';
import { load } from '@/lib/session';
import { FareForm } from './FareForm';

const CITY_NAMES: Record<string, string> = { LHE: 'Lahore' };

export default async function FaresPage() {
  const rates = await load((api) => api.admin.fareRates());
  return (
    <>
      <h1>Fare rates</h1>
      <p className="muted">
        Fare = base + per km × road km + per minute × minutes, rounded to Rs 10, never below the minimum.
        Trip minutes come from the average speed. Passengers pay exactly the fare they were quoted: changes only
        affect new quotes (within a minute). Every change is recorded with your name.
      </p>
      {rates.map((r) => (
        <section key={`${r.city}-${r.vehicleType}`} className="card">
          <h2>
            {CITY_NAMES[r.city] ?? r.city}: {r.vehicleType === 'car' ? 'Car (AC)' : 'Bike'}
            {!r.active ? <span className="badge cancelled">Off</span> : null}
          </h2>
          <FareForm rate={r} />
          <p className="muted">
            With the saved rates:{' '}
            {r.examples.map((e) => `${e.km} km (~${e.durationMin} min) = ${rupees(e.fare)}`).join(' · ')}
            {' '}· Last changed {when(r.updatedAt)}
          </p>
        </section>
      ))}
    </>
  );
}
